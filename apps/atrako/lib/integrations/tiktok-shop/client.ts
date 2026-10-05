/**
 * Cliente HTTP TikTok Shop Open API (202309+) com refresh + lock simples.
 */

import { prisma } from "@/lib/db";
import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/atrako/credentials-crypto";
import {
  TIKTOK_SHOP_API_BASE,
  refreshTiktokShopToken,
  resolveTiktokShopApp,
  tiktokShopTimestampToIso,
} from "./oauth";
import { signTiktokShopRequest } from "./signer";

export type TiktokShopCredentials = {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  shopId?: string | null;
  shopCipher?: string | null;
  openId?: string | null;
  [key: string]: unknown;
};

type TiktokShopEnvelope<T> = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
};

export type TiktokShopQuery = Record<string, string | number | undefined | null>;

const refreshLocks = new Map<string, Promise<TiktokShopCredentials | null>>();

async function loadApp(): Promise<{ appKey: string; appSecret: string }> {
  const app = await resolveTiktokShopApp("");
  if (!app.appKey || !app.appSecret) {
    throw new Error("TikTok Shop App Key/Secret não configurados em /admin/apps");
  }
  return { appKey: app.appKey, appSecret: app.appSecret };
}

/** Chamada assinada com um access token explícito (usada no callback, antes de existir conexão). */
export async function tiktokShopSignedFetch<T = unknown>(input: {
  appKey: string;
  appSecret: string;
  accessToken: string;
  path: string;
  method?: "GET" | "POST";
  query?: TiktokShopQuery;
  body?: Record<string, unknown>;
}): Promise<T> {
  const query: Record<string, string> = {
    app_key: input.appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  for (const [k, v] of Object.entries(input.query ?? {})) {
    if (v != null && v !== "") query[k] = String(v);
  }
  const bodyStr = input.body ? JSON.stringify(input.body) : null;
  query.sign = signTiktokShopRequest({
    appSecret: input.appSecret,
    path: input.path,
    query,
    body: bodyStr,
  });

  const url = new URL(`${TIKTOK_SHOP_API_BASE}${input.path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: input.method ?? (bodyStr ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      "x-tts-access-token": input.accessToken,
    },
    body: bodyStr ?? undefined,
  });
  const text = await res.text().catch(() => "");
  let json: TiktokShopEnvelope<T>;
  try {
    json = JSON.parse(text) as TiktokShopEnvelope<T>;
  } catch {
    throw new Error(`tiktok_shop_api:${res.status}:${text.slice(0, 200)}`);
  }
  if (!res.ok || json.code !== 0) {
    throw new Error(
      `tiktok_shop_api:${json.code ?? res.status}:${json.message || ""}:${json.request_id || ""}`,
    );
  }
  return (json.data ?? ({} as T)) as T;
}

async function refreshWithLock(
  connectionId: string,
  credentials: TiktokShopCredentials,
): Promise<TiktokShopCredentials | null> {
  const existing = refreshLocks.get(connectionId);
  if (existing) return existing;

  const job = (async () => {
    try {
      const refreshToken = credentials.refreshToken;
      if (!refreshToken) return null;
      const app = await loadApp();
      const token = await refreshTiktokShopToken({
        appKey: app.appKey,
        appSecret: app.appSecret,
        refreshToken,
      });

      const row = await prisma.workspaceConnection.findUnique({
        where: { id: connectionId },
      });
      if (!row) return null;
      const prev = decryptCredentials(row.credentialsEnc) as TiktokShopCredentials;
      const next: TiktokShopCredentials = {
        ...prev,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || refreshToken,
        tokenExpiresAt: tiktokShopTimestampToIso(token.access_token_expire_in),
        refreshTokenExpiresAt:
          tiktokShopTimestampToIso(token.refresh_token_expire_in) ??
          prev.refreshTokenExpiresAt ??
          null,
      };
      await prisma.workspaceConnection.update({
        where: { id: connectionId },
        data: { credentialsEnc: encryptCredentials(next) },
      });
      return next;
    } catch (err) {
      console.error("[tiktok-shop-refresh]", err instanceof Error ? err.message : err);
      return null;
    } finally {
      refreshLocks.delete(connectionId);
    }
  })();

  refreshLocks.set(connectionId, job);
  return job;
}

async function resolveCredentials(workspaceId: string): Promise<{
  connectionId: string;
  credentials: TiktokShopCredentials;
  appKey: string;
  appSecret: string;
} | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "TIKTOK_SHOP" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;

  let credentials = decryptCredentials(row.credentialsEnc) as TiktokShopCredentials;
  if (!credentials.accessToken) return null;

  const app = await loadApp();

  const expiresAt = credentials.tokenExpiresAt ? Date.parse(credentials.tokenExpiresAt) : NaN;
  const needsRefresh =
    Number.isFinite(expiresAt) &&
    expiresAt - Date.now() < 60 * 60 * 1000 &&
    Boolean(credentials.refreshToken);

  if (needsRefresh) {
    const refreshed = await refreshWithLock(row.id, credentials);
    if (refreshed) credentials = refreshed;
  }

  return { connectionId: row.id, credentials, ...app };
}

/** Chamada de loja: injeta `shop_cipher` salvo na conexão. */
export async function tiktokShopFetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: {
    method?: "GET" | "POST";
    query?: TiktokShopQuery;
    body?: Record<string, unknown>;
    /** Endpoints de autorização não aceitam shop_cipher. */
    withoutShopCipher?: boolean;
  },
): Promise<T> {
  const resolved = await resolveCredentials(workspaceId);
  if (!resolved) throw new Error("TikTok Shop não conectado");

  const { credentials, appKey, appSecret } = resolved;
  const query: TiktokShopQuery = { ...(init?.query ?? {}) };
  if (!init?.withoutShopCipher) {
    if (!credentials.shopCipher) throw new Error("TikTok Shop sem shop_cipher");
    query.shop_cipher = credentials.shopCipher;
  }

  return tiktokShopSignedFetch<T>({
    appKey,
    appSecret,
    accessToken: credentials.accessToken,
    path,
    method: init?.method,
    query,
    body: init?.body,
  });
}

export async function getTiktokShopConnectionMeta(workspaceId: string) {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "TIKTOK_SHOP" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;
  const credentials = decryptCredentials(row.credentialsEnc) as TiktokShopCredentials;
  return {
    connectionId: row.id,
    shopId: credentials.shopId ?? null,
    label: row.label,
    metadata: row.metadata,
    credentials,
  };
}
