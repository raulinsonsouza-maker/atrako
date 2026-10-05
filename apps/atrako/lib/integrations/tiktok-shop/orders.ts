/** Tipos e normalização de pedidos, lojas e produtos TikTok Shop (202309). */

import { tiktokShopFetch, tiktokShopSignedFetch } from "./client";

export type TiktokShopAuthorizedShop = {
  id?: string;
  name?: string;
  region?: string;
  seller_type?: string;
  cipher?: string;
  code?: string;
};

export type TiktokShopLineItem = {
  id?: string;
  product_id?: string;
  product_name?: string;
  sku_id?: string;
  sku_name?: string;
  seller_sku?: string;
  sale_price?: string;
  original_price?: string;
  currency?: string;
};

export type TiktokShopOrder = {
  id?: string;
  status?: string;
  create_time?: number;
  update_time?: number;
  paid_time?: number;
  user_id?: string;
  buyer_email?: string;
  payment?: {
    currency?: string;
    total_amount?: string;
    sub_total?: string;
    shipping_fee?: string;
    seller_discount?: string;
    platform_discount?: string;
  };
  recipient_address?: {
    name?: string;
    phone_number?: string;
    full_address?: string;
  };
  line_items?: TiktokShopLineItem[];
};

export type NormalizedTiktokShopLineItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
};

export type TiktokShopBuyer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  buyerUserId: string | null;
};

const PAID_STATUSES = new Set([
  "AWAITING_SHIPMENT",
  "PARTIALLY_SHIPPING",
  "AWAITING_COLLECTION",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
]);

export function isTiktokShopPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAID_STATUSES.has(status.toUpperCase());
}

export function tiktokShopMoneyToCents(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function looksMasked(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return /^\*+$/.test(v) || v.includes("***");
}

/** E-mails do TikTok são relays (`@scs.tiktokw.us` etc.) — não servem para marketing. */
function isRelayEmail(email: string): boolean {
  return /tiktok/i.test(email.split("@")[1] ?? "");
}

export function extractTiktokShopBuyer(order: TiktokShopOrder): TiktokShopBuyer {
  const addr = order.recipient_address;
  const name = addr?.name && !looksMasked(addr.name) ? addr.name : null;
  const phone =
    addr?.phone_number && !looksMasked(addr.phone_number) ? addr.phone_number : null;
  const emailRaw = order.buyer_email?.trim() || null;
  const email = emailRaw && !looksMasked(emailRaw) && !isRelayEmail(emailRaw) ? emailRaw : null;
  return { name, email, phone, buyerUserId: order.user_id ?? null };
}

/** O TikTok devolve uma linha por unidade; agrupa por SKU. */
export function extractTiktokShopLineItems(
  order: TiktokShopOrder,
): NormalizedTiktokShopLineItem[] {
  const grouped = new Map<string, NormalizedTiktokShopLineItem>();
  for (const it of order.line_items ?? []) {
    const key = it.sku_id || it.product_id || it.id || it.product_name || "item";
    const unit = tiktokShopMoneyToCents(it.sale_price ?? it.original_price);
    const prev = grouped.get(key);
    if (prev) {
      prev.quantity += 1;
      prev.lineTotalCents += unit;
      continue;
    }
    const title = [it.product_name, it.sku_name].filter(Boolean).join(" — ") || "Item";
    grouped.set(key, {
      externalItemId: it.product_id ?? it.sku_id ?? null,
      title: title.slice(0, 300),
      quantity: 1,
      unitPriceCents: unit,
      lineTotalCents: unit,
      sku: it.seller_sku?.slice(0, 120) || null,
    });
  }
  return [...grouped.values()];
}

export function tiktokShopOrderTotalCents(order: TiktokShopOrder): number {
  return tiktokShopMoneyToCents(order.payment?.total_amount);
}

export function tiktokShopOrderOccurredAt(order: TiktokShopOrder): Date {
  const ts = order.paid_time || order.create_time || order.update_time;
  if (typeof ts === "number" && ts > 0) return new Date(ts * 1000);
  return new Date();
}

export async function listTiktokShopAuthorizedShops(input: {
  appKey: string;
  appSecret: string;
  accessToken: string;
}): Promise<TiktokShopAuthorizedShop[]> {
  const data = await tiktokShopSignedFetch<{ shops?: TiktokShopAuthorizedShop[] }>({
    ...input,
    path: "/authorization/202309/shops",
    method: "GET",
  });
  return data.shops ?? [];
}

export async function getTiktokShopAuthorizedShopsForWorkspace(workspaceId: string) {
  const data = await tiktokShopFetch<{ shops?: TiktokShopAuthorizedShop[] }>(
    workspaceId,
    "/authorization/202309/shops",
    { method: "GET", withoutShopCipher: true },
  );
  return data.shops ?? [];
}

export async function searchTiktokShopOrders(
  workspaceId: string,
  input: {
    updateTimeGe: number;
    updateTimeLt: number;
    pageToken?: string;
    pageSize?: number;
  },
): Promise<{ orders?: TiktokShopOrder[]; next_page_token?: string; total_count?: number }> {
  return tiktokShopFetch(workspaceId, "/order/202309/orders/search", {
    method: "POST",
    query: {
      page_size: input.pageSize ?? 50,
      page_token: input.pageToken || undefined,
      sort_field: "update_time",
      sort_order: "DESC",
    },
    body: {
      update_time_ge: input.updateTimeGe,
      update_time_lt: input.updateTimeLt,
    },
  });
}

export async function getTiktokShopOrderDetails(
  workspaceId: string,
  orderIds: string[],
): Promise<TiktokShopOrder[]> {
  const out: TiktokShopOrder[] = [];
  for (let i = 0; i < orderIds.length; i += 50) {
    const chunk = orderIds.slice(i, i + 50);
    const data = await tiktokShopFetch<{ orders?: TiktokShopOrder[] }>(
      workspaceId,
      "/order/202309/orders",
      { method: "GET", query: { ids: chunk.join(",") } },
    );
    out.push(...(data.orders ?? []));
  }
  return out;
}

export type TiktokShopProduct = {
  id?: string;
  title?: string;
  status?: string;
  skus?: Array<{
    id?: string;
    seller_sku?: string;
    price?: { currency?: string; sale_price?: string; tax_exclusive_price?: string };
  }>;
};

export async function searchTiktokShopProducts(
  workspaceId: string,
  input: { pageToken?: string; pageSize?: number },
): Promise<{ products?: TiktokShopProduct[]; next_page_token?: string; total_count?: number }> {
  return tiktokShopFetch(workspaceId, "/product/202309/products/search", {
    method: "POST",
    query: {
      page_size: input.pageSize ?? 50,
      page_token: input.pageToken || undefined,
    },
    body: { status: "ACTIVATE" },
  });
}
