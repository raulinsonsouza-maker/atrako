/**
 * OAuth TikTok Shop Partner Center.
 * https://partner.tiktokshop.com/docv2/page/authorization-overview-202407
 */

export const DEFAULT_TIKTOK_SHOP_AUTH_BASE = "https://services.tiktokshop.com";
export const TIKTOK_SHOP_TOKEN_BASE = "https://auth.tiktok-shops.com";
export const TIKTOK_SHOP_API_BASE = "https://open-api.tiktokglobalshop.com";

export type TiktokShopApp = {
  enabled: boolean;
  appKey: string | null;
  appSecret: string | null;
  serviceId: string | null;
  redirectUri: string;
  authBaseUrl: string;
};

export async function resolveTiktokShopApp(origin: string): Promise<TiktokShopApp> {
  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("TIKTOK_SHOP");
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    enabled: Boolean(app?.enabled),
    appKey: str(app?.credentials.clientId) || str(process.env.TIKTOK_SHOP_APP_KEY),
    appSecret: str(app?.credentials.clientSecret) || str(process.env.TIKTOK_SHOP_APP_SECRET),
    serviceId: str(app?.credentials.serviceId) || str(process.env.TIKTOK_SHOP_SERVICE_ID),
    redirectUri:
      str(app?.credentials.redirectUri) ||
      str(process.env.TIKTOK_SHOP_REDIRECT_URI) ||
      `${origin.replace(/\/$/, "")}/api/atrako/oauth/tiktok-shop/callback`,
    authBaseUrl: (
      str(app?.credentials.authBaseUrl) ||
      str(process.env.TIKTOK_SHOP_AUTH_BASE_URL) ||
      DEFAULT_TIKTOK_SHOP_AUTH_BASE
    ).replace(/\/$/, ""),
  };
}

/** A redirect URL é a cadastrada no app; o TikTok devolve `code` + `state`. */
export function buildTiktokShopAuthorizeUrl(input: {
  authBaseUrl?: string | null;
  serviceId: string;
  state: string;
}): string {
  const base = (input.authBaseUrl || DEFAULT_TIKTOK_SHOP_AUTH_BASE).replace(/\/$/, "");
  const url = new URL(`${base}/open/authorize`);
  url.searchParams.set("service_id", input.serviceId);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export type TiktokShopToken = {
  access_token: string;
  /** Unix seconds (timestamp absoluto). */
  access_token_expire_in?: number;
  refresh_token: string;
  refresh_token_expire_in?: number;
  open_id?: string;
  seller_name?: string;
  seller_base_region?: string;
  user_type?: number;
  granted_scopes?: string[];
};

type TokenEnvelope = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: TiktokShopToken;
};

async function callTokenEndpoint(
  path: string,
  params: Record<string, string>,
  errPrefix: string,
): Promise<TiktokShopToken> {
  const url = new URL(`${TIKTOK_SHOP_TOKEN_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text().catch(() => "");
  let json: TokenEnvelope;
  try {
    json = JSON.parse(text) as TokenEnvelope;
  } catch {
    throw new Error(`${errPrefix}:${res.status}:${text.slice(0, 200)}`);
  }
  if (!res.ok || json.code !== 0 || !json.data?.access_token) {
    throw new Error(
      `${errPrefix}:${json.code ?? res.status}:${json.message || ""}:${json.request_id || ""}`,
    );
  }
  return json.data;
}

export function exchangeTiktokShopCode(input: {
  appKey: string;
  appSecret: string;
  code: string;
}): Promise<TiktokShopToken> {
  return callTokenEndpoint(
    "/api/v2/token/get",
    {
      app_key: input.appKey,
      app_secret: input.appSecret,
      auth_code: input.code,
      grant_type: "authorized_code",
    },
    "tiktok_shop_token_failed",
  );
}

export function refreshTiktokShopToken(input: {
  appKey: string;
  appSecret: string;
  refreshToken: string;
}): Promise<TiktokShopToken> {
  return callTokenEndpoint(
    "/api/v2/token/refresh",
    {
      app_key: input.appKey,
      app_secret: input.appSecret,
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
    },
    "tiktok_shop_refresh_failed",
  );
}

export function tiktokShopTimestampToIso(ts: number | null | undefined): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}
