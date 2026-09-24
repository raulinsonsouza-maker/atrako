/**
 * Cliente HTTP Nuvemshop API v1.
 * Headers: Authentication bearer + User-Agent obrigatório.
 */

import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { NUVEMSHOP_API_BASE } from "./oauth";

export type NuvemshopCredentials = {
  accessToken: string;
  storeId: string | number;
  scope?: string | null;
  [key: string]: unknown;
};

export async function resolveNuvemshopConnection(workspaceId: string): Promise<{
  storeId: string;
  accessToken: string;
  clientId: string;
  userAgent: string;
} | null> {
  const wc = await getWorkspaceConnection(workspaceId, "NUVEMSHOP");
  if (!wc || wc.status !== "ACTIVE") return null;

  const storeIdRaw =
    typeof wc.credentials.storeId === "string" ||
    typeof wc.credentials.storeId === "number"
      ? wc.credentials.storeId
      : typeof wc.metadata === "object" &&
          wc.metadata &&
          !Array.isArray(wc.metadata) &&
          (typeof (wc.metadata as Record<string, unknown>).storeId === "string" ||
            typeof (wc.metadata as Record<string, unknown>).storeId === "number")
        ? (wc.metadata as Record<string, unknown>).storeId
        : null;

  const accessToken =
    typeof wc.credentials.accessToken === "string"
      ? wc.credentials.accessToken.trim()
      : "";
  if (storeIdRaw == null || !accessToken) return null;

  const app = await resolvePlatformApp("NUVEMSHOP");
  const clientId =
    app?.credentials.clientId?.trim() ||
    process.env.NUVEMSHOP_CLIENT_ID?.trim() ||
    "atrako";
  const userAgent = `Atrako (${clientId})`;

  return {
    storeId: String(storeIdRaw),
    accessToken,
    clientId,
    userAgent,
  };
}

export async function nuvemshopFetch<T = unknown>(
  workspaceId: string,
  path: string,
  init?: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string | number | undefined | null>;
    body?: unknown;
  },
): Promise<T> {
  const conn = await resolveNuvemshopConnection(workspaceId);
  if (!conn) throw new Error("Nuvemshop não conectado");

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(
    `${NUVEMSHOP_API_BASE}/${conn.storeId}${cleanPath}`,
  );
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const method = init?.method ?? (init?.body ? "POST" : "GET");
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authentication: `bearer ${conn.accessToken}`,
      "User-Agent": conn.userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`nuvemshop_api:${res.status}:${text.slice(0, 200)}`);
  }
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`nuvemshop_api_parse:${text.slice(0, 200)}`);
  }
}

export async function nuvemshopFetchWithCreds<T = unknown>(input: {
  storeId: string;
  accessToken: string;
  clientId: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}): Promise<T> {
  const cleanPath = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const url = `${NUVEMSHOP_API_BASE}/${input.storeId}${cleanPath}`;
  const res = await fetch(url, {
    method: input.method ?? (input.body ? "POST" : "GET"),
    headers: {
      Authentication: `bearer ${input.accessToken}`,
      "User-Agent": `Atrako (${input.clientId})`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: input.body != null ? JSON.stringify(input.body) : undefined,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`nuvemshop_api:${res.status}:${text.slice(0, 200)}`);
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
}
