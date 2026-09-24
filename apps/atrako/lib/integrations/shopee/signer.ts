/**
 * Assinatura HMAC-SHA256 Shopee Open Platform V2.
 * https://open.shopee.com/developer-guide/20
 */

import { createHmac } from "crypto";

export function hmacSha256Hex(partnerKey: string, baseString: string): string {
  return createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

/** Assinatura do link auth_partner: partner_id + api_path + timestamp */
export function signAuthPartner(input: {
  partnerId: string | number;
  partnerKey: string;
  path: string;
  timestamp: number;
}): string {
  const base = `${input.partnerId}${input.path}${input.timestamp}`;
  return hmacSha256Hex(input.partnerKey, base);
}

/** Assinatura de API de loja: partner_id + path + ts + access_token + shop_id */
export function signShopRequest(input: {
  partnerId: string | number;
  partnerKey: string;
  path: string;
  timestamp: number;
  accessToken: string;
  shopId: string | number;
}): string {
  const base = `${input.partnerId}${input.path}${input.timestamp}${input.accessToken}${input.shopId}`;
  return hmacSha256Hex(input.partnerKey, base);
}

/** Assinatura pública (token exchange / refresh): partner_id + path + timestamp */
export function signPublicRequest(input: {
  partnerId: string | number;
  partnerKey: string;
  path: string;
  timestamp: number;
}): string {
  return signAuthPartner(input);
}
