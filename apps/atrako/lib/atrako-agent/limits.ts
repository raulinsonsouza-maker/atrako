import { prisma } from "@/lib/db";

/** Limites de uso do Atrako por workspace (protege a conta de IA do cliente). */
export const ASSISTANT_LIMITS = {
  perMinute: Number(process.env.ATRAKO_ASSISTANT_PER_MINUTE ?? "12"),
  perDay: Number(process.env.ATRAKO_ASSISTANT_PER_DAY ?? "400"),
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number; message: string };

export function evaluateRateLimit(
  counts: { lastMinute: number; lastDay: number },
  limits = ASSISTANT_LIMITS,
): RateLimitResult {
  if (counts.lastMinute >= limits.perMinute) {
    return { ok: false, retryAfterSec: 60, message: "Muitas perguntas seguidas. Espere um minuto e tente de novo." };
  }
  if (counts.lastDay >= limits.perDay) {
    return {
      ok: false,
      retryAfterSec: 3600,
      message: "O limite diário de perguntas do Atrako neste workspace foi atingido. Volte amanhã ou fale com o suporte.",
    };
  }
  return { ok: true };
}

export async function checkAssistantRateLimit(clienteId: string, now = new Date()): Promise<RateLimitResult> {
  const where = (since: Date) => ({ clienteId, role: "USER", createdAt: { gte: since } });
  const [lastMinute, lastDay] = await Promise.all([
    prisma.atrakoMessage.count({ where: where(new Date(now.getTime() - 60_000)) }),
    prisma.atrakoMessage.count({ where: where(new Date(now.getTime() - 86_400_000)) }),
  ]);
  return evaluateRateLimit({ lastMinute, lastDay });
}
