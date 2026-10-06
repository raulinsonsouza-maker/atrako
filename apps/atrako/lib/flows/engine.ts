/**
 * Motor de fluxos: matrícula, saída e execução dos passos vencidos.
 * Claim com lease (FOR UPDATE SKIP LOCKED) — dois workers nunca enviam o mesmo passo.
 * Proteções: janela no fuso do workspace, frequência por contato, prioridade entre fluxos,
 * pausa quando o cliente responde, saídas reavaliadas antes de cada envio.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { loadMessagingPrefs, type MessagingPrefs } from "@/lib/flows/prefs";
import { nextAllowedTime, nextDayStart } from "@/lib/flows/dates";
import { isEmailContent, type EmailContent, type WhatsAppContent } from "@/lib/flows/types";
import { emailContentProblems, sanitizeEmailContent } from "@/lib/flows/render-email";
import { sendEmailMessage, sendWhatsAppMessage, type FlowContextData, type SendResult } from "@/lib/flows/send";
import { resendReady, resolveResend } from "@/lib/integrations/resend/connection";

export const FLOW_TRIGGERS = [
  "cart_abandoned",
  "cart_aging_30",
  "cart_aging_60",
  "cart_aging_90",
  "order_unpaid",
  "order_paid",
  "second_purchase",
  "repurchase_due",
  "winback",
  "lead_lost",
  "lead_welcome",
  "date_based",
] as const;
export type FlowTrigger = (typeof FLOW_TRIGGERS)[number];

/** Fluxos de venda: qualquer compra encerra. Pós-compra (order_paid) não. */
export const SALES_TRIGGERS: FlowTrigger[] = [
  "cart_abandoned",
  "cart_aging_30",
  "cart_aging_60",
  "cart_aging_90",
  "order_unpaid",
  "second_purchase",
  "repurchase_due",
  "winback",
  "lead_lost",
  "lead_welcome",
];

/** Transacionais: não contam no limite de e-mail de marketing. */
const TRANSACTIONAL_TRIGGERS = new Set<string>(["order_unpaid"]);

const LEASE_MS = 10 * 60_000;
const HOUR = 3_600_000;
const MAX_HOLD_MS = 48 * HOUR;

export type EnrollmentContext = FlowContextData & {
  startAt?: string;
  attempts?: number;
  heldSince?: string;
  [key: string]: unknown;
};

function ctxOf(raw: unknown): EnrollmentContext {
  return (raw && typeof raw === "object" ? raw : {}) as EnrollmentContext;
}

// --------------------------------------------------------------------------- matrícula

/** Unique é (flowId, dedupeKey): a chave sempre inclui o contato. */
function dedupeFor(contactId: string, key: string | null) {
  return key ? `${contactId}:${key}`.slice(0, 160) : null;
}

export async function enrollContact(input: {
  clienteId: string;
  trigger: FlowTrigger;
  contactId: string;
  leadId?: string | null;
  refType?: "cart" | "order" | "date" | "lead" | null;
  refId?: string | null;
  context?: EnrollmentContext;
  dedupeKey?: string | null;
  flowIds?: string[];
  startAt?: Date;
}): Promise<{ enrolled: number; enrollmentIds: string[] }> {
  const flows = await prisma.messageFlow.findMany({
    where: {
      clienteId: input.clienteId,
      trigger: input.trigger,
      status: "ACTIVE",
      ...(input.flowIds?.length ? { id: { in: input.flowIds } } : {}),
    },
    include: { steps: { where: { enabled: true }, orderBy: { position: "asc" } } },
  });
  if (!flows.length) return { enrolled: 0, enrollmentIds: [] };

  const contact = await prisma.nativeContact.findFirst({
    where: { id: input.contactId, clienteId: input.clienteId },
    select: { id: true, emailOptOutAt: true, waOptOutAt: true, email: true, phone: true },
  });
  if (!contact) return { enrolled: 0, enrollmentIds: [] };
  if (contact.emailOptOutAt && contact.waOptOutAt) return { enrolled: 0, enrollmentIds: [] };

  const startAt = input.startAt ?? new Date();
  const ids: string[] = [];
  for (const flow of flows) {
    if (!flow.steps.length) continue;
    const settings = (flow.settings ?? {}) as { dailyEnrollCap?: number };
    if (settings.dailyEnrollCap && settings.dailyEnrollCap > 0) {
      const today = await prisma.messageFlowEnrollment.count({
        where: { flowId: flow.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      });
      if (today >= settings.dailyEnrollCap) continue;
    }
    const active = await prisma.messageFlowEnrollment.findFirst({
      where: { flowId: flow.id, contactId: contact.id, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true },
    });
    if (active) continue;

    const holdout = flow.holdoutPercent > 0 && Math.random() * 100 < flow.holdoutPercent;
    try {
      const e = await prisma.messageFlowEnrollment.create({
        data: {
          clienteId: input.clienteId,
          flowId: flow.id,
          contactId: contact.id,
          leadId: input.leadId ?? null,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
          status: "ACTIVE",
          stepIndex: 0,
          nextRunAt: new Date(startAt.getTime() + flow.steps[0].delayMinutes * 60_000),
          context: { ...(input.context ?? {}), startAt: startAt.toISOString() } as Prisma.InputJsonValue,
          holdout,
          dedupeKey: dedupeFor(contact.id, input.dedupeKey ?? (input.refId ? `${input.refType}:${input.refId}` : null)),
        },
      });
      ids.push(e.id);
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }
  return { enrolled: ids.length, enrollmentIds: ids };
}

// --------------------------------------------------------------------------- saída

export async function exitEnrollments(input: {
  clienteId: string;
  contactId: string;
  reason: string;
  triggers?: FlowTrigger[];
  refType?: string;
  refId?: string;
  /** Supressão só de um canal: sai apenas se o contato não tiver o outro canal. */
  channel?: "EMAIL" | "WHATSAPP";
  conversion?: { orderRef: string; cents: number; at: Date };
  exceptEnrollmentId?: string;
}) {
  if (input.channel) {
    const c = await prisma.nativeContact.findUnique({
      where: { id: input.contactId },
      select: { phone: true, phoneE164: true, waOptOutAt: true, email: true, emailOptOutAt: true, emailBouncedAt: true },
    });
    const otherAvailable =
      input.channel === "EMAIL"
        ? Boolean((c?.phoneE164 || c?.phone) && !c?.waOptOutAt)
        : Boolean(c?.email && !c?.emailOptOutAt && !c?.emailBouncedAt);
    if (otherAvailable) return { exited: 0 };
  }
  const where: Prisma.MessageFlowEnrollmentWhereInput = {
    clienteId: input.clienteId,
    contactId: input.contactId,
    status: { in: ["ACTIVE", "PAUSED"] },
    ...(input.triggers ? { flow: { trigger: { in: input.triggers } } } : {}),
    ...(input.refType ? { refType: input.refType } : {}),
    ...(input.refId ? { refId: input.refId } : {}),
    ...(input.exceptEnrollmentId ? { id: { not: input.exceptEnrollmentId } } : {}),
  };
  const r = await prisma.messageFlowEnrollment.updateMany({
    where,
    data: input.conversion
      ? {
          status: "CONVERTED",
          exitReason: input.reason,
          convertedOrderRef: input.conversion.orderRef.slice(0, 160),
          convertedCents: input.conversion.cents,
          convertedAt: input.conversion.at,
          nextRunAt: null,
          leaseUntil: null,
        }
      : { status: "EXITED", exitReason: input.reason, nextRunAt: null, leaseUntil: null },
  });
  return { exited: r.count };
}

/** Cliente respondeu (WA/handoff/reply): pausa fluxos de venda por N horas. */
export async function pauseContactFlows(clienteId: string, contactId: string, hours?: number) {
  const h = hours ?? (await loadMessagingPrefs(clienteId)).prefs.replyPauseHours;
  if (h <= 0) return;
  await prisma.nativeContact.updateMany({
    where: { id: contactId, clienteId },
    data: { flowsPausedUntil: new Date(Date.now() + h * HOUR) },
  });
}

/** Ações manuais do card do lead. */
export async function setEnrollmentStatus(
  clienteId: string,
  enrollmentId: string,
  action: "pause" | "resume" | "remove",
) {
  const e = await prisma.messageFlowEnrollment.findFirst({ where: { id: enrollmentId, clienteId } });
  if (!e) return null;
  if (action === "remove") {
    return prisma.messageFlowEnrollment.update({
      where: { id: e.id },
      data: { status: "EXITED", exitReason: "removed_manually", nextRunAt: null },
    });
  }
  if (action === "pause") {
    return prisma.messageFlowEnrollment.update({ where: { id: e.id }, data: { status: "PAUSED" } });
  }
  return prisma.messageFlowEnrollment.update({
    where: { id: e.id },
    data: { status: "ACTIVE", nextRunAt: e.nextRunAt && e.nextRunAt > new Date() ? e.nextRunAt : new Date() },
  });
}

// --------------------------------------------------------------------------- execução

async function claimDue(now: Date, limit: number): Promise<string[]> {
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "MessageFlowEnrollment" AS e
    SET "leaseUntil" = ${leaseUntil}
    WHERE e.id IN (
      SELECT e2.id FROM "MessageFlowEnrollment" e2
      JOIN "MessageFlow" f ON f.id = e2."flowId"
      WHERE e2.status = 'ACTIVE'
        AND e2."nextRunAt" <= ${now}
        AND (e2."leaseUntil" IS NULL OR e2."leaseUntil" < ${now})
      ORDER BY f.priority ASC, e2."nextRunAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF e2 SKIP LOCKED
    )
    RETURNING e.id`;
  return rows.map((r) => r.id);
}

type WsCache = Map<string, { prefs: MessagingPrefs; timezone: string; resendOk: boolean }>;

async function wsInfo(cache: WsCache, clienteId: string) {
  let v = cache.get(clienteId);
  if (!v) {
    const [m, conn] = await Promise.all([loadMessagingPrefs(clienteId), resolveResend(clienteId)]);
    v = { prefs: m.prefs, timezone: m.timezone, resendOk: resendReady(conn) };
    cache.set(clienteId, v);
  }
  return v;
}

export async function runDueSteps(opts?: { limit?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  const ids = await claimDue(now, opts?.limit ?? 200);
  const cache: WsCache = new Map();
  const stats = { claimed: ids.length, sent: 0, skipped: 0, deferred: 0, completed: 0, exited: 0, failed: 0 };
  for (const id of ids) {
    try {
      const r = await processEnrollment(id, now, cache);
      stats[r] += 1;
    } catch (err) {
      stats.failed += 1;
      console.warn("[flows] enrollment failed", id, err instanceof Error ? err.message : err);
      await prisma.messageFlowEnrollment
        .update({ where: { id }, data: { leaseUntil: null, nextRunAt: new Date(now.getTime() + HOUR) } })
        .catch(() => null);
    }
  }
  return stats;
}

type Outcome = "sent" | "skipped" | "deferred" | "completed" | "exited";

async function reschedule(id: string, at: Date, extra?: Prisma.MessageFlowEnrollmentUpdateInput): Promise<Outcome> {
  await prisma.messageFlowEnrollment.update({
    where: { id },
    data: { nextRunAt: at, leaseUntil: null, ...(extra ?? {}) },
  });
  return "deferred";
}

async function finish(id: string, status: "COMPLETED" | "EXITED", reason?: string): Promise<Outcome> {
  await prisma.messageFlowEnrollment.update({
    where: { id },
    data: { status, exitReason: reason ?? null, nextRunAt: null, leaseUntil: null },
  });
  return status === "COMPLETED" ? "completed" : "exited";
}

async function advance(
  e: { id: string; stepIndex: number; context: unknown },
  steps: Array<{ delayMinutes: number }>,
  now: Date,
  outcome: Outcome,
): Promise<Outcome> {
  const nextIndex = e.stepIndex + 1;
  const next = steps[nextIndex];
  const ctx = ctxOf(e.context);
  const cleanCtx = { ...ctx, attempts: 0, heldSince: undefined };
  if (!next) {
    await prisma.messageFlowEnrollment.update({
      where: { id: e.id },
      data: { status: "COMPLETED", stepIndex: nextIndex, nextRunAt: null, leaseUntil: null, context: cleanCtx as Prisma.InputJsonValue },
    });
    return outcome === "sent" ? "sent" : "completed";
  }
  const start = ctx.startAt ? new Date(ctx.startAt).getTime() : now.getTime();
  const at = new Date(Math.max(now.getTime() + 60_000, start + next.delayMinutes * 60_000));
  await prisma.messageFlowEnrollment.update({
    where: { id: e.id },
    data: { stepIndex: nextIndex, nextRunAt: at, leaseUntil: null, context: cleanCtx as Prisma.InputJsonValue },
  });
  return outcome;
}

function emailEligible(c: { email: string | null; emailOptOutAt: Date | null; emailBouncedAt: Date | null; emailComplainedAt: Date | null }) {
  return Boolean(c.email && /@/.test(c.email) && !c.emailOptOutAt && !c.emailBouncedAt && !c.emailComplainedAt);
}

async function emailsSentLast24h(contactId: string) {
  return prisma.messageDelivery.count({
    where: {
      contactId,
      channel: "EMAIL",
      isTest: false,
      status: { notIn: ["FAILED", "SKIPPED", "QUEUED"] },
      createdAt: { gte: new Date(Date.now() - 86_400_000) },
    },
  });
}

async function lastWaMarketingAt(contactId: string) {
  const d = await prisma.messageDelivery.findFirst({
    where: {
      contactId,
      channel: "WHATSAPP",
      isTest: false,
      pricingCategory: "marketing",
      status: { notIn: ["FAILED", "SKIPPED", "QUEUED", "BLOCKED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return d?.createdAt ?? null;
}

async function processEnrollment(id: string, now: Date, cache: WsCache): Promise<Outcome> {
  const e = await prisma.messageFlowEnrollment.findUnique({
    where: { id },
    include: {
      flow: { include: { steps: { where: { enabled: true }, orderBy: { position: "asc" } } } },
      contact: true,
    },
  });
  if (!e || e.status !== "ACTIVE") {
    if (e) await prisma.messageFlowEnrollment.update({ where: { id }, data: { leaseUntil: null } });
    return "skipped";
  }
  const { flow, contact } = e;
  const steps = flow.steps;
  const ctx = ctxOf(e.context);

  if (flow.status !== "ACTIVE") return reschedule(id, new Date(now.getTime() + HOUR));
  const step = steps[e.stepIndex];
  if (!step) return finish(id, "COMPLETED");

  // Saídas reavaliadas antes de cada envio
  if (e.refType === "cart" && e.refId) {
    const cart = await prisma.abandonedCart.findUnique({ where: { id: e.refId }, select: { status: true } });
    if (!cart || cart.status !== "OPEN") {
      return finish(id, "EXITED", cart ? `cart_${cart.status.toLowerCase()}` : "cart_removed");
    }
  }
  if (SALES_TRIGGERS.includes(flow.trigger as FlowTrigger) && flow.trigger !== "repurchase_due") {
    const profile = await prisma.customerProfile.findUnique({
      where: { contactId: contact.id },
      select: { lastOrderAt: true },
    });
    if (profile?.lastOrderAt && profile.lastOrderAt > e.createdAt) return finish(id, "EXITED", "purchased");
  }
  if (contact.emailOptOutAt && contact.waOptOutAt) return finish(id, "EXITED", "unsubscribed");

  if (contact.flowsPausedUntil && contact.flowsPausedUntil > now && flow.trigger !== "order_paid") {
    return reschedule(id, contact.flowsPausedUntil);
  }

  const ws = await wsInfo(cache, e.clienteId);
  const allowed = nextAllowedTime(now, ws.timezone, ws.prefs.sendStartHour, ws.prefs.sendEndHour);
  if (allowed > now) return reschedule(id, allowed);

  // Grupo de controle: percorre o fluxo sem enviar (mede conversão)
  if (e.holdout) return advance(e, steps, now, "skipped");

  const conditions = (step.conditions ?? {}) as {
    skipIfClickedPrevious?: boolean;
    requiresPhone?: boolean;
    requiresCoupon?: boolean;
    skipIfPurchased?: boolean;
    skipIfHasBirthday?: boolean;
  };
  if (conditions.skipIfHasBirthday) {
    const known = await prisma.contactImportantDate.count({ where: { contactId: contact.id, kind: "BIRTHDAY" } });
    if (known) return advance(e, steps, now, "skipped");
  }
  if (conditions.skipIfClickedPrevious) {
    const clicked = await prisma.messageDelivery.count({ where: { enrollmentId: e.id, clickedAt: { not: null } } });
    if (clicked) return advance(e, steps, now, "skipped");
  }
  if (conditions.skipIfPurchased) {
    const p = await prisma.customerProfile.findUnique({ where: { contactId: contact.id }, select: { lastOrderAt: true } });
    if (p?.lastOrderAt && p.lastOrderAt > e.createdAt) return advance(e, steps, now, "skipped");
  }

  const coupon = step.couponCode && step.couponConfirmed ? step.couponCode : null;
  // Passo de cupom sem cupom confirmado não sai (template WA exige o código)
  if (conditions.requiresCoupon && !coupon) return advance(e, steps, now, "skipped");
  const origin = {
    flowId: flow.id,
    flowKey: flow.key ?? `fluxo-${flow.id.slice(-6)}`,
    enrollmentId: e.id,
    stepId: step.id,
    stepPosition: e.stepIndex,
  };
  const data: FlowContextData = ctx;
  const transactional = TRANSACTIONAL_TRIGGERS.has(flow.trigger);

  // Já enviado (queda após envio, antes de avançar): não reenviar
  const already = await prisma.messageDelivery.findFirst({
    where: { enrollmentId: e.id, stepId: step.id, status: { notIn: ["FAILED", "SKIPPED", "QUEUED"] } },
    select: { id: true },
  });
  if (already) return advance(e, steps, now, "sent");

  const sendEmail = async (content: EmailContent): Promise<Outcome | SendResult> => {
    if (!emailEligible(contact)) return advance(e, steps, now, "skipped");
    if (!ws.resendOk) {
      const held = ctx.heldSince ? new Date(ctx.heldSince).getTime() : now.getTime();
      if (now.getTime() - held > MAX_HOLD_MS) return advance(e, steps, now, "skipped");
      return reschedule(id, new Date(now.getTime() + 6 * HOUR), {
        context: { ...ctx, heldSince: new Date(held).toISOString() } as Prisma.InputJsonValue,
      });
    }
    if (!transactional && (await emailsSentLast24h(contact.id)) >= ws.prefs.maxEmailsPerDay) {
      return reschedule(id, nextDayStart(now, ws.timezone, ws.prefs.sendStartHour));
    }
    const clean = sanitizeEmailContent(content);
    if (emailContentProblems(clean).length) return advance(e, steps, now, "skipped");
    return sendEmailMessage({
      clienteId: e.clienteId,
      contact,
      content: clean,
      couponCode: coupon,
      data,
      origin,
      idempotencyKey: `enr-${e.id}-${step.id}`,
    });
  };

  const handle = async (r: Outcome | SendResult): Promise<Outcome> => {
    if (typeof r === "string") return r;
    if (r.status === "SENT") return advance(e, steps, now, "sent");
    if (r.status === "FAILED") {
      const attempts = (ctx.attempts ?? 0) + 1;
      if (attempts >= 3) return advance(e, steps, now, "skipped");
      return reschedule(id, new Date(now.getTime() + attempts * HOUR), {
        context: { ...ctx, attempts } as Prisma.InputJsonValue,
      });
    }
    return advance(e, steps, now, "skipped");
  };

  if (step.channel === "EMAIL") {
    if (!isEmailContent(step.content)) return advance(e, steps, now, "skipped");
    return handle(await sendEmail(step.content as EmailContent));
  }

  // WHATSAPP
  const wa = (step.content ?? {}) as WhatsAppContent;
  const fallback = async (): Promise<Outcome> => {
    if (wa.fallbackEmail && isEmailContent(wa.fallbackEmail)) return handle(await sendEmail(wa.fallbackEmail));
    return advance(e, steps, now, "skipped");
  };
  if (conditions.requiresPhone && !(contact.phoneE164 || contact.phone)) return fallback();

  if (!transactional && ws.prefs.minHoursBetweenWa > 0) {
    const last = await lastWaMarketingAt(contact.id);
    if (last && now.getTime() - last.getTime() < ws.prefs.minHoursBetweenWa * HOUR) return fallback();
  }

  const r = await sendWhatsAppMessage({
    clienteId: e.clienteId,
    contact,
    content: wa,
    couponCode: coupon,
    data,
    origin,
    automatic: true,
    reservePercent: ws.prefs.waAutoReservePercent,
  });
  if (r.status === "SENT") return advance(e, steps, now, "sent");
  if (r.status === "DEFERRED") return reschedule(id, new Date(now.getTime() + 2 * HOUR));
  if (r.status === "HELD" && /template_(pending|paused|in_appeal)/.test(r.reason) && !wa.fallbackEmail) {
    const held = ctx.heldSince ? new Date(ctx.heldSince).getTime() : now.getTime();
    if (now.getTime() - held < MAX_HOLD_MS) {
      return reschedule(id, new Date(now.getTime() + 3 * HOUR), {
        context: { ...ctx, heldSince: new Date(held).toISOString() } as Prisma.InputJsonValue,
      });
    }
  }
  if (r.status === "FAILED" && !r.fallbackEmail) return handle(r);
  return fallback();
}

/**
 * Pós-envio assíncrono (webhook de status WA): 131049/131050 → e-mail do passo;
 * 132015 → volta o passo para a fila depois que o template for reaprovado.
 */
export async function handleAsyncWaFailure(deliveryId: string, effect: { fallbackEmail: boolean; requeue: boolean }) {
  const d = await prisma.messageDelivery.findUnique({
    where: { id: deliveryId },
    select: { enrollmentId: true, stepId: true, clienteId: true, contactId: true },
  });
  if (!d?.enrollmentId || !d.stepId) return;
  const e = await prisma.messageFlowEnrollment.findUnique({
    where: { id: d.enrollmentId },
    include: { flow: { include: { steps: { where: { enabled: true }, orderBy: { position: "asc" } } } }, contact: true },
  });
  if (!e) return;
  const idx = e.flow.steps.findIndex((s) => s.id === d.stepId);
  const step = e.flow.steps[idx];
  if (!step) return;

  if (effect.requeue && (e.status === "ACTIVE" || e.status === "COMPLETED") && e.stepIndex <= idx + 1) {
    await prisma.messageFlowEnrollment.update({
      where: { id: e.id },
      data: { status: "ACTIVE", stepIndex: idx, nextRunAt: new Date(Date.now() + 3 * HOUR), leaseUntil: null },
    });
    return;
  }
  if (effect.fallbackEmail) {
    const wa = (step.content ?? {}) as WhatsAppContent;
    if (!wa.fallbackEmail || !isEmailContent(wa.fallbackEmail) || !emailEligible(e.contact)) return;
    const coupon = step.couponCode && step.couponConfirmed ? step.couponCode : null;
    await sendEmailMessage({
      clienteId: e.clienteId,
      contact: e.contact,
      content: sanitizeEmailContent(wa.fallbackEmail),
      couponCode: coupon,
      data: ctxOf(e.context),
      origin: {
        flowId: e.flowId,
        flowKey: e.flow.key ?? undefined,
        enrollmentId: e.id,
        stepId: step.id,
        stepPosition: idx,
      },
      idempotencyKey: `enr-${e.id}-${step.id}-fallback`,
    });
  }
}
