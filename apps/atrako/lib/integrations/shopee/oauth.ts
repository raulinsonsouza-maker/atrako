/**
 * OAuth Shopee Open Platform V2.
 * https://open.shopee.com/developer-guide/20
 */

import { signAuthPartner, signPublicRequest } from "./signer";

export const DEFAULT_SHOPEE_API_BASE = "https://partner.shopeemobile.com";
export const AUTH_PARTNER_PATH = "/api/v2/shop/auth_partner";
export const TOKEN_GET_PATH = "/api/v2/auth/token/get";
export const ACCESS_TOKEN_GET_PATH = "/api/v2/auth/access_token/get";

export function resolveShopeeApiBase(baseUrl?: string | null): string {
  const raw = (baseUrl || DEFAULT_SHOPEE_API_BASE).trim().replace(/\/$/, "");
  return raw || DEFAULT_SHOPEE_API_BASE;
}

export function buildShopeeAuthPartnerUrl(input: {
  apiBaseUrl?: string | null;
  partnerId: string | number;
  partnerKey: string;
  redirectUri: string;
}): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signAuthPartner({
    partnerId: input.partnerId,
    partnerKey: input.partnerKey,
    path: AUTH_PARTNER_PATH,
    timestamp,
  });
  const base = resolveShopeeApiBase(input.apiBaseUrl);
  const url = new URL(`${base}${AUTH_PARTNER_PATH}`);
  url.searchParams.set("partner_id", String(input.partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  url.searchParams.set("redirect", input.redirectUri);
  return url.toString();
}

export type ShopeeTokenResponse = {
  access_token: string;
  refresh_token: string;
  expire_in?: number;
  shop_id?: number;
  merchant_id_list?: number[];
  shop_id_list?: number[];
  error?: string;
  message?: string;
  request_id?: string;
};

export async function exchangeShopeeCode(input: {
  apiBaseUrl?: string | null;
  partnerId: string | number;
  partnerKey: string;
  code: string;
  shopId: string | number;
}): Promise<ShopeeTokenResponse> {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = TOKEN_GET_PATH;
  const sign = signPublicRequest({
    partnerId: input.partnerId,
    partnerKey: input.partnerKey,
    path,
    timestamp,
  });
  const base = resolveShopeeApiBase(input.apiBaseUrl);
  const url = new URL(`${base}${path}`);
  url.searchParams.set("partner_id", String(input.partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      partner_id: Number(input.partnerId),
      shop_id: Number(input.shopId),
    }),
  });
  const json = (await res.json()) as ShopeeTokenResponse;
  if (!res.ok || json.error || !json.access_token) {
    throw new Error(
      `shopee_token_failed:${json.error || res.status}:${json.message || json.request_id || ""}`,
    );
  }
  return json;
}

export async function refreshShopeeAccessToken(input: {
  apiBaseUrl?: string | null;
  partnerId: string | number;
  partnerKey: string;
  refreshToken: string;
  shopId: string | number;
}): Promise<ShopeeTokenResponse> {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = ACCESS_TOKEN_GET_PATH;
  const sign = signPublicRequest({
    partnerId: input.partnerId,
    partnerKey: input.partnerKey,
    path,
    timestamp,
  });
  const base = resolveShopeeApiBase(input.apiBaseUrl);
  const url = new URL(`${base}${path}`);
  url.searchParams.set("partner_id", String(input.partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: input.refreshToken,
      partner_id: Number(input.partnerId),
      shop_id: Number(input.shopId),
    }),
  });
  const json = (await res.json()) as ShopeeTokenResponse;
  if (!res.ok || json.error || !json.access_token) {
    throw new Error(
      `shopee_refresh_failed:${json.error || res.status}:${json.message || json.request_id || ""}`,
    );
  }
  return json;
}
