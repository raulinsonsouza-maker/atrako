import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";

export type LedgerType = "INCOME" | "EXPENSE" | "REFUND";
export type LedgerStatus = "PENDING" | "CONFIRMED" | "CANCELED";

export async function upsertLedgerEntry(input: {
  clienteId: string;
  type: LedgerType;
  amount: number;
  currency?: string;
  status?: LedgerStatus;
  occurredAt: Date;
  source: string;
  sourceRef?: string | null;
  idempotencyKey: string;
  leadId?: string | null;
  contact?: string | null;
  provider?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const amount = new Prisma.Decimal(input.amount);
  return prisma.workspaceLedgerEntry.upsert({
    where: {
      clienteId_idempotencyKey: {
        clienteId: input.clienteId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      clienteId: input.clienteId,
      type: input.type,
      amount,
      currency: input.currency ?? "BRL",
      status: input.status ?? "CONFIRMED",
      occurredAt: input.occurredAt,
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      idempotencyKey: input.idempotencyKey,
      leadId: input.leadId ?? null,
      contact: input.contact ?? null,
      provider: input.provider ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? undefined,
    },
    update: {
      type: input.type,
      amount,
      status: input.status ?? "CONFIRMED",
      occurredAt: input.occurredAt,
      sourceRef: input.sourceRef ?? undefined,
      leadId: input.leadId ?? undefined,
      contact: input.contact ?? undefined,
      provider: input.provider ?? undefined,
      description: input.description ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function listLedgerEntries(input: {
  clienteId: string;
  from?: Date;
  to?: Date;
  source?: string;
  take?: number;
}) {
  return prisma.workspaceLedgerEntry.findMany({
    where: {
      clienteId: input.clienteId,
      ...(input.source ? { source: input.source } : {}),
      ...(input.from || input.to
        ? {
            occurredAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: input.take ?? 200,
  });
}

export async function summarizeLedger(clienteId: string, from?: Date, to?: Date) {
  const entries = await listLedgerEntries({ clienteId, from, to, take: 5000 });
  let income = 0;
  let expense = 0;
  let refund = 0;
  for (const e of entries) {
    if (e.status !== "CONFIRMED") continue;
    const n = Number(e.amount);
    if (e.type === "INCOME") income += n;
    else if (e.type === "EXPENSE") expense += n;
    else if (e.type === "REFUND") refund += n;
  }
  return {
    income,
    expense,
    refund,
    net: income - expense - refund,
    count: entries.length,
  };
}

function numFromPayload(payload: Record<string, unknown>): number | null {
  const raw = payload.amount ?? payload.valor ?? payload.value ?? payload.total;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Mapeia eventos de pagamento/receita para o ledger. */
export async function ingestFinanceFromEvent(input: {
  workspaceId: string;
  eventName: string;
  source: string;
  idempotencyKey: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
  occurredAt: Date;
}) {
  const amount = numFromPayload(input.payload);
  if (amount == null || amount === 0) return null;

  const leadId =
    typeof input.context.leadId === "string" ? input.context.leadId : null;
  const contact =
    typeof input.payload.email === "string"
      ? input.payload.email
      : typeof input.payload.contact === "string"
        ? input.payload.contact
        : null;

  if (input.eventName === "payment.paid" || input.eventName === "order.completed" || input.eventName === "revenue.recorded") {
    return upsertLedgerEntry({
      clienteId: input.workspaceId,
      type: "INCOME",
      amount,
      occurredAt: input.occurredAt,
      source: input.source || "system",
      sourceRef:
        (typeof input.context.paymentId === "string" && input.context.paymentId) ||
        (typeof input.context.orderId === "string" && input.context.orderId) ||
        (typeof input.payload.orderId === "string" && input.payload.orderId) ||
        null,
      idempotencyKey: `ledger:${input.idempotencyKey}`,
      leadId,
      contact,
      provider:
        typeof input.payload.provider === "string"
          ? input.payload.provider
          : "MERCADO_PAGO",
      description:
        typeof input.payload.description === "string"
          ? input.payload.description
          : input.eventName,
      metadata: { eventName: input.eventName, payload: input.payload },
    });
  }

  if (input.eventName === "checkout.abandoned") return null;

  return null;
}
