/**
 * Resend REST API — sem SDK. Throttle por API key (padrão 2 req/s) + retry com backoff em 429/5xx.
 * Doc: https://resend.com/docs/api-reference
 * Nunca logar a API key.
 */

const API = "https://api.resend.com";
const MIN_INTERVAL_MS = 520;
const lastCallByKey = new Map<string, number>();

async function throttle(apiKey: string) {
  const last = lastCallByKey.get(apiKey) ?? 0;
  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallByKey.set(apiKey, Date.now());
}

export class ResendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function resendFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit & { idempotencyKey?: string; retries?: number },
): Promise<T> {
  const retries = init?.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    await throttle(apiKey);
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${apiKey}`);
    if (init?.body) headers.set("Content-Type", "application/json");
    if (init?.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);
    const res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 800 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(backoff, 10_000)));
      continue;
    }
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (!res.ok) {
      const msg =
        (json as { message?: string; error?: string }).message ||
        (json as { error?: string }).error ||
        `Resend HTTP ${res.status}`;
      throw new ResendError(msg, res.status);
    }
    return json as T;
  }
}

export type ResendDomain = {
  id: string;
  name: string;
  status: string;
  created_at?: string;
  region?: string;
};

export async function listResendDomains(apiKey: string) {
  const r = await resendFetch<{ data?: ResendDomain[] }>(apiKey, "/domains");
  return r.data ?? [];
}

/** Clique fica com o nosso /r/{token}; Resend só mede abertura e entrega. */
export async function configureResendDomainTracking(apiKey: string, domainId: string) {
  return resendFetch(apiKey, `/domains/${domainId}`, {
    method: "PATCH",
    body: JSON.stringify({ click_tracking: false, open_tracking: true }),
  });
}

export const RESEND_WEBHOOK_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.failed",
];

export async function createResendWebhook(apiKey: string, endpoint: string) {
  return resendFetch<{ id?: string; signing_secret?: string }>(apiKey, "/webhooks", {
    method: "POST",
    body: JSON.stringify({ endpoint, events: RESEND_WEBHOOK_EVENTS }),
  });
}

export type ResendEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export async function sendResendEmail(
  apiKey: string,
  payload: ResendEmailPayload,
  idempotencyKey?: string,
) {
  return resendFetch<{ id: string }>(apiKey, "/emails", {
    method: "POST",
    body: JSON.stringify(payload),
    idempotencyKey,
  });
}

/** Até 100 por chamada. Retorna ids na mesma ordem. */
export async function sendResendBatch(
  apiKey: string,
  payloads: ResendEmailPayload[],
  idempotencyKey?: string,
) {
  if (payloads.length > 100) throw new Error("Resend batch: máximo 100 e-mails por chamada");
  const r = await resendFetch<{ data?: Array<{ id: string }> }>(apiKey, "/emails/batch", {
    method: "POST",
    body: JSON.stringify(payloads),
    idempotencyKey,
  });
  return r.data ?? [];
}

export type ResendListedEmail = {
  id: string;
  to?: string[];
  subject?: string;
  last_event?: string;
  created_at?: string;
};

export async function listResendEmails(apiKey: string, opts?: { limit?: number; after?: string }) {
  const q = new URLSearchParams();
  q.set("limit", String(opts?.limit ?? 100));
  if (opts?.after) q.set("after", opts.after);
  return resendFetch<{ data?: ResendListedEmail[]; has_more?: boolean }>(
    apiKey,
    `/emails?${q.toString()}`,
  );
}

export async function getResendEmail(apiKey: string, id: string) {
  return resendFetch<ResendListedEmail>(apiKey, `/emails/${id}`);
}
