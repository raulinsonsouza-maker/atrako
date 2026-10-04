/**
 * Carrinho abandonado — pedidos não pagos + checkouts abandonados das lojas.
 *
 * Ciclo: PENDING (dentro da janela de pagamento) → OPEN (abandonado: lead vai para a
 * coluna "Carrinho abandonado" e recebe WhatsApp) → RECOVERED (pagou) | EXPIRED.
 * Contato/lead só nascem no OPEN para não poluir "Novo" com quem ainda está pagando.
 */

import { createEvent, createEventId, publishEventBatch } from "@atrako/events";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import {
  ensureOpenNativeLead,
  normalizePersonEmail,
  normalizePersonPhone,
  upsertPersonAndLead,
} from "@/lib/atrako/person";
import {
  ensureAbandonedStage,
  ensureDefaultPipeline,
  ensureLostStage,
  STAGE_ROLE_ABANDONED,
  STAGE_ROLE_ENTRY,
  STAGE_ROLE_WON,
} from "@/lib/modules/crm";

export const ABANDON_AFTER_MINUTES = 60;
export const NOTIFY_MAX_AGE_HOURS = 24;
export const RECOVERY_WINDOW_DAYS = 30;

const MINUTE = 60_000;
const DAY = 86_400_000;

export type AbandonedCartProvider =
  | "WOOCOMMERCE"
  | "SHOPIFY"
  | "NUVEMSHOP"
  | "TRAY"
  | "COMMERCE";

export type AbandonedCartItem = {
  title: string;
  quantity: number;
  unitPriceCents?: number;
  sku?: string | null;
};

type BuyerInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

function sourceFor(provider: AbandonedCartProvider) {
  return provider === "COMMERCE" ? "commerce" : provider.toLowerCase();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function abandonDeadline(lastActivityAt: Date) {
  return new Date(lastActivityAt.getTime() + ABANDON_AFTER_MINUTES * MINUTE);
}

/**
 * Pedido de loja/checkout próprio. Não pago → carrinho PENDING (vira OPEN após a janela).
 * Pago → recupera carrinhos abertos da mesma pessoa e leva o lead para Ganho.
 */
export async function trackOrderPayment(
  input: BuyerInput & {
    workspaceId: string;
    provider: AbandonedCartProvider;
    externalOrderId: string;
    paid: boolean;
    occurredAt: Date;
    totalCents: number;
    currency?: string | null;
    contactId?: string | null;
    leadId?: string | null;
    items?: AbandonedCartItem[];
    recoveryUrl?: string | null;
    rawPayload?: unknown;
  },
) {
  const externalId = `order:${input.externalOrderId}`;

  if (input.paid) {
    await markCartsRecovered({
      workspaceId: input.workspaceId,
      contactId: input.contactId ?? null,
      email: input.email,
      phone: input.phone,
      orderRef: `${input.provider}:${input.externalOrderId}`,
      totalCents: input.totalCents,
      paidAt: input.occurredAt,
      ownExternalId: externalId,
      provider: input.provider,
    });
    if (input.leadId) await moveLeadToWon(input.workspaceId, input.leadId, input.totalCents);
    return;
  }

  // Pedido antigo demais para recuperar não vira carrinho; sai de "Novo" e fica na base para reativação.
  if (Date.now() - input.occurredAt.getTime() > RECOVERY_WINDOW_DAYS * DAY) {
    if (input.leadId) {
      await markLeadLost(input.workspaceId, input.leadId, "pedido_nao_pago", {
        lostOrderRef: `${input.provider}:${input.externalOrderId}`,
      });
    }
    return;
  }

  await upsertCartRow({
    workspaceId: input.workspaceId,
    provider: input.provider,
    kind: "order",
    externalId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    contactId: input.contactId ?? null,
    leadId: input.leadId ?? null,
    totalCents: input.totalCents,
    currency: input.currency,
    items: input.items,
    recoveryUrl: input.recoveryUrl,
    abandonedAt: abandonDeadline(input.occurredAt),
    rawPayload: input.rawPayload,
  });
}

/** Checkout abandonado vindo da API da loja (Shopify, Nuvemshop, Tray). */
export async function upsertCheckoutCart(
  input: BuyerInput & {
    workspaceId: string;
    provider: AbandonedCartProvider;
    checkoutId: string;
    lastActivityAt: Date;
    completed: boolean;
    totalCents: number;
    currency?: string | null;
    items?: AbandonedCartItem[];
    recoveryUrl?: string | null;
    rawPayload?: unknown;
  },
) {
  const externalId = `checkout:${input.checkoutId}`;
  if (input.completed) {
    // Virou pedido: se ainda estava na janela, some; se já estava OPEN, o pedido pago recupera.
    await prisma.abandonedCart.deleteMany({
      where: {
        clienteId: input.workspaceId,
        provider: input.provider,
        externalId,
        status: "PENDING",
      },
    });
    return null;
  }
  if (!normalizePersonEmail(input.email) && !normalizePersonPhone(input.phone)) return null;
  if (Date.now() - input.lastActivityAt.getTime() > RECOVERY_WINDOW_DAYS * DAY) return null;

  return upsertCartRow({
    workspaceId: input.workspaceId,
    provider: input.provider,
    kind: "checkout",
    externalId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    totalCents: input.totalCents,
    currency: input.currency,
    items: input.items,
    recoveryUrl: input.recoveryUrl,
    abandonedAt: abandonDeadline(input.lastActivityAt),
    rawPayload: input.rawPayload,
  });
}

async function upsertCartRow(input: BuyerInput & {
  workspaceId: string;
  provider: AbandonedCartProvider;
  kind: "order" | "checkout";
  externalId: string;
  contactId?: string | null;
  leadId?: string | null;
  totalCents: number;
  currency?: string | null;
  items?: AbandonedCartItem[];
  recoveryUrl?: string | null;
  abandonedAt: Date;
  rawPayload?: unknown;
}) {
  const email = normalizePersonEmail(input.email);
  const phone = normalizePersonPhone(input.phone);
  const name = input.name?.trim().slice(0, 200) || null;
  const where = {
    clienteId_provider_externalId: {
      clienteId: input.workspaceId,
      provider: input.provider,
      externalId: input.externalId,
    },
  };
  const existing = await prisma.abandonedCart.findUnique({ where });
  const shared = {
    name: name ?? existing?.name ?? null,
    email: email ?? existing?.email ?? null,
    phone: phone ?? existing?.phone ?? null,
    contactId: input.contactId ?? existing?.contactId ?? null,
    leadId: input.leadId ?? existing?.leadId ?? null,
    totalCents: input.totalCents,
    currency: (input.currency || "BRL").toUpperCase().slice(0, 8),
    items: (input.items ?? undefined) as Prisma.InputJsonValue | undefined,
    recoveryUrl: input.recoveryUrl ?? existing?.recoveryUrl ?? null,
    rawPayload: (input.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
  };

  if (!existing) {
    return prisma.abandonedCart.create({
      data: {
        clienteId: input.workspaceId,
        provider: input.provider,
        kind: input.kind,
        externalId: input.externalId,
        status: "PENDING",
        abandonedAt: input.abandonedAt,
        ...shared,
      },
    });
  }
  if (existing.status === "RECOVERED" || existing.status === "EXPIRED") return existing;
  return prisma.abandonedCart.update({
    where: { id: existing.id },
    data: {
      ...shared,
      // Checkout com atividade nova reinicia a janela enquanto ainda não foi abandonado.
      ...(existing.status === "PENDING" ? { abandonedAt: input.abandonedAt } : {}),
    },
  });
}

/** Pedido pago: carrinhos da mesma pessoa viram RECOVERED (OPEN) ou somem (PENDING). */
export async function markCartsRecovered(input: {
  workspaceId: string;
  contactId: string | null;
  email?: string | null;
  phone?: string | null;
  orderRef: string;
  totalCents: number;
  paidAt: Date;
  ownExternalId?: string;
  provider?: AbandonedCartProvider;
}) {
  const email = normalizePersonEmail(input.email);
  const phone = normalizePersonPhone(input.phone);
  const identity: Prisma.AbandonedCartWhereInput[] = [
    ...(input.contactId ? [{ contactId: input.contactId }] : []),
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
    ...(input.ownExternalId && input.provider
      ? [{ provider: input.provider, externalId: input.ownExternalId }]
      : []),
  ];
  if (!identity.length) return { recovered: 0 };

  // abandonedAt = última atividade + janela; só carrinhos com atividade antes do pagamento.
  const carts = await prisma.abandonedCart.findMany({
    where: {
      clienteId: input.workspaceId,
      status: { in: ["PENDING", "OPEN"] },
      abandonedAt: {
        gte: new Date(input.paidAt.getTime() - RECOVERY_WINDOW_DAYS * DAY),
        lte: abandonDeadline(input.paidAt),
      },
      OR: identity,
    },
  });

  let recovered = 0;
  for (const cart of carts) {
    // Pago dentro da janela (ou status de pagamento chegou atrasado): não foi abandono.
    if (cart.status === "PENDING" || input.paidAt < cart.abandonedAt) {
      await prisma.abandonedCart.delete({ where: { id: cart.id } });
      if (cart.status === "OPEN" && cart.leadId) {
        await moveLeadToWon(input.workspaceId, cart.leadId, input.totalCents);
      }
      continue;
    }
    await prisma.abandonedCart.update({
      where: { id: cart.id },
      data: {
        status: "RECOVERED",
        recoveredAt: input.paidAt,
        recoveredOrderId: input.orderRef.slice(0, 120),
        recoveredCents: input.totalCents,
      },
    });
    if (cart.leadId) {
      await moveLeadToWon(input.workspaceId, cart.leadId, input.totalCents, {
        recoveredFromAbandoned: true,
        recoveredAt: input.paidAt.toISOString(),
      });
    }
    recovered++;
  }
  return { recovered };
}

async function moveLeadToWon(
  workspaceId: string,
  leadId: string,
  totalCents: number,
  extraMeta?: Record<string, unknown>,
) {
  const lead = await prisma.nativeLead.findFirst({ where: { id: leadId, clienteId: workspaceId } });
  if (!lead) return;
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const won = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  const prev = asRecord(lead.metadata);
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: "WON",
      stageId: won?.id ?? lead.stageId,
      dealValue: lead.dealValue ?? new Prisma.Decimal(totalCents / 100),
      metadata: {
        ...prev,
        orderPending: false,
        paidAt: prev.paidAt ?? new Date().toISOString(),
        ...(extraMeta ?? {}),
      } as Prisma.InputJsonValue,
    },
  });
}

/** PENDING vencidos → OPEN: cria contato/lead, move para a coluna e dispara a recuperação. */
export async function promoteDueCarts(opts?: { limit?: number; now?: Date; notify?: boolean }) {
  const now = opts?.now ?? new Date();
  const due = await prisma.abandonedCart.findMany({
    where: { status: "PENDING", abandonedAt: { lte: now } },
    orderBy: { abandonedAt: "asc" },
    take: opts?.limit ?? 200,
  });

  let promoted = 0;
  let notified = 0;
  for (const cart of due) {
    let contactId = cart.contactId;
    let leadId = cart.leadId;
    const source = sourceFor(cart.provider as AbandonedCartProvider);
    const leadMeta = {
      channel: "ecommerce",
      provider: cart.provider,
      abandonedCart: true,
      abandonedCartId: cart.id,
      recoveryUrl: cart.recoveryUrl,
      abandonedAt: cart.abandonedAt.toISOString(),
    };

    if (!leadId) {
      if (contactId) {
        const lead = await ensureOpenNativeLead({
          workspaceId: cart.clienteId,
          contactId,
          source,
          metadata: leadMeta,
        });
        leadId = lead.id;
      } else if (cart.email || cart.phone) {
        const { contact, lead } = await upsertPersonAndLead({
          workspaceId: cart.clienteId,
          name: cart.name,
          email: cart.email,
          phone: cart.phone,
          source,
          metadata: leadMeta,
        });
        contactId = contact.id;
        leadId = lead.id;
      } else {
        await prisma.abandonedCart.update({ where: { id: cart.id }, data: { status: "EXPIRED" } });
        continue;
      }
    }

    await prisma.abandonedCart.update({
      where: { id: cart.id },
      data: { status: "OPEN", contactId, leadId },
    });
    await moveLeadToAbandoned(cart.clienteId, leadId, cart.totalCents, leadMeta);
    promoted++;

    const fresh = now.getTime() - cart.abandonedAt.getTime() < NOTIFY_MAX_AGE_HOURS * 3_600_000;
    if (fresh && !cart.notifiedAt && opts?.notify !== false) {
      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { notifiedAt: now },
      });
      await emitCheckoutAbandoned({ ...cart, contactId, leadId });
      notified++;
    }
  }
  return { promoted, notified, scanned: due.length };
}

/**
 * Lead aberto na entrada → coluna de abandono. Lead perdido volta (reativação).
 * Não mexe em lead que alguém já levou para uma etapa livre ou ganhou.
 */
async function moveLeadToAbandoned(
  workspaceId: string,
  leadId: string,
  totalCents: number,
  meta: Record<string, unknown>,
) {
  const lead = await prisma.nativeLead.findFirst({ where: { id: leadId, clienteId: workspaceId } });
  if (!lead || (lead.status !== "OPEN" && lead.status !== "LOST")) return;
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const current = pipeline.stages.find((s) => s.id === lead.stageId);
  const movable =
    lead.status === "LOST" || !lead.stageId || current?.role === STAGE_ROLE_ENTRY;
  const stage = movable ? await ensureAbandonedStage(workspaceId) : null;
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      ...(stage ? { stageId: stage.id, status: "OPEN" } : {}),
      dealValue: lead.dealValue ?? (totalCents > 0 ? new Prisma.Decimal(totalCents / 100) : null),
      metadata: { ...asRecord(lead.metadata), ...meta } as Prisma.InputJsonValue,
    },
  });
}

export type LostReason = "pedido_nao_pago" | "carrinho_expirado" | "reembolso";

/**
 * Lead aberto em Novo / Carrinho abandonado → Perdido, com motivo para reativação.
 * Não mexe em ganho nem em lead que alguém levou para uma etapa livre.
 */
export async function markLeadLost(
  workspaceId: string,
  leadId: string,
  reason: LostReason,
  extraMeta?: Record<string, unknown>,
) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: leadId, clienteId: workspaceId },
    include: { stage: true },
  });
  if (!lead || lead.status !== "OPEN") return false;
  const role = (lead.stage as { role?: string | null } | null)?.role ?? null;
  if (lead.stageId && role !== STAGE_ROLE_ENTRY && role !== STAGE_ROLE_ABANDONED) return false;

  const stage = await ensureLostStage(workspaceId);
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: "LOST",
      stageId: stage.id,
      metadata: {
        ...asRecord(lead.metadata),
        lostReason: reason,
        lostAt: new Date().toISOString(),
        orderPending: false,
        ...(extraMeta ?? {}),
      } as Prisma.InputJsonValue,
    },
  });
  return true;
}

async function emitCheckoutAbandoned(cart: {
  id: string;
  clienteId: string;
  provider: string;
  externalId: string;
  contactId: string | null;
  leadId: string | null;
  email: string | null;
  phone: string | null;
  totalCents: number;
  recoveryUrl: string | null;
}) {
  const event = createEvent({
    id: createEventId(),
    name: "checkout.abandoned",
    source: "commerce",
    idempotencyKey: `abandoned-cart-${cart.id}`,
    context: {
      workspaceId: cart.clienteId,
      contactId: cart.contactId ?? undefined,
      leadId: cart.leadId ?? undefined,
    },
    payload: {
      kind: "abandonment",
      abandonedCartId: cart.id,
      provider: cart.provider,
      phone: cart.phone,
      email: cart.email,
      recoveryUrl: cart.recoveryUrl,
      totalCents: cart.totalCents,
    },
  });
  try {
    const { published } = await publishEventBatch([event]);
    if (published) return;
  } catch (err) {
    console.warn("[abandoned-cart] bridge publish failed", err);
  }
  // Sem bridge HTTP, envia direto para o WhatsApp não depender do ATRAKO_EVENTS_URL.
  const { processWhatsAppEventSideEffects } = await import("@/lib/whatsapp/triggers");
  await processWhatsAppEventSideEffects({
    name: event.name,
    source: event.source,
    idempotencyKey: event.idempotencyKey,
    context: event.context as unknown as Record<string, unknown>,
    payload: event.payload as Record<string, unknown>,
  }).catch((err) => console.warn("[abandoned-cart] whatsapp failed", err));
}

/** Pedidos PENDING do checkout próprio entram no mesmo ciclo. */
async function trackPendingCommerceOrders() {
  const since = new Date(Date.now() - RECOVERY_WINDOW_DAYS * DAY);
  const orders = await prisma.commerceOrder.findMany({
    where: { status: "PENDING", createdAt: { gte: since } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const base = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
  for (const order of orders) {
    await trackOrderPayment({
      workspaceId: order.clienteId,
      provider: "COMMERCE",
      externalOrderId: order.id,
      paid: false,
      occurredAt: order.createdAt,
      totalCents: order.totalCents,
      contactId: order.contactId,
      name: order.name,
      email: order.email,
      phone: order.phone,
      items: order.items.map((i) => ({
        title: i.name,
        quantity: i.quantity,
        unitPriceCents: i.priceCents,
      })),
      recoveryUrl: order.productId ? `${base}/checkout/${order.productId}` : null,
    });
  }
  return orders.length;
}

/** Varredura periódica (cron): checkout próprio → promoção → expiração. */
export async function runAbandonedCartSweep(opts?: { notify?: boolean }) {
  const commerceTracked = await trackPendingCommerceOrders();
  let promoted = 0;
  let notified = 0;
  for (;;) {
    const batch = await promoteDueCarts({ notify: opts?.notify });
    promoted += batch.promoted;
    notified += batch.notified;
    if (batch.scanned < 200) break;
  }
  const stale = await prisma.abandonedCart.findMany({
    where: {
      status: "OPEN",
      abandonedAt: { lt: new Date(Date.now() - RECOVERY_WINDOW_DAYS * DAY) },
    },
    select: { id: true, clienteId: true, leadId: true },
    take: 1000,
  });
  let lost = 0;
  for (const cart of stale) {
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { status: "EXPIRED" } });
    if (cart.leadId) {
      const moved = await markLeadLost(cart.clienteId, cart.leadId, "carrinho_expirado", {
        abandonedCartId: cart.id,
      });
      if (moved) lost++;
    }
  }
  return { commerceTracked, promoted, notified, expired: stale.length, lost };
}

/** Números da coluna / receita recuperada para o CRM. */
export async function getAbandonedCartSummary(workspaceId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const windowStart = new Date(Date.now() - RECOVERY_WINDOW_DAYS * DAY);

  const [open, recoveredMonth, decided] = await Promise.all([
    prisma.abandonedCart.aggregate({
      where: { clienteId: workspaceId, status: "OPEN" },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.abandonedCart.aggregate({
      where: { clienteId: workspaceId, status: "RECOVERED", recoveredAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { recoveredCents: true },
    }),
    prisma.abandonedCart.groupBy({
      by: ["status"],
      where: {
        clienteId: workspaceId,
        status: { in: ["OPEN", "RECOVERED", "EXPIRED"] },
        abandonedAt: { gte: windowStart },
      },
      _count: { _all: true },
    }),
  ]);

  const total = decided.reduce((s, r) => s + r._count._all, 0);
  const recoveredWindow = decided.find((r) => r.status === "RECOVERED")?._count._all ?? 0;
  if (!open._count._all && !recoveredMonth._count._all && !total) return null;
  return {
    openCount: open._count._all,
    openValueCents: open._sum.totalCents ?? 0,
    recoveredMonthCount: recoveredMonth._count._all,
    recoveredMonthCents: recoveredMonth._sum.recoveredCents ?? 0,
    recoveryRate: total ? recoveredWindow / total : null,
  };
}
