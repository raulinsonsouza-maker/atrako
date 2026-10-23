/**
 * Rate limit em memória (janela fixa por chave). Vale por processo — suficiente para o
 * container único da VPS; com várias réplicas cada uma conta separado.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

/** `true` quando ainda cabe; `false` quando a chave estourou `limit` dentro de `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** Envio mínimo plausível de um humano preenchendo o formulário. */
const MIN_FILL_MS = 2500;

/**
 * Formulário público: campo-isca `website` preenchido ou envio rápido demais = robô.
 * `startedAt` é opcional (só os formulários novos mandam).
 */
export function looksLikeBot(input: Record<string, unknown>): boolean {
  if (typeof input.website === "string" && input.website.trim()) return true;
  const started = Number(input.startedAt);
  return Number.isFinite(started) && started > 0 && Date.now() - started < MIN_FILL_MS;
}
