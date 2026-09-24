/** Tipos e helpers de pedido Shopify (REST webhook payload + GraphQL node). */

export type ShopifyMoney = {
  amount?: string;
  currency_code?: string;
  currencyCode?: string;
};

export type ShopifyLineItem = {
  id?: string | number;
  product_id?: string | number | null;
  variant_id?: string | number | null;
  title?: string | null;
  name?: string | null;
  quantity?: number;
  price?: string | number | null;
  sku?: string | null;
  /** GraphQL */
  originalUnitPriceSet?: { shopMoney?: ShopifyMoney };
};

export type ShopifyCustomer = {
  id?: string | number | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type ShopifyOrder = {
  id?: string | number;
  admin_graphql_api_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  financial_status?: string | null;
  displayFinancialStatus?: string | null;
  fulfillment_status?: string | null;
  currency?: string | null;
  total_price?: string | number | null;
  current_total_price?: string | number | null;
  totalPriceSet?: { shopMoney?: ShopifyMoney };
  currentTotalPriceSet?: { shopMoney?: ShopifyMoney };
  created_at?: string | null;
  processed_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  processedAt?: string | null;
  customer?: ShopifyCustomer | null;
  line_items?: ShopifyLineItem[];
  lineItems?: { nodes?: ShopifyLineItem[]; edges?: Array<{ node: ShopifyLineItem }> };
  note_attributes?: Array<{ name?: string; value?: string }>;
  customAttributes?: Array<{ key?: string; value?: string }>;
};

export type NormalizedShopifyLineItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
};

export type ShopifyBuyer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  customerId: string | null;
};

const PAID_STATUSES = new Set([
  "paid",
  "partially_paid",
  "PAID",
  "PARTIALLY_PAID",
]);

export function isShopifyPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAID_STATUSES.has(status) || PAID_STATUSES.has(status.toLowerCase());
}

function moneyToCents(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function shopifyOrderExternalId(order: ShopifyOrder): string {
  if (order.id != null) {
    const s = String(order.id);
    const gid = s.match(/Order\/(\d+)/);
    if (gid) return gid[1];
    return s.replace(/\D/g, "") || s;
  }
  if (order.admin_graphql_api_id) {
    const gid = order.admin_graphql_api_id.match(/Order\/(\d+)/);
    if (gid) return gid[1];
  }
  throw new Error("shopify_order_missing_id");
}

export function shopifyOrderTotalCents(order: ShopifyOrder): number {
  const fromRest =
    order.current_total_price ?? order.total_price ?? null;
  if (fromRest != null) return moneyToCents(fromRest);
  const fromGql =
    order.currentTotalPriceSet?.shopMoney?.amount ??
    order.totalPriceSet?.shopMoney?.amount ??
    null;
  return moneyToCents(fromGql);
}

export function shopifyOrderCurrency(order: ShopifyOrder): string {
  return (
    order.currency ||
    order.currentTotalPriceSet?.shopMoney?.currencyCode ||
    order.currentTotalPriceSet?.shopMoney?.currency_code ||
    order.totalPriceSet?.shopMoney?.currencyCode ||
    "BRL"
  );
}

export function shopifyOrderStatus(order: ShopifyOrder): string | null {
  return order.financial_status || order.displayFinancialStatus || null;
}

export function extractShopifyBuyer(order: ShopifyOrder): ShopifyBuyer {
  const c = order.customer;
  const first = c?.first_name || c?.firstName || "";
  const last = c?.last_name || c?.lastName || "";
  const nameFromCustomer = `${first} ${last}`.trim() || null;
  const email = order.email || c?.email || null;
  const phone = order.phone || c?.phone || null;
  let customerId: string | null = null;
  if (c?.id != null) {
    const s = String(c.id);
    const gid = s.match(/Customer\/(\d+)/);
    customerId = gid ? gid[1] : s.replace(/\D/g, "") || s;
  }
  return {
    name: nameFromCustomer || email || phone || null,
    email,
    phone,
    customerId,
  };
}

function lineItemsFromOrder(order: ShopifyOrder): ShopifyLineItem[] {
  if (Array.isArray(order.line_items)) return order.line_items;
  if (order.lineItems?.nodes) return order.lineItems.nodes;
  if (order.lineItems?.edges) return order.lineItems.edges.map((e) => e.node);
  return [];
}

export function extractShopifyLineItems(order: ShopifyOrder): NormalizedShopifyLineItem[] {
  return lineItemsFromOrder(order).map((it) => {
    const qty = Math.max(1, Number(it.quantity ?? 1) || 1);
    const unit =
      it.price != null
        ? moneyToCents(it.price)
        : moneyToCents(it.originalUnitPriceSet?.shopMoney?.amount);
    const title = String(it.title || it.name || "Item").slice(0, 300);
    let externalItemId: string | null = null;
    if (it.product_id != null) externalItemId = String(it.product_id);
    else if (it.id != null) {
      const s = String(it.id);
      const gid = s.match(/(?:Product|LineItem|ProductVariant)\/(\d+)/);
      externalItemId = gid ? gid[1] : s;
    }
    return {
      externalItemId,
      title,
      quantity: qty,
      unitPriceCents: unit,
      lineTotalCents: unit * qty,
      sku: it.sku ? String(it.sku).slice(0, 120) : null,
    };
  });
}

export function shopifyNoteValue(order: ShopifyOrder, key: string): string | null {
  const attrs = order.note_attributes ?? [];
  for (const a of attrs) {
    if (a.name === key && a.value) return String(a.value);
  }
  const custom = order.customAttributes ?? [];
  for (const a of custom) {
    if (a.key === key && a.value) return String(a.value);
  }
  return null;
}

export function shopifyOrderOccurredAt(order: ShopifyOrder): Date {
  const raw =
    order.processed_at ||
    order.processedAt ||
    order.created_at ||
    order.createdAt ||
    null;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Converte node GraphQL Order para shape REST-like usado no ingest. */
export function normalizeGraphqlOrder(node: Record<string, unknown>): ShopifyOrder {
  const customer = node.customer as Record<string, unknown> | null | undefined;
  const lineItemsConn = node.lineItems as
    | { nodes?: Array<Record<string, unknown>> }
    | undefined;
  return {
    id: typeof node.id === "string" ? node.id : undefined,
    name: typeof node.name === "string" ? node.name : null,
    email: typeof node.email === "string" ? node.email : null,
    phone: typeof node.phone === "string" ? node.phone : null,
    displayFinancialStatus:
      typeof node.displayFinancialStatus === "string"
        ? node.displayFinancialStatus
        : null,
    financial_status:
      typeof node.displayFinancialStatus === "string"
        ? String(node.displayFinancialStatus).toLowerCase()
        : null,
    createdAt: typeof node.createdAt === "string" ? node.createdAt : null,
    processedAt: typeof node.processedAt === "string" ? node.processedAt : null,
    currentTotalPriceSet: node.currentTotalPriceSet as ShopifyOrder["currentTotalPriceSet"],
    totalPriceSet: node.totalPriceSet as ShopifyOrder["totalPriceSet"],
    customer: customer
      ? {
          id: typeof customer.id === "string" ? customer.id : null,
          email: typeof customer.email === "string" ? customer.email : null,
          phone: typeof customer.phone === "string" ? customer.phone : null,
          firstName: typeof customer.firstName === "string" ? customer.firstName : null,
          lastName: typeof customer.lastName === "string" ? customer.lastName : null,
        }
      : null,
    lineItems: {
      nodes: (lineItemsConn?.nodes ?? []).map((n) => ({
        id: typeof n.id === "string" ? n.id : undefined,
        title: typeof n.title === "string" ? n.title : null,
        quantity: typeof n.quantity === "number" ? n.quantity : 1,
        sku: typeof n.sku === "string" ? n.sku : null,
        originalUnitPriceSet: n.originalUnitPriceSet as ShopifyLineItem["originalUnitPriceSet"],
        product_id:
          n.product && typeof n.product === "object" && n.product !== null
            ? String((n.product as { id?: string }).id ?? "")
            : null,
      })),
    },
    customAttributes: Array.isArray(node.customAttributes)
      ? (node.customAttributes as ShopifyOrder["customAttributes"])
      : [],
  };
}

export function parseShopifyOrderPayload(payload: unknown): ShopifyOrder | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const o = payload as Record<string, unknown>;
  if (o.id == null && !o.admin_graphql_api_id) return null;
  return o as ShopifyOrder;
}
