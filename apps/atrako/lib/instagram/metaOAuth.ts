const IG_GRAPH = "https://graph.instagram.com/v21.0";
const IG_API = "https://api.instagram.com";

export function getSymbiusIgConfig() {
  const appId =
    process.env.SYMBIUS_IG_APP_ID ??
    process.env.SYMBIUS_META_APP_ID ??
    process.env.META_APP_ID ??
    "";
  const appSecret =
    process.env.SYMBIUS_IG_APP_SECRET ??
    process.env.SYMBIUS_META_APP_SECRET ??
    process.env.META_APP_SECRET ??
    "";
  const verifyToken =
    process.env.SYMBIUS_META_WEBHOOK_VERIFY_TOKEN ??
    process.env.META_WEBHOOK_VERIFY_TOKEN ??
    "symbius-webhook-verify";

  return { appId, appSecret, verifyToken, graphBase: IG_GRAPH };
}

/** @deprecated Prefer getSymbiusIgConfig — kept for webhook route imports */
export function getSymbiusMetaConfig() {
  return getSymbiusIgConfig();
}

export function getSymbiusAppUrl(): string {
  if (process.env.SYMBIUS_APP_URL)
    return process.env.SYMBIUS_APP_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN)
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return "http://localhost:5000";
}

export const META_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

export const SYMBIUS_META_OAUTH_MESSAGE = "symbius-meta-oauth";

export interface IgConnectedProfile {
  igUserId: string;
  username?: string;
  name?: string;
  accountType?: string;
  profilePictureUrl?: string;
  followersCount?: number;
}

export async function igGraphGet<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const sp = new URLSearchParams(params);
  // Instagram Login: access_token na query é mais confiável que Bearer
  sp.set("access_token", token);
  const qs = sp.toString();
  const url = `${IG_GRAPH}/${path.replace(/^\//, "")}?${qs}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }
  return json;
}

export function buildMetaOAuthUrl(state: string): string {
  const { appId } = getSymbiusIgConfig();
  const redirectUri = `${getSymbiusAppUrl()}/api/symbius/auth/meta/callback`;
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_OAUTH_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("enable_fb_login", "0");
  // Não enviar force_reauth — usuários já autorizados não devem ver tela completa de permissões
  url.searchParams.set("force_reauth", "0");
  return url.toString();
}

export function normalizeOAuthCode(code: string): string {
  return code.replace(/#_+$/, "");
}

export function normalizeScopes(
  permissions: string | string[] | undefined | null,
  fallback = META_OAUTH_SCOPES,
): string {
  if (Array.isArray(permissions)) {
    const joined = permissions.map((s) => String(s).trim()).filter(Boolean).join(",");
    return joined || fallback;
  }
  if (typeof permissions === "string" && permissions.trim()) {
    return permissions.trim();
  }
  return fallback;
}

export async function exchangeCodeForShortLivedToken(code: string): Promise<{
  accessToken: string;
  userId?: string;
  permissions?: string;
}> {
  const { appId, appSecret } = getSymbiusIgConfig();
  const redirectUri = `${getSymbiusAppUrl()}/api/symbius/auth/meta/callback`;
  const form = new FormData();
  form.set("client_id", appId);
  form.set("client_secret", appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", normalizeOAuthCode(code));

  const res = await fetch(`${IG_API}/oauth/access_token`, {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as {
    access_token?: string;
    user_id?: string | number;
    permissions?: string | string[];
    data?: Array<{
      access_token?: string;
      user_id?: string | number;
      permissions?: string | string[];
    }>;
    error_message?: string;
    error?: { message: string };
  };

  console.info(
    "[instagram] short-lived exchange",
    res.status,
    json.error_message ?? json.error?.message ?? "ok",
    "user_id=",
    json.user_id ?? json.data?.[0]?.user_id ?? "",
  );

  const row = json.data?.[0];
  const accessToken = json.access_token ?? row?.access_token;
  if (!accessToken) {
    throw new Error(
      json.error_message ?? json.error?.message ?? "Token exchange failed",
    );
  }

  return {
    accessToken,
    userId: String(json.user_id ?? row?.user_id ?? ""),
    permissions: normalizeScopes(
      json.permissions ?? row?.permissions,
      META_OAUTH_SCOPES,
    ),
  };
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { appSecret } = getSymbiusIgConfig();
  // Endpoint SEM versão (/v21.0/access_token é interpretado como node Graph)
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);

  // Docs oficiais: GET. Algumas contas Meta só aceitam POST — tenta ambos.
  let res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  let json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };

  if (!json.access_token) {
    const body = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortLivedToken,
    });
    res = await fetch("https://graph.instagram.com/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
  }

  if (!json.access_token) {
    throw new Error(json.error?.message ?? "Long-lived token exchange failed");
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 60 * 24 * 60 * 60,
  };
}

export async function refreshIgLongLivedToken(
  longLivedToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  let res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  let json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };

  if (!json.access_token) {
    const body = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: longLivedToken,
    });
    res = await fetch("https://graph.instagram.com/refresh_access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
  }

  if (!json.access_token) {
    throw new Error(json.error?.message ?? "Token refresh failed");
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 60 * 24 * 60 * 60,
  };
}

/** @deprecated use exchangeCodeForShortLivedToken + exchangeForLongLivedToken */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const short = await exchangeCodeForShortLivedToken(code);
  const long = await exchangeForLongLivedToken(short.accessToken);
  return long.accessToken;
}

export async function fetchIgMeProfile(
  accessToken: string,
  fallbackUserId?: string,
): Promise<IgConnectedProfile> {
  try {
    const data = await igGraphGet<{
      user_id?: string;
      id?: string;
      username?: string;
      name?: string;
      account_type?: string;
      profile_picture_url?: string;
      followers_count?: number;
      data?: Array<{
        user_id?: string;
        username?: string;
        name?: string;
        account_type?: string;
        profile_picture_url?: string;
        followers_count?: number;
      }>;
    }>("me", accessToken, {
      fields:
        "user_id,username,name,account_type,profile_picture_url,followers_count",
    });

    const row = data.data?.[0] ?? data;
    // Preferir user_id profissional; `id` é app-scoped e quebra webhooks/perfil
    const igUserId = String(
      row.user_id ?? data.user_id ?? fallbackUserId ?? data.id ?? "",
    );
    if (!igUserId) {
      throw new Error("Não foi possível obter o Instagram User ID");
    }

    return {
      igUserId,
      username: row.username ?? data.username,
      name: row.name ?? data.name,
      accountType: row.account_type ?? data.account_type,
      profilePictureUrl: row.profile_picture_url ?? data.profile_picture_url,
      followersCount: row.followers_count ?? data.followers_count,
    };
  } catch (e) {
    if (fallbackUserId) {
      console.warn(
        "[instagram] /me failed, using oauth user_id:",
        e instanceof Error ? e.message : e,
      );
      return { igUserId: fallbackUserId };
    }
    throw e;
  }
}

export async function subscribeIgWebhooks(
  igUserId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${IG_GRAPH}/${igUserId}/subscribed_apps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      subscribed_fields:
        "messages,messaging_postbacks,messaging_referral,comments",
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: { message: string };
  };
  if (!res.ok || json.error || json.success === false) {
    throw new Error(json.error?.message ?? "Falha ao assinar webhooks");
  }
}

export async function verifyMessagingAccess(
  _igUserId: string,
  _accessToken: string,
): Promise<boolean> {
  return true;
}

export type IgMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

const MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

function friendlyMediaError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("unsupported request") ||
    lower.includes("method type") ||
    lower.includes("permission") ||
    lower.includes("oauth") ||
    lower.includes("access token") ||
    lower.includes("(#100)")
  ) {
    return "Não foi possível carregar as publicações. Reconecte o Instagram em Configurações (Atualizar permissões) ou use “qualquer publicação”.";
  }
  if (lower.includes("rate limit") || lower.includes("throttl")) {
    return "Limite da API do Instagram atingido. Tente novamente em alguns minutos.";
  }
  return "Não foi possível listar publicações agora. Use “qualquer publicação” ou reconecte o Instagram.";
}

async function igMediaGet(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<{ data?: IgMediaItem[]; error?: string }> {
  const url = new URL(`${IG_GRAPH}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  // Instagram Login: access_token na query (Bearer costuma falhar em /media)
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });
  const json = (await res.json()) as {
    data?: IgMediaItem[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    return { error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { data: json.data ?? [] };
}

/**
 * Lista mídia do Instagram Login.
 * Resolve o `user_id` profissional via /me (não o app-scoped id) e tenta
 * /{ig-user-id}/media e /me/media.
 */
export async function fetchIgUserMedia(params: {
  accessToken: string;
  storedIgUserId?: string | null;
  limit?: number;
}): Promise<{
  media: IgMediaItem[];
  igUserId: string | null;
  warning?: string;
  rawError?: string;
}> {
  const limit = String(params.limit ?? 24);
  let resolvedId = (params.storedIgUserId ?? "").trim() || null;

  try {
    const meUrl = new URL(`${IG_GRAPH}/me`);
    meUrl.searchParams.set("fields", "user_id,username");
    meUrl.searchParams.set("access_token", params.accessToken);
    const meRes = await fetch(meUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });
    const me = (await meRes.json()) as {
      user_id?: string;
      id?: string;
      error?: { message?: string };
    };
    if (!me.error) {
      const fromMe = String(me.user_id ?? "").trim();
      if (fromMe) resolvedId = fromMe;
    } else {
      console.warn("[instagram] /me for media id failed:", me.error.message);
    }
  } catch (e) {
    console.warn(
      "[instagram] /me for media id failed:",
      e instanceof Error ? e.message : e,
    );
  }

  const attempts: Array<{ label: string; path: string }> = [];
  if (resolvedId) {
    attempts.push({ label: "user_media", path: `${resolvedId}/media` });
  }
  attempts.push({ label: "me_media", path: "me/media" });
  if (
    params.storedIgUserId &&
    params.storedIgUserId.trim() &&
    params.storedIgUserId.trim() !== resolvedId
  ) {
    attempts.push({
      label: "stored_media",
      path: `${params.storedIgUserId.trim()}/media`,
    });
  }

  let lastError = "";
  for (const attempt of attempts) {
    const result = await igMediaGet(attempt.path, params.accessToken, {
      fields: MEDIA_FIELDS,
      limit,
    });
    if (!result.error) {
      return {
        media: result.data ?? [],
        igUserId: resolvedId,
      };
    }
    lastError = result.error;
    console.warn(`[instagram] ${attempt.label} failed:`, result.error);
  }

  return {
    media: [],
    igUserId: resolvedId,
    warning: friendlyMediaError(lastError || "unknown"),
    rawError: lastError || undefined,
  };
}

export async function completeInstagramLogin(code: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  profile: IgConnectedProfile;
  scopes: string;
  messagesEnabled: boolean;
}> {
  const short = await exchangeCodeForShortLivedToken(code);

  let accessToken = short.accessToken;
  let expiresIn = 60 * 60;
  try {
    const long = await exchangeForLongLivedToken(short.accessToken);
    accessToken = long.accessToken;
    expiresIn = long.expiresIn;
    console.info("[instagram] long-lived exchange ok, expires_in=", expiresIn);
  } catch (e) {
    console.warn(
      "[instagram] long-lived exchange failed, using short-lived token:",
      e instanceof Error ? e.message : e,
    );
  }

  const fallbackId = short.userId?.trim() ? short.userId : undefined;
  let profile = await fetchIgMeProfile(accessToken, fallbackId);

  // Se /me falhou no short-lived, tenta de novo após long-lived (ou vice-versa)
  if (!profile.username || !profile.profilePictureUrl) {
    try {
      const again = await fetchIgMeProfile(accessToken, profile.igUserId);
      profile = {
        ...profile,
        ...again,
        igUserId: again.igUserId || profile.igUserId,
        username: again.username ?? profile.username,
        name: again.name ?? profile.name,
        profilePictureUrl: again.profilePictureUrl ?? profile.profilePictureUrl,
        followersCount: again.followersCount ?? profile.followersCount,
      };
    } catch {
      // mantém o que tiver
    }
  }

  try {
    await subscribeIgWebhooks(profile.igUserId, accessToken);
  } catch (e) {
    console.warn(
      "[instagram] webhook subscribe failed:",
      e instanceof Error ? e.message : e,
    );
  }

  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    profile,
    scopes: normalizeScopes(short.permissions, META_OAUTH_SCOPES),
    messagesEnabled: true,
  };
}
