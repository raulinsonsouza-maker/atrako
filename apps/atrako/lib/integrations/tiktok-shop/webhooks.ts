/**
 * Webhooks TikTok Shop.
 * ORDER_STATUS_CHANGE (type 1) → GET order detail → ingest (fonte final = API).
 * https://partner.tiktokshop.com/docv2/page/tts-webhooks-overview
 */

import { verifyTiktokShopSignature } from "./signer";

export type TiktokShopWebhookPayload = {
  type?: number;
  tts_notification_id?: string;
  shop_id?: string | number;
  timestamp?: number;
  data?: {
    order_id?: string;
    order_status?: string;
    update_time?: number;
    is_on_hold_order?: boolean;
  };
};

export const TIKTOK_SHOP_ORDER_STATUS_CHANGE = 1;

export function verifyTiktokShopWebhook(input: {
  appKey: string;
  appSecret: string;
  rawBody: string;
  authorization: string | null;
}): boolean {
  return verifyTiktokShopSignature({
    appKey: input.appKey,
    appSecret: input.appSecret,
    rawBody: input.rawBody,
    signature: input.authorization,
  });
}

export function isTiktokShopOrderEvent(payload: TiktokShopWebhookPayload): boolean {
  return Number(payload.type) === TIKTOK_SHOP_ORDER_STATUS_CHANGE && Boolean(payload.data?.order_id);
}

export function extractTiktokShopOrderId(payload: TiktokShopWebhookPayload): string | null {
  const id = payload.data?.order_id;
  return id ? String(id).trim() : null;
}

export function extractTiktokShopShopId(payload: TiktokShopWebhookPayload): string | null {
  return payload.shop_id != null ? String(payload.shop_id) : null;
}
