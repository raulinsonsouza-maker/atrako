/**
 * Facebook Login for Business — OAuth com config_id.
 * Doc: https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
 */

import { META_GRAPH_VERSION, getMetaAppId, getMetaAppSecret, metaGraphUrl } from "./graph";

export const META_LOGIN_CONFIG_MISSING =
  "Facebook Login for Business não está configurado: META_LOGIN_CONFIG_ID ausente.";

export function getMetaLoginConfigId(): string | null {
  return process.env.META_LOGIN_CONFIG_ID?.trim() || null;
}

export function requireMetaLoginConfigId(): string {
  const id = getMetaLoginConfigId();
  if (!id) throw new Error(META_LOGIN_CONFIG_MISSING);
  return id;
}

export function getMetaOAuthDialogBase(): string {
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
}

export function buildMetaAuthorizationUrl(input: {
  state: string;
  redirectUri: string;
  /** When true (SUAT), force authorization code grant. */
  systemUserFlow?: boolean;
}): string {
  const appId = getMetaAppId();
  if (!appId) {
    throw new Error("META_APP_ID não configurado");
  }
  const configId = requireMetaLoginConfigId();
  const url = new URL(getMetaOAuthDialogBase());
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  // Required for Business Integration System User Access Token configs.
  if (input.systemUserFlow !== false) {
    url.searchParams.set("override_default_response_type", "true");
  }
  return url.toString();
}

export async function exchangeMetaCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  tokenType?: string;
  expiresIn?: number | null;
}> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET não configurados");
  }

  const url = new URL(metaGraphUrl("/oauth/access_token"));
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? "Falha ao trocar code por access token");
  }
  return {
    accessToken: json.access_token,
    tokenType: json.token_type,
    expiresIn: json.expires_in ?? null,
  };
}

export function resolveMetaOAuthRedirectUri(origin: string, explicit?: string | null): string {
  const fromEnv =
    explicit?.trim() ||
    process.env.META_OAUTH_REDIRECT_URI?.trim() ||
    null;
  if (fromEnv) return fromEnv;
  return `${origin}/api/atrako/oauth/meta/callback`;
}
