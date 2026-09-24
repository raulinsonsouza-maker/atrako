/** Tipos e normalização de pedidos Shopee V2. */

import { shopeeFetch } from "./client";

export type ShopeeOrderListItem = {
  order_sn?: string;
  order_status?: string;
  update_time?: number;
  create_time?: number;
};

export type ShopeeOrderItem = {
  item_id?: number;
  item_name?: string;
  item_sku?: string;
  model_id?: number;
  model_name?: string;
  model_sku?: string;
  model_quantity_purchased?: number;
  model_original_price?: number;
  model_discounted_price?: number;
};

export type ShopeeOrderDetail = {
  order_sn?: string;
  order_status?: string;
  currency?: string;
  total_amount?: number;
  create_time?: number;
  update_time?: number;
  pay_time?: number | null;
  buyer_user_id?: number | null;
  buyer_username?: string | null;
  recipient_address?: {
    name?: string | null;
    phone?: string | null;
    full_address?: string | null;
  } | null;
  item_list?: ShopeeOrderItem[];
  actual_shipping_fee?: number | null;
  estimated_shipping_fee?: number | null;
  payment_method?: string | null;
};

export type NormalizedShopeeLineItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
};

export type ShopeeBuyer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  buyerUserId: string | null;
};

const PAID_STATUSES = new Set([
  "READY_TO_SHIP",
  "PROCESSED",
  "SHIPPED",
  "TO_CONFIRM_RECEIVE",
  "COMPLETED",
  "RETRY_SHIP",
]);

export function isShopeePaidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAID_STATUSES.has(status.toUpperCase());
}

function moneyToCents(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.round(raw * 100);
}

export function extractShopeeBuyer(order: ShopeeOrderDetail): ShopeeBuyer {
  const addr = order.recipient_address;
  const nameRaw = addr?.name || order.buyer_username || null;
  const phoneRaw = addr?.phone || null;
  const name = looksMasked(nameRaw) ? null : nameRaw;
  const phone = looksMasked(phoneRaw) ? null : phoneRaw;
  return {
    name,
    email: null,
    phone,
    buyerUserId:
      order.buyer_user_id != null ? String(order.buyer_user_id) : null,
  };
}

function looksMasked(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  if (/^\*+$/.test(v)) return true;
  if (v.includes("****") || v.includes("***")) return true;
  return false;
}

export function extractShopeeLineItems(
  order: ShopeeOrderDetail,
): NormalizedShopeeLineItem[] {
  return (order.item_list ?? []).map((it) => {
    const qty = Math.max(1, Number(it.model_quantity_purchased ?? 1) || 1);
    const unit = moneyToCents(
      it.model_discounted_price ?? it.model_original_price ?? 0,
    );
    const title = String(it.item_name || it.model_name || "Item").slice(0, 300);
    return {
      externalItemId:
        it.item_id != null
          ? String(it.item_id)
          : it.model_id != null
            ? String(it.model_id)
            : null,
      title,
      quantity: qty,
      unitPriceCents: unit,
      lineTotalCents: unit * qty,
      sku: (it.model_sku || it.item_sku || null)?.slice(0, 120) ?? null,
    };
  });
}

export function shopeeOrderTotalCents(order: ShopeeOrderDetail): number {
  return moneyToCents(order.total_amount);
}

export function shopeeOrderOccurredAt(order: ShopeeOrderDetail): Date {
  const ts = order.pay_time || order.create_time || order.update_time;
  if (typeof ts === "number" && ts > 0) return new Date(ts * 1000);
  return new Date();
}

export async function getShopeeOrderList(
  workspaceId: string,
  input: {
    timeFrom: number;
    timeTo: number;
    cursor?: string;
    pageSize?: number;
    timeRangeField?: "create_time" | "update_time";
  },
): Promise<{
  order_list: ShopeeOrderListItem[];
  more: boolean;
  next_cursor: string;
}> {
  return shopeeFetch(workspaceId, "/api/v2/order/get_order_list", {
    query: {
      time_range_field: input.timeRangeField ?? "update_time",
      time_from: input.timeFrom,
      time_to: input.timeTo,
      page_size: input.pageSize ?? 50,
      cursor: input.cursor || "",
    },
  });
}

export async function getShopeeOrderDetails(
  workspaceId: string,
  orderSnList: string[],
): Promise<ShopeeOrderDetail[]> {
  if (orderSnList.length === 0) return [];
  // Shopee aceita até ~50 order_sn por chamada
  const chunks: string[][] = [];
  for (let i = 0; i < orderSnList.length; i += 40) {
    chunks.push(orderSnList.slice(i, i + 40));
  }
  const out: ShopeeOrderDetail[] = [];
  for (const chunk of chunks) {
    const res = await shopeeFetch<{ order_list?: ShopeeOrderDetail[] }>(
      workspaceId,
      "/api/v2/order/get_order_detail",
      {
        query: {
          order_sn_list: chunk.join(","),
          response_optional_fields:
            "buyer_user_id,buyer_username,item_list,pay_time,total_amount,recipient_address,actual_shipping_fee,estimated_shipping_fee,payment_method",
        },
      },
    );
    out.push(...(res.order_list ?? []));
  }
  return out;
}

export async function getShopeeShopInfo(workspaceId: string) {
  return shopeeFetch<{
    shop_name?: string;
    region?: string;
    status?: string;
    shop_id?: number;
  }>(workspaceId, "/api/v2/shop/get_shop_info", { method: "GET" });
}

export async function getShopeeShopProfile(workspaceId: string) {
  return shopeeFetch<{
    shop_logo?: string;
    description?: string;
    shop_name?: string;
  }>(workspaceId, "/api/v2/shop/get_profile", { method: "GET" });
}

export async function getShopeeEscrowDetail(
  workspaceId: string,
  orderSn: string,
): Promise<{
  order_income?: {
    order_original_price?: number;
    escrow_amount?: number;
    buyer_total_amount?: number;
    commission_fee?: number;
    service_fee?: number;
    seller_return_refund?: number;
  };
} | null> {
  try {
    return await shopeeFetch(workspaceId, "/api/v2/payment/get_escrow_detail", {
      query: { order_sn: orderSn },
    });
  } catch {
    return null;
  }
}

export async function listShopeeItemIds(
  workspaceId: string,
  offset = 0,
  pageSize = 50,
): Promise<{ item: Array<{ item_id: number }>; has_next_page: boolean; next_offset: number }> {
  return shopeeFetch(workspaceId, "/api/v2/product/get_item_list", {
    query: {
      offset,
      page_size: pageSize,
      item_status: "NORMAL",
    },
  });
}

export async function getShopeeItemBaseInfo(
  workspaceId: string,
  itemIdList: number[],
): Promise<{
  item_list?: Array<{
    item_id?: number;
    item_name?: string;
    item_sku?: string;
    item_status?: string;
    price_info?: Array<{ current_price?: number }>;
  }>;
}> {
  if (itemIdList.length === 0) return { item_list: [] };
  return shopeeFetch(workspaceId, "/api/v2/product/get_item_base_info", {
    query: { item_id_list: itemIdList.join(",") },
  });
}
