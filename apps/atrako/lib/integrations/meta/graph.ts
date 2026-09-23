/**
 * Meta Graph API — client HTTP compartilhado (Login for Business + Marketing API).
 * Tokens vêm de WorkspaceConnection; nunca logar access_token / appsecret_proof.
 * Doc: https://developers.facebook.com/docs/graph-api
 */

import { createHmac } from "crypto";

export const META_GRAPH_VERSION =
  process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
    public isTransient = false,
    public needsReauth = false,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

export function metaGraphUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `https://graph.facebook.com/${META_GRAPH_VERSION}${p}`;
}

export function getMetaAppSecret(): string | null {
  return (
    process.env.META_APP_SECRET?.trim() ||
    process.env.SYMBIUS_META_APP_SECRET?.trim() ||
    process.env.SYMBIUS_IG_APP_SECRET?.trim() ||
    null
  );
}

export function getMetaAppId(): string | null {
  return (
    process.env.META_APP_ID?.trim() ||
    process.env.SYMBIUS_META_APP_ID?.trim() ||
    process.env.SYMBIUS_IG_APP_ID?.trim() ||
    null
  );
}

/** HMAC-SHA256(access_token, app_secret) — required when App Secret Proof is enabled. */
export function generateMetaAppSecretProof(accessToken: string): string | null {
  const secret = getMetaAppSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(accessToken).digest("hex");
}

function classifyMetaError(
  status: number,
  body: { error?: { message?: string; code?: number; error_subcode?: number; type?: string } },
): MetaGraphError {
  const err = body.error;
  const message = err?.message ?? `Meta Graph ${status}`;
  const code = err?.code;
  const subcode = err?.error_subcode;
  const lower = message.toLowerCase();
  const isTransient =
    status === 429 ||
    status === 503 ||
    lower.includes("rate limit") ||
    lower.includes("temporarily") ||
    lower.includes("try again") ||
    lower.includes("unknown error") ||
    code === 1 ||
    code === 2 ||
    code === 17 ||
    code === 32 ||
    code === 613;
  const needsReauth =
    code === 190 ||
    code === 102 ||
    lower.includes("session has expired") ||
    lower.includes("invalid oauth") ||
    lower.includes("error validating access token") ||
    lower.includes("permission denied") ||
    lower.includes("permissions error");
  return new MetaGraphError(message, status, code, subcode, isTransient, needsReauth);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function metaGraphRequest(
  path: string,
  accessToken: string,
  options?: {
    method?: "GET" | "POST" | "DELETE";
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    maxRetries?: number;
  },
): Promise<Record<string, unknown>> {
  const method = options?.method ?? "GET";
  const maxRetries = options?.maxRetries ?? 3;
  const url = new URL(metaGraphUrl(path));
  url.searchParams.set("access_token", accessToken);
  const proof = generateMetaAppSecretProof(accessToken);
  if (proof) url.searchParams.set("appsecret_proof", proof);
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
  }

  let lastError: MetaGraphError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url.toString(), {
      method,
      cache: "no-store",
      headers:
        method !== "GET" && options?.body
          ? { "Content-Type": "application/json" }
          : undefined,
      body: method !== "GET" && options?.body ? JSON.stringify(options.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; error_subcode?: number; type?: string };
    };
    if (res.ok && !json.error) {
      return json as Record<string, unknown>;
    }
    lastError = classifyMetaError(res.status, json);
    if (!lastError.isTransient || attempt === maxRetries) break;
    await sleep(Math.min(8000, 500 * 2 ** attempt));
  }
  throw lastError ?? new MetaGraphError("Meta Graph request failed", 500);
}

export async function metaGraphGet(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
) {
  return metaGraphRequest(path, accessToken, { method: "GET", params });
}

export async function metaGraphPost(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>,
) {
  return metaGraphRequest(path, accessToken, { method: "POST", body, params });
}

/** POST form-urlencoded (adimages / alguns edges de Marketing API). */
export async function metaGraphPostForm(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(metaGraphUrl(path));
  const proof = generateMetaAppSecretProof(accessToken);
  const body = new URLSearchParams();
  body.set("access_token", accessToken);
  if (proof) body.set("appsecret_proof", proof);
  for (const [k, v] of Object.entries(fields)) body.set(k, v);

  const res = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || json.error) {
    throw classifyMetaError(res.status, json);
  }
  return json as Record<string, unknown>;
}

type Paginated<T> = {
  data?: T[];
  paging?: { next?: string };
};

/** Percorre paging.next até o fim (proteção contra loop). */
export async function fetchMetaPaginated<T>(
  firstPath: string,
  accessToken: string,
  params?: Record<string, string>,
  options?: { maxPages?: number },
): Promise<T[]> {
  const maxPages = options?.maxPages ?? 50;
  const all: T[] = [];
  let page = 0;
  let nextUrl: string | null = null;

  const first = (await metaGraphGet(firstPath, accessToken, {
    ...params,
    limit: params?.limit ?? "100",
  })) as Paginated<T>;
  if (first.data?.length) all.push(...first.data);
  nextUrl = first.paging?.next ?? null;
  page++;

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as Paginated<T> & {
      error?: { message?: string; code?: number };
    };
    if (!res.ok || json.error) {
      throw classifyMetaError(res.status, json);
    }
    if (json.data?.length) all.push(...json.data);
    nextUrl = json.paging?.next ?? null;
    page++;
  }
  return all;
}

export function normalizeAdAccountId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("act_")) return trimmed.slice(4);
  return trimmed;
}

export function ensureActPrefix(accountId: string): string {
  const trimmed = accountId.trim();
  if (trimmed.startsWith("act_")) return trimmed;
  return `act_${trimmed}`;
}
