/**
 * Shopify abandonedCheckouts (Admin GraphQL, scope read_orders) → AbandonedCart.
 */

import { upsertCheckoutCart } from "@/lib/crm/abandoned-cart";
import {
  resolveShopifyConnection,
  shopifyGraphql,
  type ShopifyGraphqlResult,
} from "./client";

type Money = { shopMoney?: { amount?: string | null; currencyCode?: string | null } | null };
type Address = { firstName?: string | null; lastName?: string | null; phone?: string | null } | null;

type ShopifyAbandonedCheckout = {
  id: string;
  abandonedCheckoutUrl?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  totalPriceSet?: Money | null;
  customer?: {
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  billingAddress?: Address;
  shippingAddress?: Address;
  lineItems?: {
    nodes: Array<{
      title?: string | null;
      quantity?: number | null;
      sku?: string | null;
      originalUnitPriceSet?: Money | null;
    }>;
  } | null;
};

type QueryData = {
  abandonedCheckouts: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyAbandonedCheckout[];
  };
};

const QUERY = `
query AbandonedCheckouts($first: Int!, $after: String, $query: String) {
  abandonedCheckouts(first: $first, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      abandonedCheckoutUrl
      completedAt
      createdAt
      updatedAt
      totalPriceSet { shopMoney { amount currencyCode } }
      customer { displayName email phone }
      billingAddress { firstName lastName phone }
      shippingAddress { firstName lastName phone }
      lineItems(first: 50) {
        nodes { title quantity sku originalUnitPriceSet { shopMoney { amount } } }
      }
    }
  }
}`;

function toCents(money: Money | null | undefined): number {
  const n = Number(money?.shopMoney?.amount ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function addressName(a: Address): string | null {
  const name = [a?.firstName, a?.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

export async function syncShopifyAbandonedCheckouts(
  workspaceId: string,
  since: Date,
): Promise<number> {
  const conn = await resolveShopifyConnection(workspaceId);
  if (!conn) return 0;

  let after: string | null = null;
  let count = 0;
  for (let page = 0; page < 20; page++) {
    const res: ShopifyGraphqlResult<QueryData> = await shopifyGraphql<QueryData>({
      ...conn,
      query: QUERY,
      variables: { first: 50, after, query: `updated_at:>'${since.toISOString()}'` },
    });
    if (res.errors?.length) {
      throw new Error(`shopify_abandoned_checkouts:${res.errors[0].message}`);
    }
    const data = res.data?.abandonedCheckouts;
    if (!data) break;

    for (const c of data.nodes) {
      const id = c.id.split("/").pop() || c.id;
      await upsertCheckoutCart({
        workspaceId,
        provider: "SHOPIFY",
        checkoutId: id,
        lastActivityAt: new Date(c.updatedAt || c.createdAt),
        completed: Boolean(c.completedAt),
        totalCents: toCents(c.totalPriceSet),
        currency: c.totalPriceSet?.shopMoney?.currencyCode ?? "BRL",
        name:
          c.customer?.displayName ||
          addressName(c.billingAddress ?? null) ||
          addressName(c.shippingAddress ?? null),
        email: c.customer?.email,
        phone: c.customer?.phone || c.billingAddress?.phone || c.shippingAddress?.phone,
        recoveryUrl: c.abandonedCheckoutUrl,
        items: (c.lineItems?.nodes ?? []).map((i) => ({
          title: i.title || "Item",
          quantity: i.quantity ?? 1,
          unitPriceCents: toCents(i.originalUnitPriceSet),
          sku: i.sku ?? null,
        })),
      });
      count++;
    }

    if (!data.pageInfo.hasNextPage || !data.pageInfo.endCursor) break;
    after = data.pageInfo.endCursor;
  }
  return count;
}
