/**
 * Push / webhook helpers Shopee.
 * Order push → get_order_detail → ingest (fonte final = API).
 */

export type ShopeePushPayload = {
  code?: number | string;
  shop_id?: number;
  data?: {
    ordersn?: string;
    order_sn?: string;
    status?: string;
    update_time?: number;
  };
  // alguns formatos usam campos no root
  ordersn?: string;
  order_sn?: string;
};

export function extractShopeePushOrderSn(payload: ShopeePushPayload): string | null {
  const sn =
    payload.data?.ordersn ||
    payload.data?.order_sn ||
    payload.ordersn ||
    payload.order_sn ||
    null;
  return sn ? String(sn).trim() : null;
}

export function extractShopeePushShopId(
  payload: ShopeePushPayload,
): string | null {
  if (payload.shop_id != null) return String(payload.shop_id);
  return null;
}

/** Códigos comuns: 3 = order status. Aceita string/number. */
export function isShopeeOrderPush(payload: ShopeePushPayload): boolean {
  const code = payload.code;
  if (code === 3 || code === "3" || code === "order_status") return true;
  return Boolean(extractShopeePushOrderSn(payload));
}
