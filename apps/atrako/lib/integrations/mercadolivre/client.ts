/**
 * Cliente HTTP Mercado Livre com refresh automático de token.
 * Doc: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
 */

import { prisma } from "@/lib/db";
import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/atrako/credentials-crypto";
import { ML_API_BASE, ML_OAUTH_TOKEN } from "./oauth";

type MlCredentials = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  userId?: number | null;
  [key: string]: unknown;
};

async function refreshAccessToken(
  connectionId: string,
  refreshToken: string,
): Promise<MlCredentials | null> {
  const clientId = process.env.ML_CLIENT_ID?.trim();
  const clientSecret = process.env.ML_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(ML_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) return null;

  const token = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: number;
  };

  const expiresAt =
    typeof token.expires_in === "number"
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

  const row = await prisma.workspaceConnection.findUnique({
    where: { id: connectionId },
  });
  if (!row) return null;

  const prev = decryptCredentials(row.credentialsEnc) as MlCredentials;
  const next: MlCredentials = {
    ...prev,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? refreshToken,
    expiresAt,
    expiresIn: token.expires_in ?? null,
    userId: token.user_id ?? prev.userId ?? null,
  };

  await prisma.workspaceConnection.update({
    where: { id: connectionId },
    data: {
      credentialsEnc: encryptCredentials(next),
      lastSyncedAt: new Date(),
    },
  });

  return next;
}

async function resolveCredentials(workspaceId: string): Promise<{
  connectionId: string;
  credentials: MlCredentials;
} | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "MERCADO_LIVRE" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;

  let credentials = decryptCredentials(row.credentialsEnc) as MlCredentials;
  if (typeof credentials.accessToken !== "string" || !credentials.accessToken) {
    return null;
  }

  const expiresAt = credentials.expiresAt
    ? Date.parse(credentials.expiresAt)
    : NaN;
  const needsRefresh =
    Number.isFinite(expiresAt) &&
    expiresAt - Date.now() < 5 * 60 * 1000 &&
    typeof credentials.refreshToken === "string" &&
    Boolean(credentials.refreshToken);

  if (needsRefresh && credentials.refreshToken) {
    const refreshed = await refreshAccessToken(row.id, credentials.refreshToken);
    if (refreshed) credentials = refreshed;
  }

  return { connectionId: row.id, credentials };
}

export async function mlFetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resolved = await resolveCredentials(workspaceId);
  if (!resolved) throw new Error("Mercado Livre não conectado");

  const url = path.startsWith("http") ? path : `${ML_API_BASE}${path}`;
  let res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${resolved.credentials.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (
    res.status === 401 &&
    typeof resolved.credentials.refreshToken === "string" &&
    resolved.credentials.refreshToken
  ) {
    const refreshed = await refreshAccessToken(
      resolved.connectionId,
      resolved.credentials.refreshToken,
    );
    if (refreshed) {
      res = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${refreshed.accessToken}`,
          ...(init?.headers ?? {}),
        },
      });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ML API ${res.status}: ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export async function mlGetMe(workspaceId: string) {
  return mlFetch<{ id: number; nickname?: string }>(workspaceId, "/users/me");
}
