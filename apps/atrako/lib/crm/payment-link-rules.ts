/** Regras puras do link de pagamento do lead (sem banco), testáveis isoladamente. */

export const PAYLINK_REF_PREFIX = "paylink:";
export const PAYLINK_MAX_INSTALLMENTS = 12;
export const PAYLINK_TTL_DAYS = 7;
const MIN_CENTS = 100;
const MAX_CENTS = 100_000_000;

export type PaymentLinkStatus = "PENDING" | "PAID" | "CANCELED" | "EXPIRED" | "REFUNDED";

export type PaymentLinkInput = {
  amountCents: number;
  maxInstallments: number;
  description: string;
};

export function validatePaymentLinkInput(raw: {
  amountCents?: unknown;
  maxInstallments?: unknown;
  description?: unknown;
}): { ok: true; value: PaymentLinkInput } | { ok: false; error: string } {
  const amountCents = Math.round(Number(raw.amountCents));
  if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS) {
    return { ok: false, error: "Informe um valor de pelo menos R$ 1,00." };
  }
  if (amountCents > MAX_CENTS) return { ok: false, error: "Valor acima do limite do link." };
  const maxInstallments = Math.floor(Number(raw.maxInstallments ?? 1));
  if (!Number.isFinite(maxInstallments) || maxInstallments < 1 || maxInstallments > PAYLINK_MAX_INSTALLMENTS) {
    return { ok: false, error: `Parcelas entre 1 e ${PAYLINK_MAX_INSTALLMENTS}.` };
  }
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 200) : "";
  if (description.length < 3) return { ok: false, error: "Descreva o que está sendo cobrado." };
  return { ok: true, value: { amountCents, maxInstallments, description } };
}

/** Status visto pelo lead/equipe: pendente vencido aparece como expirado mesmo antes do banco atualizar. */
export function paymentLinkViewStatus(
  link: { status: string; expiresAt: Date | null },
  now = new Date(),
): PaymentLinkStatus {
  if (link.status === "PENDING" && link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return link.status as PaymentLinkStatus;
}

/** Parcelas do cartão limitadas ao máximo negociado no link. */
export function capInstallmentOptions<T extends { installments: number }>(options: T[], maxInstallments: number): T[] {
  return options.filter((o) => o.installments >= 1 && o.installments <= maxInstallments);
}

export function isValidInstallmentChoice(installments: unknown, maxInstallments: number) {
  const n = Number(installments);
  return Number.isInteger(n) && n >= 1 && n <= Math.min(maxInstallments, PAYLINK_MAX_INSTALLMENTS);
}

export function paymentLinkExpiry(from = new Date()) {
  return new Date(from.getTime() + PAYLINK_TTL_DAYS * 86_400_000);
}

/**
 * URL pública: domínio do cliente em produção; em dev, `<lp>.localhost` na porta do app.
 * Sem domínio próprio, cai no domínio do Atrako.
 */
export function paymentLinkUrl(input: {
  token: string;
  lpHost: string | null;
  origin: string;
  production: boolean;
}) {
  const path = `/pagar/${encodeURIComponent(input.token)}`;
  if (!input.lpHost) return `${input.origin}${path}`;
  if (input.production) return `https://${input.lpHost}${path}`;
  let port = "";
  try {
    port = new URL(input.origin).port;
  } catch {
    /* origem inválida: sem porta */
  }
  return `http://${input.lpHost.replace(/\.[a-z]+$/, ".localhost")}${port ? `:${port}` : ""}${path}`;
}

export function shortLinkRef(id: string) {
  return id.slice(-6).toUpperCase();
}
