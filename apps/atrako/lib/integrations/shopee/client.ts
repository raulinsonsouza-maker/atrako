/**
 * Cliente HTTP Shopee V2 com refresh rotativo + lock simples.
 */

import { prisma } from "@/lib/db";
import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/atrako/credentials-crypto";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { refreshShopeeAccessToken, resolveShopeeApiBase } from "./oauth";
import { signShopRequest } from "./signer";

export type ShopeeCredentials = {
  accessToken: string;
  refreshToken?: string | null;
  shopId?: string | number | null;
  tokenExpiresAt?: string | null;
  expireIn?: number | null;
  [key: string]: unknown;
};

type ShopeeApiEnvelope<T = unknown> = {
  request_id?: string;
  error?: string;
  message?: string;
  response?: T;
};

const refreshLocks = new Map<string, Promise<ShopeeCredentials | null>>();

async function loadPartner(): Promise<{
  partnerId: string;
  partnerKey: string;
  apiBaseUrl: string;
}> {
  const app = await resolvePlatformApp("SHOPEE");
  const partnerId =
    app?.credentials.clientId?.trim() || process.env.SHOPEE_PARTNER_ID?.trim() || "";
  const partnerKey =
    app?.credentials.clientSecret?.trim() ||
    process.env.SHOPEE_PARTNER_KEY?.trim() ||
    "";
  const apiBaseUrl = resolveShopeeApiBase(
    (typeof app?.credentials.apiBaseUrl === "string" && app.credentials.apiBaseUrl) ||
      process.env.SHOPEE_API_BASE_URL,
  );
  if (!partnerId || !partnerKey) {
    throw new Error("Shopee Partner ID/Key não configurados em /admin/apps");
  }
  return { partnerId, partnerKey, apiBaseUrl };
}

async function refreshWithLock(
  connectionId: string,
  credentials: ShopeeCredentials,
): Promise<ShopeeCredentials | null> {
  const existing = refreshLocks.get(connectionId);
  if (existing) return existing;

  const job = (async () => {
    try {
      const partner = await loadPartner();
      const shopId = credentials.shopId;
      const refreshToken = credentials.refreshToken;
      if (shopId == null || !refreshToken) return null;

      const token = await refreshShopeeAccessToken({
        apiBaseUrl: partner.apiBaseUrl,
        partnerId: partner.partnerId,
        partnerKey: partner.partnerKey,
        refreshToken,
        shopId,
      });

      const tokenExpiresAt =
        typeof token.expire_in === "number"
          ? new Date(Date.now() + token.expire_in * 1000).toISOString()
          : null;

      const row = await prisma.workspaceConnection.findUnique({
        where: { id: connectionId },
      });
      if (!row) return null;
      const prev = decryptCredentials(row.credentialsEnc) as ShopeeCredentials;
      const next: ShopeeCredentials = {
        ...prev,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || refreshToken,
        shopId: token.shop_id ?? shopId,
        expireIn: token.expire_in ?? null,
        tokenExpiresAt,
      };
      await prisma.workspaceConnection.update({
        where: { id: connectionId },
        data: {
          credentialsEnc: encryptCredentials(next),
          lastSyncedAt: new Date(),
        },
      });
      return next;
    } catch (err) {
      console.error(
        "[shopee-refresh]",
        err instanceof Error ? err.message : err,
      );
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
  credentials: ShopeeCredentials;
  partnerId: string;
  partnerKey: string;
  apiBaseUrl: string;
} | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "SHOPEE" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;

  let credentials = decryptCredentials(row.credentialsEnc) as ShopeeCredentials;
  if (!credentials.accessToken || credentials.shopId == null) return null;

  const partner = await loadPartner();

  const expiresAt = credentials.tokenExpiresAt
    ? Date.parse(credentials.tokenExpiresAt)
    : NaN;
  const needsRefresh =
    Number.isFinite(expiresAt) &&
    expiresAt - Date.now() < 10 * 60 * 1000 &&
    Boolean(credentials.refreshToken);

  if (needsRefresh) {
    const refreshed = await refreshWithLock(row.id, credentials);
    if (refreshed) credentials = refreshed;
  }

  return {
    connectionId: row.id,
    credentials,
    partnerId: partner.partnerId,
    partnerKey: partner.partnerKey,
    apiBaseUrl: partner.apiBaseUrl,
  };
}

export async function shopeeFetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: {
    method?: "GET" | "POST";
    query?: Record<string, string | number | undefined | null>;
    body?: Record<string, unknown>;
  },
): Promise<T> {
  const resolved = await resolveCredentials(workspaceId);
  if (!resolved) throw new Error("Shopee não conectado");

  const { credentials, partnerId, partnerKey, apiBaseUrl } = resolved;
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShopRequest({
    partnerId,
    partnerKey,
    path,
    timestamp,
    accessToken: credentials.accessToken,
    shopId: credentials.shopId!,
  });

  const url = new URL(`${apiBaseUrl}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("access_token", credentials.accessToken);
  url.searchParams.set("shop_id", String(credentials.shopId));
  url.searchParams.set("sign", sign);
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const method = init?.method ?? (init?.body ? "POST" : "GET");
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const json = (await res.json()) as ShopeeApiEnvelope<T>;
  if (!res.ok || json.error) {
    const err = new Error(
      `shopee_api:${json.error || res.status}:${json.message || ""}:${json.request_id || ""}`,
    );
    throw err;
  }
  return (json.response ?? (json as unknown as T)) as T;
}

export async function getShopeeConnectionMeta(workspaceId: string) {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "SHOPEE" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;
  const credentials = decryptCredentials(row.credentialsEnc) as ShopeeCredentials;
  return {
    connectionId: row.id,
    shopId: credentials.shopId ?? null,
    label: row.label,
    metadata: row.metadata,
    credentials,
  };
}
