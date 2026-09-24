/**
 * Shopify OAuth (offline access token).
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization
 */

export const DEFAULT_SHOPIFY_SCOPES =
  "read_orders,read_products,read_customers,read_fulfillments";
export const DEFAULT_SHOPIFY_API_VERSION = "2026-07";

/** Normaliza loja para `store.myshopify.com` (sem protocolo/path). */
export function normalizeShopifyShop(input: string): string | null {
  let raw = input.trim().toLowerCase();
  if (!raw) return null;
  raw = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\s+/g, "");
  if (!raw.includes(".")) {
    raw = `${raw}.myshopify.com`;
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(raw)) {
    return null;
  }
  return raw;
}

export function buildShopifyAuthorizeUrl(input: {
  shop: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(`https://${input.shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("scope", input.scopes);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeShopifyAccessToken(input: {
  shop: string;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<{
  accessToken: string;
  scope: string;
}> {
  const res = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`shopify_token_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    scope?: string;
  };
  if (!json.access_token) {
    throw new Error("shopify_no_access_token");
  }
  return {
    accessToken: json.access_token,
    scope: json.scope ?? "",
  };
}
