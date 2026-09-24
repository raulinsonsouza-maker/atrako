/**
 * Cliente HTTP Tray com refresh + lock por connection.
 */

import { prisma } from "@/lib/db";
import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/atrako/credentials-crypto";
import {
  normalizeTrayApiAddress,
  parseTrayDateTime,
  refreshTrayAccessToken,
} from "./oauth";

export type TrayCredentials = {
  accessToken: string;
  refreshToken?: string | null;
  apiAddress: string;
  storeId?: string | number | null;
  storeHost?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  [key: string]: unknown;
};

const refreshLocks = new Map<string, Promise<TrayCredentials | null>>();

async function refreshWithLock(
  connectionId: string,
  credentials: TrayCredentials,
): Promise<TrayCredentials | null> {
  const existing = refreshLocks.get(connectionId);
  if (existing) return existing;

  const job = (async () => {
    try {
      const apiAddress = normalizeTrayApiAddress(credentials.apiAddress);
      const refreshToken = credentials.refreshToken;
      if (!apiAddress || !refreshToken) return null;

      const token = await refreshTrayAccessToken({
        apiAddress,
        refreshToken,
      });

      const row = await prisma.workspaceConnection.findUnique({
        where: { id: connectionId },
      });
      if (!row) return null;
      const prev = decryptCredentials(row.credentialsEnc) as TrayCredentials;
      const next: TrayCredentials = {
        ...prev,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || refreshToken,
        accessTokenExpiresAt:
          parseTrayDateTime(token.date_expiration_access_token) ??
          prev.accessTokenExpiresAt ??
          null,
        refreshTokenExpiresAt:
          parseTrayDateTime(token.date_expiration_refresh_token) ??
          prev.refreshTokenExpiresAt ??
          null,
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
      console.error("[tray-refresh]", err instanceof Error ? err.message : err);
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
  credentials: TrayCredentials;
} | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "TRAY" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;

  let credentials = decryptCredentials(row.credentialsEnc) as TrayCredentials;
  if (!credentials.accessToken || !credentials.apiAddress) return null;

  const expiresAt = credentials.accessTokenExpiresAt
    ? Date.parse(credentials.accessTokenExpiresAt)
    : NaN;
  const needsRefresh =
    Number.isFinite(expiresAt) &&
    expiresAt - Date.now() < 10 * 60 * 1000 &&
    Boolean(credentials.refreshToken);

  if (needsRefresh) {
    const refreshed = await refreshWithLock(row.id, credentials);
    if (refreshed) credentials = refreshed;
  }

  return { connectionId: row.id, credentials };
}

export async function trayFetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string | number | undefined | null>;
    body?: Record<string, unknown> | URLSearchParams;
    _retried?: boolean;
  },
): Promise<T> {
  const resolved = await resolveCredentials(workspaceId);
  if (!resolved) throw new Error("Tray não conectado");

  const { credentials } = resolved;
  const apiAddress = normalizeTrayApiAddress(credentials.apiAddress);
  if (!apiAddress) throw new Error("tray_api_address_invalid");

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${apiAddress}${cleanPath}`);
  url.searchParams.set("access_token", credentials.accessToken);
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const method = init?.method ?? (init?.body ? "POST" : "GET");
  let body: string | undefined;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init?.body instanceof URLSearchParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = init.body.toString();
  } else if (init?.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  const res = await fetch(url.toString(), { method, headers, body });
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`tray_api:${res.status}:${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "message" in json
        ? String((json as { message?: unknown }).message ?? "")
        : text.slice(0, 200);
    if (
      !init?._retried &&
      (res.status === 401 || /chave inválida|expirad|access_token/i.test(msg))
    ) {
      const refreshed = await refreshWithLock(
        resolved.connectionId,
        credentials,
      );
      if (refreshed) {
        return trayFetch<T>(workspaceId, path, { ...init, _retried: true });
      }
    }
    throw new Error(`tray_api:${res.status}:${msg}`);
  }

  return json as T;
}

export async function getTrayConnectionMeta(workspaceId: string) {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "TRAY" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;
  const credentials = decryptCredentials(row.credentialsEnc) as TrayCredentials;
  return {
    connectionId: row.id,
    storeId: credentials.storeId ?? null,
    storeHost: credentials.storeHost ?? null,
    apiAddress: credentials.apiAddress,
    label: row.label,
    metadata: row.metadata,
    credentials,
  };
}
