/**
 * Cliente Olist ERP — Token API (v2) com probe opcional v3 Bearer.
 * Doc: https://api-docs.erp.olist.com/
 */

import { decryptCredentials } from "@/lib/atrako/credentials-crypto";
import { prisma } from "@/lib/db";

export type OlistCredentials = {
  apiToken: string;
  [key: string]: unknown;
};

export type OlistApiVersion = "v2" | "v3";

const V2_BASE = "https://api.tiny.com.br/api2";
const V3_BASE = "https://api.tiny.com.br/public-api/v3";

export async function resolveOlistCredentials(workspaceId: string): Promise<{
  connectionId: string;
  credentials: OlistCredentials;
  apiVersion: OlistApiVersion;
} | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "OLIST_ERP" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;

  const credentials = decryptCredentials(row.credentialsEnc) as OlistCredentials;
  if (typeof credentials.apiToken !== "string" || !credentials.apiToken.trim()) {
    return null;
  }

  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const apiVersion: OlistApiVersion = meta.apiVersion === "v3" ? "v3" : "v2";

  return {
    connectionId: row.id,
    credentials: { ...credentials, apiToken: credentials.apiToken.trim() },
    apiVersion,
  };
}

/** Prova o token: tenta v3 Bearer; se 401, valida v2. */
export async function validateOlistToken(
  apiToken: string,
): Promise<
  | { ok: true; apiVersion: OlistApiVersion }
  | { ok: false; error: string }
> {
  const token = apiToken.trim();
  if (!token) return { ok: false, error: "Token API obrigatório" };

  try {
    const v3 = await fetch(`${V3_BASE}/pedidos?limit=1`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (v3.ok) return { ok: true, apiVersion: "v3" };
  } catch {
    /* tenta v2 */
  }

  try {
    const body = new URLSearchParams({
      token,
      formato: "json",
      pagina: "1",
    });
    const v2 = await fetch(`${V2_BASE}/pedidos.pesquisa.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!v2.ok) {
      return { ok: false, error: `Olist API ${v2.status}` };
    }
    const json = (await v2.json()) as {
      retorno?: { status?: string; codigo_erro?: string; erros?: unknown };
    };
    const status = (json.retorno?.status ?? "").toUpperCase();
    if (status !== "OK") {
      const text = JSON.stringify(json.retorno ?? {}).slice(0, 220);
      return {
        ok: false,
        error: /token|autoriz|invalid|acesso/i.test(text)
          ? "Token inválido ou sem permissão"
          : `Olist: ${text || status || "falha na autenticação"}`,
      };
    }
    return { ok: true, apiVersion: "v2" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "rede indisponível";
    return { ok: false, error: `Não foi possível alcançar a Olist: ${message}` };
  }
}

export async function olistV2Post<T = unknown>(
  workspaceId: string,
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const resolved = await resolveOlistCredentials(workspaceId);
  if (!resolved) throw new Error("Olist ERP não conectado");

  const body = new URLSearchParams({
    token: resolved.credentials.apiToken,
    formato: "json",
  });
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    body.set(key, String(value));
  }

  const path = endpoint.endsWith(".php") ? endpoint : `${endpoint}.php`;
  const res = await fetch(`${V2_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Olist v2 ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function olistV3Fetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resolved = await resolveOlistCredentials(workspaceId);
  if (!resolved) throw new Error("Olist ERP não conectado");

  const url = path.startsWith("http") ? path : `${V3_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${resolved.credentials.apiToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Olist v3 ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function touchOlistConnection(connectionId: string) {
  await prisma.workspaceConnection.update({
    where: { id: connectionId },
    data: { lastSyncedAt: new Date() },
  });
}
