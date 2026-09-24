/**
 * Sync inicial / manual Shopify → shop metadata, orders, customers, products.
 */

import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection, getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolveShopifyConnection, shopifyGraphql } from "./client";
import {
  ingestShopifyCustomer,
  ingestShopifyHubOrder,
  upsertShopifyCatalogProduct,
} from "./ingest-order";
import { normalizeGraphqlOrder } from "./orders";

const ORDERS_QUERY = `
  query SyncOrders($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        email
        phone
        displayFinancialStatus
        createdAt
        processedAt
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { id email phone firstName lastName }
        lineItems(first: 50) {
          nodes {
            id
            title
            quantity
            sku
            originalUnitPriceSet { shopMoney { amount currencyCode } }
            product { id }
          }
        }
        customAttributes { key value }
      }
    }
  }
`;

const CUSTOMERS_QUERY = `
  query SyncCustomers($cursor: String) {
    customers(first: 50, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes { id email phone firstName lastName }
    }
  }
`;

const PRODUCTS_QUERY = `
  query SyncProducts($cursor: String) {
    products(first: 50, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        status
        variants(first: 1) {
          nodes { sku price }
        }
      }
    }
  }
`;

const SHOP_QUERY = `
  query ShopInfo {
    shop {
      name
      email
      myshopifyDomain
      currencyCode
      plan { displayName }
    }
  }
`;

export type ShopifySyncResult = {
  shop: { name: string | null; domain: string | null; currency: string | null } | null;
  orders: { imported: number; updated: number };
  customers: { imported: number };
  products: { imported: number };
  errors: string[];
};

export async function syncShopifyWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number },
): Promise<ShopifySyncResult> {
  const conn = await resolveShopifyConnection(workspaceId);
  if (!conn) throw new Error("Shopify não conectado");

  const daysBack = options?.daysBack ?? 90;
  const maxPages = options?.maxPages ?? 10;
  const errors: string[] = [];
  const result: ShopifySyncResult = {
    shop: null,
    orders: { imported: 0, updated: 0 },
    customers: { imported: 0 },
    products: { imported: 0 },
    errors,
  };

  // Shop info
  try {
    const shopRes = await shopifyGraphql<{
      shop?: {
        name?: string;
        myshopifyDomain?: string;
        currencyCode?: string;
        plan?: { displayName?: string };
      };
    }>({
      shop: conn.shop,
      accessToken: conn.accessToken,
      apiVersion: conn.apiVersion,
      query: SHOP_QUERY,
    });
    const shop = shopRes.data?.shop;
    if (shop) {
      result.shop = {
        name: shop.name ?? null,
        domain: shop.myshopifyDomain ?? conn.shop,
        currency: shop.currencyCode ?? null,
      };
      const existing = await getWorkspaceConnection(workspaceId, "SHOPIFY");
      const prevMeta =
        existing?.metadata && typeof existing.metadata === "object"
          ? (existing.metadata as Record<string, unknown>)
          : {};
      await upsertWorkspaceConnection({
        clienteId: workspaceId,
        provider: "SHOPIFY",
        label: shop.name || existing?.label || "Shopify",
        credentials: existing?.credentials ?? {
          shop: conn.shop,
          accessToken: conn.accessToken,
        },
        metadata: {
          ...prevMeta,
          shop: conn.shop,
          shopName: shop.name ?? null,
          currency: shop.currencyCode ?? null,
          plan: shop.plan?.displayName ?? null,
          lastSyncedAt: new Date().toISOString(),
        },
      });
    }
  } catch (err) {
    errors.push(`shop: ${err instanceof Error ? err.message : "failed"}`);
  }

  // Orders
  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const query = `created_at:>=${since.toISOString().slice(0, 10)}`;
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const res = await shopifyGraphql<{
        orders?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<Record<string, unknown>>;
        };
      }>({
        shop: conn.shop,
        accessToken: conn.accessToken,
        apiVersion: conn.apiVersion,
        query: ORDERS_QUERY,
        variables: { cursor, query },
      });
      if (res.errors?.length) {
        errors.push(`orders: ${res.errors.map((e) => e.message).join("; ")}`);
        break;
      }
      const nodes = res.data?.orders?.nodes ?? [];
      for (const node of nodes) {
        try {
          const order = normalizeGraphqlOrder(node);
          const r = await ingestShopifyHubOrder({ workspaceId, order });
          if (r.created) result.orders.imported += 1;
          else result.orders.updated += 1;
        } catch (err) {
          errors.push(`order: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
      if (!res.data?.orders?.pageInfo.hasNextPage) break;
      cursor = res.data.orders.pageInfo.endCursor;
      if (!cursor) break;
    }
  } catch (err) {
    errors.push(`orders: ${err instanceof Error ? err.message : "failed"}`);
  }

  // Customers
  try {
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const res = await shopifyGraphql<{
        customers?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            id?: string;
            email?: string;
            phone?: string;
            firstName?: string;
            lastName?: string;
          }>;
        };
      }>({
        shop: conn.shop,
        accessToken: conn.accessToken,
        apiVersion: conn.apiVersion,
        query: CUSTOMERS_QUERY,
        variables: { cursor },
      });
      if (res.errors?.length) {
        errors.push(`customers: ${res.errors.map((e) => e.message).join("; ")}`);
        break;
      }
      for (const c of res.data?.customers?.nodes ?? []) {
        try {
          await ingestShopifyCustomer({ workspaceId, customer: c });
          result.customers.imported += 1;
        } catch {
          // skip bad rows
        }
      }
      if (!res.data?.customers?.pageInfo.hasNextPage) break;
      cursor = res.data.customers.pageInfo.endCursor;
      if (!cursor) break;
    }
  } catch (err) {
    errors.push(`customers: ${err instanceof Error ? err.message : "failed"}`);
  }

  // Products
  try {
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const res = await shopifyGraphql<{
        products?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            id?: string;
            title?: string;
            status?: string;
            variants?: { nodes?: Array<{ sku?: string; price?: string }> };
          }>;
        };
      }>({
        shop: conn.shop,
        accessToken: conn.accessToken,
        apiVersion: conn.apiVersion,
        query: PRODUCTS_QUERY,
        variables: { cursor },
      });
      if (res.errors?.length) {
        errors.push(`products: ${res.errors.map((e) => e.message).join("; ")}`);
        break;
      }
      for (const p of res.data?.products?.nodes ?? []) {
        try {
          await upsertShopifyCatalogProduct({
            workspaceId,
            product: {
              id: p.id,
              title: p.title,
              status: p.status,
              variants: (p.variants?.nodes ?? []).map((v) => ({
                sku: v.sku,
                price: v.price,
              })),
            },
            raw: p,
          });
          result.products.imported += 1;
        } catch {
          // skip
        }
      }
      if (!res.data?.products?.pageInfo.hasNextPage) break;
      cursor = res.data.products.pageInfo.endCursor;
      if (!cursor) break;
    }
  } catch (err) {
    errors.push(`products: ${err instanceof Error ? err.message : "failed"}`);
  }

  await prisma.workspaceConnection
    .updateMany({
      where: { clienteId: workspaceId, provider: "SHOPIFY" },
      data: { lastSyncedAt: new Date() },
    })
    .catch(() => null);

  return result;
}
