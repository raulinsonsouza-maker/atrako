/**
 * Troca o code Tray por token e grava a WorkspaceConnection TRAY.
 * Usado pelo callback OAuth (com state) e pelo vínculo de instalação via painel Tray.
 */

import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import {
  exchangeTrayCode,
  normalizeTrayApiAddress,
  normalizeTrayStoreHost,
  parseTrayDateTime,
} from "./oauth";
import { syncTrayWorkspace } from "./sync";

export type ConnectTrayStoreResult =
  | { ok: true; storeId: string; storeHost: string | null }
  | {
      ok: false;
      error: "tray_api_address_invalid" | "tray_not_configured" | "tray_token_failed";
    };

export async function resolveTrayApp(origin: string): Promise<{
  enabled: boolean;
  consumerKey: string | null;
  consumerSecret: string | null;
  redirectUri: string;
}> {
  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("TRAY");
  return {
    enabled: Boolean(app?.enabled),
    consumerKey:
      app?.credentials.clientId?.trim() || process.env.TRAY_CONSUMER_KEY?.trim() || null,
    consumerSecret:
      app?.credentials.clientSecret?.trim() || process.env.TRAY_CONSUMER_SECRET?.trim() || null,
    redirectUri:
      app?.credentials.redirectUri?.trim() ||
      process.env.TRAY_REDIRECT_URI?.trim() ||
      `${origin.replace(/\/$/, "")}/api/atrako/oauth/tray/callback`,
  };
}

/** Host da loja a partir do retorno Tray (store_host / url / api_address). */
export function trayHostFromParams(params: {
  storeHost?: string | null;
  url?: string | null;
  apiAddress?: string | null;
}): string | null {
  for (const raw of [params.storeHost, params.url, params.apiAddress]) {
    if (!raw) continue;
    const host = normalizeTrayStoreHost(raw);
    if (host) return host;
  }
  return null;
}

export async function connectTrayStore(input: {
  clienteId: string;
  code: string;
  apiAddress: string;
  store?: string | null;
  storeHost?: string | null;
}): Promise<ConnectTrayStoreResult> {
  const apiAddress = normalizeTrayApiAddress(input.apiAddress);
  if (!apiAddress) return { ok: false, error: "tray_api_address_invalid" };

  const { consumerKey, consumerSecret } = await resolveTrayApp("");
  if (!consumerKey || !consumerSecret) return { ok: false, error: "tray_not_configured" };

  let token: Awaited<ReturnType<typeof exchangeTrayCode>>;
  try {
    token = await exchangeTrayCode({
      apiAddress,
      consumerKey,
      consumerSecret,
      code: input.code,
    });
  } catch (err) {
    console.error("[tray-oauth] token", err instanceof Error ? err.message : err);
    return { ok: false, error: "tray_token_failed" };
  }

  const storeHost =
    normalizeTrayStoreHost(input.storeHost || "") ||
    normalizeTrayStoreHost(new URL(apiAddress).host) ||
    null;
  const storeId = String(input.store || token.store_id || "");

  await upsertWorkspaceConnection({
    clienteId: input.clienteId,
    provider: "TRAY",
    label: storeHost || `Tray #${storeId}`,
    status: "ACTIVE",
    credentials: {
      storeId,
      storeHost,
      apiAddress,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: parseTrayDateTime(token.date_expiration_access_token),
      refreshTokenExpiresAt: parseTrayDateTime(token.date_expiration_refresh_token),
    },
    metadata: {
      storeId,
      storeHost,
      apiAddress,
      connectedAt: new Date().toISOString(),
    },
  });

  try {
    await syncTrayWorkspace(input.clienteId, { daysBack: 90, maxPages: 4 });
  } catch (err) {
    console.error("[tray-oauth] initial sync", err instanceof Error ? err.message : err);
  }

  return { ok: true, storeId, storeHost };
}
