/**
 * Cliente HTTP WooCommerce REST (v3) com Basic Auth.
 * Doc: https://woocommerce.github.io/woocommerce-rest-api-docs/
 */

import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/atrako/credentials-crypto";
import { prisma } from "@/lib/db";

export type WooCredentials = {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string | null;
  [key: string]: unknown;
};

function normalizeStoreUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildWcApiUrl(storeUrl: string, path: string): string {
  const base = normalizeStoreUrl(storeUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}/wp-json/wc/v3${cleanPath}`;
}

export async function resolveWooCredentials(workspaceId: string): Promise<{
  connectionId: string;
  credentials: WooCredentials;
} | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "WOOCOMMERCE" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;

  const credentials = decryptCredentials(row.credentialsEnc) as WooCredentials;
  if (
    typeof credentials.storeUrl !== "string" ||
    !credentials.storeUrl ||
    typeof credentials.consumerKey !== "string" ||
    !credentials.consumerKey ||
    typeof credentials.consumerSecret !== "string" ||
    !credentials.consumerSecret
  ) {
    return null;
  }

  return {
    connectionId: row.id,
    credentials: {
      ...credentials,
      storeUrl: normalizeStoreUrl(credentials.storeUrl),
    },
  };
}

/** Valida keys contra a loja (sem persistir). */
export async function validateWooCredentials(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<{ ok: true; storeName: string | null } | { ok: false; error: string }> {
  const storeUrl = normalizeStoreUrl(input.storeUrl);
  if (!storeUrl || !input.consumerKey.trim() || !input.consumerSecret.trim()) {
    return { ok: false, error: "storeUrl, consumerKey e consumerSecret são obrigatórios" };
  }

  const url = buildWcApiUrl(storeUrl, "/orders?per_page=1");
  const auth = Buffer.from(
    `${input.consumerKey.trim()}:${input.consumerSecret.trim()}`,
  ).toString("base64");

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `WooCommerce API ${res.status}: ${text.slice(0, 160) || "falha na autenticação"}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "rede indisponível";
    return { ok: false, error: `Não foi possível alcançar a loja: ${message}` };
  }

  return { ok: true, storeName: new URL(storeUrl).hostname };
}

export async function wcFetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resolved = await resolveWooCredentials(workspaceId);
  if (!resolved) throw new Error("WooCommerce não conectado");

  const url = path.startsWith("http")
    ? path
    : buildWcApiUrl(resolved.credentials.storeUrl, path);
  const auth = Buffer.from(
    `${resolved.credentials.consumerKey}:${resolved.credentials.consumerSecret}`,
  ).toString("base64");

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WooCommerce API ${res.status}: ${text.slice(0, 200)}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function touchWooConnection(connectionId: string) {
  await prisma.workspaceConnection.update({
    where: { id: connectionId },
    data: { lastSyncedAt: new Date() },
  });
}

export function encryptWooCredentials(credentials: WooCredentials) {
  return encryptCredentials({
    ...credentials,
    storeUrl: normalizeStoreUrl(credentials.storeUrl),
  });
}

export { normalizeStoreUrl };
