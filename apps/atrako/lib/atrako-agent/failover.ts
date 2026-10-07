import "server-only";
import { prisma } from "@/lib/db";

/**
 * Failover da cadeia de modelos: classifica a falha de um provedor e decide
 * quanto tempo o modelo fica "em descanso" antes de voltar à cadeia.
 */

export type LlmFailure = {
  status: number | null;
  cooldownMs: number;
  reason: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function headerValue(headers: unknown, name: string): string | null {
  if (!headers) return null;
  const h = headers as { get?: (n: string) => string | null } & Record<string, unknown>;
  if (typeof h.get === "function") return h.get(name);
  const raw = h[name] ?? h[name.toLowerCase()];
  return typeof raw === "string" ? raw : null;
}

/** `X-RateLimit-Reset` vem em epoch (ms no OpenRouter, s em outros). */
function resetFromHeaders(headers: unknown, now: number): number | null {
  const raw = headerValue(headers, "x-ratelimit-reset");
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  return ms > now ? ms - now : null;
}

function msUntilNextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

/** "try again in 1m5.3s" (Groq), "retry after 10 seconds", `retry-after-ms` / `retry-after` (s ou data HTTP). */
function retryHintMs(headers: unknown, message: string, now: number): number | null {
  const ms = Number(headerValue(headers, "retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return ms;
  const raw = headerValue(headers, "retry-after");
  if (raw) {
    const secs = Number(raw);
    if (Number.isFinite(secs) && secs > 0) return secs * 1000;
    const at = Date.parse(raw);
    if (Number.isFinite(at) && at > now) return at - now;
  }
  const tryAgain = message.match(/try again in\s+([\d.]+ms|(?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+s)?)\b/);
  if (tryAgain?.[1]) {
    const t = tryAgain[1];
    if (/^[\d.]+ms$/.test(t)) return parseFloat(t);
    const h = Number(t.match(/(\d+)h/)?.[1] ?? 0);
    const m = Number(t.match(/(\d+)m(?!s)/)?.[1] ?? 0);
    const s = Number(t.match(/([\d.]+)s/)?.[1] ?? 0);
    const total = (h * 3600 + m * 60 + s) * 1000;
    if (total > 0) return total;
  }
  const retryAfter = message.match(/retry after\s+([\d.]+)\s*(?:s|sec|seconds?)\b/);
  if (retryAfter) return parseFloat(retryAfter[1]) * 1000;
  return null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function classifyLlmFailure(err: unknown, now = Date.now()): LlmFailure {
  const e = err as { status?: number; headers?: unknown; message?: string; name?: string; code?: string };
  const status = typeof e?.status === "number" ? e.status : null;
  const message = `${e?.message ?? ""} ${e?.code ?? ""}`.toLowerCase();

  if (status === 413 || /request too large|request entity too large/.test(message)) {
    return { status: 413, cooldownMs: HOUR, reason: "pedido grande demais" };
  }
  if (status === 429 || /rate.?limit|too many (?:concurrent )?requests/.test(message)) {
    if (/month/.test(message)) return { status: 429, cooldownMs: 24 * HOUR, reason: "cota mensal esgotada" };
    const daily = /per.?day|daily|free-models-per-day|quota/.test(message);
    const reason = daily ? "limite diário" : "limite por minuto";
    const hint = retryHintMs(e?.headers, message, now);
    if (hint) return { status: 429, cooldownMs: clamp(hint, 5_000, HOUR), reason };
    const reset = resetFromHeaders(e?.headers, now);
    if (daily) return { status: 429, cooldownMs: reset ?? msUntilNextUtcMidnight(now), reason };
    return { status: 429, cooldownMs: reset && reset <= HOUR ? reset : MINUTE, reason };
  }
  if (status === 402) return { status, cooldownMs: HOUR, reason: "sem créditos" };
  if (status === 401 || status === 403) return { status, cooldownMs: 6 * HOUR, reason: "chave recusada" };
  if (status === 404 || status === 410) return { status, cooldownMs: 24 * HOUR, reason: "modelo indisponível" };
  if (status === 400 || status === 422) return { status, cooldownMs: 10 * MINUTE, reason: "requisição recusada" };
  return { status, cooldownMs: 2 * MINUTE, reason: status ? `instável (${status})` : "sem resposta" };
}

/* ── Estado de descanso (banco + cache curto em memória) ── */

export type CooldownInfo = { until: Date; status: number | null; reason: string | null };

const CACHE_MS = 15_000;
let cache: { at: number; rows: Map<string, CooldownInfo> } | null = null;

async function loadActive(): Promise<Map<string, CooldownInfo>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.rows;
  const rows = await prisma.atrakoLlmCooldown
    .findMany({ where: { until: { gt: new Date(now) } } })
    .catch(() => []);
  const map = new Map(rows.map((r) => [r.key, { until: r.until, status: r.status, reason: r.reason }]));
  cache = { at: now, rows: map };
  return map;
}

export async function getActiveCooldowns(): Promise<Map<string, CooldownInfo>> {
  const now = Date.now();
  const rows = await loadActive();
  return new Map([...rows].filter(([, info]) => info.until.getTime() > now));
}

export async function setCooldown(key: string, failure: LlmFailure): Promise<void> {
  const until = new Date(Date.now() + failure.cooldownMs);
  const info = { until, status: failure.status, reason: failure.reason.slice(0, 160) };
  cache?.rows.set(key, info);
  await prisma.atrakoLlmCooldown
    .upsert({
      where: { key },
      create: { key, ...info },
      update: info,
    })
    .catch((error) => console.warn("[atrako-agent] cooldown", error instanceof Error ? error.message : error));
}

/** Ao trocar a IA do workspace, a nova chave não herda o descanso da anterior. */
export async function clearCooldowns(prefix: string): Promise<void> {
  if (cache) for (const key of [...cache.rows.keys()]) if (key.startsWith(prefix)) cache.rows.delete(key);
  await prisma.atrakoLlmCooldown.deleteMany({ where: { key: { startsWith: prefix } } }).catch(() => {});
}
