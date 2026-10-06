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
  AGING_STAGES,
  ensureAbandonedStage,
  ensureAgingStage,
  ensureDefaultPipeline,
  ensureLostStage,
  isAbandonFamilyRole,
  STAGE_ROLE_ABANDONED,
  STAGE_ROLE_ENTRY,
  STAGE_ROLE_LOST,
  STAGE_ROLE_WON,
} from "@/lib/modules/crm";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { LOST_REASON_LABELS, withStageHistory, type LostReason } from "@/lib/crm/stage-history";
import { contactLifetimeCents } from "@/lib/crm/lead-value";
import { enrichItemsFromCatalog } from "@/lib/flows/catalog-enrich";

export const ABANDON_AFTER_MINUTES = 60;
export const NOTIFY_MAX_AGE_HOURS = 24;
/** Carrinho fica aberto (janelas +7/+30/+60) até virar Perdido. */
export const RECOVERY_WINDOW_DAYS = 90;
/** Só matricula no fluxo da janela quem a cruzou há pouco (deploy/backfill não dispara para antigos). */
const AGING_ENROLL_GRACE_HOURS = 48;

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
  imageUrl?: string | null;
  productUrl?: string | null;
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
    if (input.leadId) await moveLeadToWon(input.workspaceId, input.leadId, input.totalCents, input.occurredAt);
    const { onOrderPaid } = await import("@/lib/flows/attribution");
    await onOrderPaid({
      workspaceId: input.workspaceId,
      contactId: input.contactId ?? null,
      leadId: input.leadId ?? null,
      email: input.email,
      phone: input.phone,
      orderRef: `${input.provider}:${input.externalOrderId}`,
      totalCents: input.totalCents,
      paidAt: input.occurredAt,
      provider: input.provider,
      rawPayload: input.rawPayload,
      items: input.items,
    }).catch((err) => console.warn("[flows] onOrderPaid", err instanceof Error ? err.message : err));
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
  const items = input.items?.length
    ? await enrichItemsFromCatalog(input.workspaceId, input.provider, input.items).catch(() => input.items)
    : input.items;
  const shared = {
    name: name ?? existing?.name ?? null,
    email: email ?? existing?.email ?? null,
    phone: phone ?? existing?.phone ?? null,
    contactId: input.contactId ?? existing?.contactId ?? null,
    leadId: input.leadId ?? existing?.leadId ?? null,
    totalCents: input.totalCents,
    currency: (input.currency || "BRL").toUpperCase().slice(0, 8),
    items: (items ?? undefined) as Prisma.InputJsonValue | undefined,
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
        await moveLeadToWon(input.workspaceId, cart.leadId, input.totalCents, input.paidAt);
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
      await moveLeadToWon(input.workspaceId, cart.leadId, input.totalCents, input.paidAt, {
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
  paidAt: Date,
  extraMeta?: Record<string, unknown>,
) {
  const lead = await prisma.nativeLead.findFirst({ where: { id: leadId, clienteId: workspaceId } });
  if (!lead) return;
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const won = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  const prev = asRecord(lead.metadata);
  const lastPaidAt = typeof prev.lastPaidAt === "string" && prev.lastPaidAt > paidAt.toISOString() ? prev.lastPaidAt : paidAt.toISOString();
  const meta = {
    ...prev,
    orderPending: false,
    paidAt: prev.paidAt ?? paidAt.toISOString(),
    lastPaidAt,
    ...(extraMeta ?? {}),
  };
  const moved = won && lead.stageId !== won.id;
  const lifetimeCents = Math.max(await contactLifetimeCents(workspaceId, lead.contactId), totalCents);
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: "WON",
      stageId: won?.id ?? lead.stageId,
      dealValue: new Prisma.Decimal(lifetimeCents / 100),
      metadata: (moved
        ? withStageHistory(meta, { stageId: won.id, stage: won.name, role: STAGE_ROLE_WON, at: paidAt, by: "auto", reason: "compra" })
        : meta) as Prisma.InputJsonValue,
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
    await moveLeadToAbandoned(cart.clienteId, leadId, cart.totalCents, leadMeta, cart.abandonedAt, cart.kind);
    promoted++;

    const fresh = now.getTime() - cart.abandonedAt.getTime() < NOTIFY_MAX_AGE_HOURS * 3_600_000;
    if (fresh && !cart.notifiedAt && opts?.notify !== false) {
      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { notifiedAt: now },
      });
      const viaFlow = contactId ? await enrollCartInFlow({ ...cart, contactId, leadId }) : false;
      // Sem fluxo ativo com template aprovado: só texto/CTA dentro da janela de 24h
      if (!viaFlow) await emitCheckoutAbandoned({ ...cart, contactId, leadId });
      notified++;
    }
  }
  return { promoted, notified, scanned: due.length };
}

/**
 * Matricula o carrinho no fluxo (checkout → cart_abandoned; pedido não pago → order_unpaid).
 * Retorna true se o WhatsApp sai pelo fluxo (template aprovado) — senão o caller usa o envio legado.
 */
async function enrollCartInFlow(cart: {
  id: string;
  clienteId: string;
  provider: string;
  kind: string;
  externalId: string;
  contactId: string;
  leadId: string | null;
  totalCents: number;
  currency: string;
  items: unknown;
  recoveryUrl: string | null;
}) {
  try {
    const { enrollContact } = await import("@/lib/flows/engine");
    const trigger = cart.kind === "order" ? "order_unpaid" : "cart_abandoned";
    const items = Array.isArray(cart.items) ? (cart.items as AbandonedCartItem[]) : [];
    const { enrolled } = await enrollContact({
      clienteId: cart.clienteId,
      trigger,
      contactId: cart.contactId,
      leadId: cart.leadId,
      refType: "cart",
      refId: cart.id,
      context: {
        items,
        totalCents: cart.totalCents,
        currency: cart.currency,
        destination: cart.recoveryUrl,
        orderRef: cart.kind === "order" ? cart.externalId.replace(/^order:/, "") : null,
        provider: cart.provider,
      },
    });
    if (!enrolled) return false;
    const approved = await prisma.waTemplateRef.count({
      where: {
        clienteId: cart.clienteId,
        status: "APPROVED",
        purpose: cart.kind === "order" ? "order_unpaid" : "cart_1",
      },
    });
    return approved > 0;
  } catch (err) {
    console.warn("[abandoned-cart] flow enroll failed", err instanceof Error ? err.message : err);
    return false;
  }
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
  abandonedAt: Date,
  kind: string,
) {
  const lead = await prisma.nativeLead.findFirst({ where: { id: leadId, clienteId: workspaceId } });
  if (!lead || (lead.status !== "OPEN" && lead.status !== "LOST")) return;
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const current = pipeline.stages.find((s) => s.id === lead.stageId);
  // Carrinho novo de quem estava numa janela (+7/+30/+60) é intenção nova: volta para a coluna de abandono.
  const movable =
    lead.status === "LOST" ||
    !lead.stageId ||
    current?.role === STAGE_ROLE_ENTRY ||
    (isAbandonFamilyRole(current?.role) && current?.role !== STAGE_ROLE_ABANDONED);
  const stage = movable ? await ensureAbandonedStage(workspaceId) : null;
  const merged = { ...asRecord(lead.metadata), ...meta };
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      ...(stage ? { stageId: stage.id, status: "OPEN" } : {}),
      dealValue: lead.dealValue ?? (totalCents > 0 ? new Prisma.Decimal(totalCents / 100) : null),
      metadata: (stage && stage.id !== lead.stageId
        ? withStageHistory(merged, {
            stageId: stage.id,
            stage: stage.name,
            role: STAGE_ROLE_ABANDONED,
            at: abandonedAt,
            by: "auto",
            reason: kind === "order" ? "pedido não pago" : "carrinho abandonado",
          })
        : merged) as Prisma.InputJsonValue,
    },
  });
}

export type { LostReason } from "@/lib/crm/stage-history";

/**
 * Lead aberto em Novo / colunas de carrinho → Perdido, com motivo para reativação.
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
  if (lead.stageId && role !== STAGE_ROLE_ENTRY && !isAbandonFamilyRole(role)) return false;

  const stage = await ensureLostStage(workspaceId);
  const now = new Date();
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: "LOST",
      stageId: stage.id,
      metadata: withStageHistory(
        {
          ...asRecord(lead.metadata),
          lostReason: reason,
          lostAt: now.toISOString(),
          orderPending: false,
          ...(extraMeta ?? {}),
        },
        { stageId: stage.id, stage: stage.name, role: STAGE_ROLE_LOST, at: now, by: "auto", reason: LOST_REASON_LABELS[reason] },
      ) as Prisma.InputJsonValue,
    },
  });
  if (lead.contactId && reason !== "reembolso") {
    const { enrollContact } = await import("@/lib/flows/engine");
    await enrollContact({
      clienteId: workspaceId,
      trigger: "lead_lost",
      contactId: lead.contactId,
      leadId: lead.id,
      refType: "lead",
      refId: lead.id,
      context: {},
    }).catch((err) => console.warn("[flows] lead_lost enroll", err instanceof Error ? err.message : err));
  }
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

/**
 * Carrinho aberto sem compra avança para +7 / +30 / +60 dias pela idade do carrinho mais recente do lead.
 * Só avança: nunca volta, não mexe em Ganho nem em coluna livre. O fluxo da janela vale também para
 * cliente em Ganho, mas só para quem cruzou a janela nas últimas 48h.
 */
export async function ageOpenCarts(opts?: { now?: Date; notify?: boolean; workspaceId?: string }) {
  const now = opts?.now ?? new Date();
  const carts = await prisma.abandonedCart.findMany({
    where: {
      status: "OPEN",
      leadId: { not: null },
      ...(opts?.workspaceId ? { clienteId: opts.workspaceId } : {}),
    },
    orderBy: { abandonedAt: "desc" },
  });

  const newestByLead = new Map<string, (typeof carts)[number]>();
  for (const cart of carts) {
    if (!newestByLead.has(cart.leadId!)) newestByLead.set(cart.leadId!, cart);
  }

  let moved = 0;
  let enrolled = 0;
  for (const cart of newestByLead.values()) {
    const ageDays = (now.getTime() - cart.abandonedAt.getTime()) / DAY;
    const window = [...AGING_STAGES].reverse().find((s) => ageDays >= s.minDays);
    if (!window) continue;

    const lead = await prisma.nativeLead.findFirst({
      where: { id: cart.leadId!, clienteId: cart.clienteId },
      include: { stage: true },
    });
    if (!lead) continue;
    const role = (lead.stage as { role?: string | null } | null)?.role ?? null;
    const rank = (r: string | null) => (r === STAGE_ROLE_ENTRY ? 0 : r === STAGE_ROLE_ABANDONED ? 1 : 2 + AGING_STAGES.findIndex((s) => s.role === r));
    const canMove =
      lead.status === "OPEN" &&
      (role === STAGE_ROLE_ENTRY || isAbandonFamilyRole(role) || !lead.stageId) &&
      rank(role) < rank(window.role);

    if (canMove) {
      const stage = await ensureAgingStage(cart.clienteId, window.role);
      await prisma.nativeLead.update({
        where: { id: lead.id },
        data: {
          stageId: stage.id,
          metadata: withStageHistory(asRecord(lead.metadata), {
            stageId: stage.id,
            stage: stage.name,
            role: window.role,
            at: now,
            by: "auto",
            reason: `sem compra há ${window.minDays} dias`,
          }) as Prisma.InputJsonValue,
        },
      });
      moved++;
    }

    const fresh = ageDays - window.minDays < AGING_ENROLL_GRACE_HOURS / 24;
    if (fresh && opts?.notify !== false && cart.contactId && (lead.status === "OPEN" || lead.status === "WON")) {
      if (await enrollCartAging(cart, window.minDays)) enrolled++;
    }
  }
  return { moved, enrolled, scanned: newestByLead.size };
}

async function enrollCartAging(
  cart: {
    id: string;
    clienteId: string;
    provider: string;
    kind: string;
    externalId: string;
    contactId: string | null;
    leadId: string | null;
    totalCents: number;
    currency: string;
    items: unknown;
    recoveryUrl: string | null;
  },
  days: number,
) {
  try {
    const { enrollContact } = await import("@/lib/flows/engine");
    const items = Array.isArray(cart.items) ? (cart.items as AbandonedCartItem[]) : [];
    const { enrolled } = await enrollContact({
      clienteId: cart.clienteId,
      trigger: `cart_aging_${days}` as "cart_aging_7" | "cart_aging_30" | "cart_aging_60",
      contactId: cart.contactId!,
      leadId: cart.leadId,
      refType: "cart",
      refId: cart.id,
      dedupeKey: `cart:${cart.id}:aging${days}`,
      context: {
        items,
        totalCents: cart.totalCents,
        currency: cart.currency,
        // Link de pagamento de pedido antigo costuma ter expirado: manda para a loja.
        destination: cart.kind === "checkout" ? cart.recoveryUrl : null,
        provider: cart.provider,
      },
    });
    return enrolled > 0;
  } catch (err) {
    console.warn("[abandoned-cart] aging enroll failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Uma vez (backfill da janela de 90 dias): carrinho expirado nos últimos 90 dias e sem compra depois
 * volta a OPEN; lead em Perdido por "carrinho expirado" volta para a coluna de abandono. Sem mensagens.
 */
export async function reopenRecentExpiredCarts(workspaceId: string) {
  const since = new Date(Date.now() - RECOVERY_WINDOW_DAYS * DAY);
  const carts = await prisma.abandonedCart.findMany({
    where: { clienteId: workspaceId, status: "EXPIRED", abandonedAt: { gte: since } },
  });
  let reopened = 0;
  let leads = 0;
  for (const cart of carts) {
    if (cart.contactId) {
      const after = await prisma.marketplaceOrder.findMany({
        where: { clienteId: workspaceId, contactId: cart.contactId, occurredAt: { gt: cart.abandonedAt } },
        select: { status: true },
      });
      if (after.some((o) => isRevenueOrder(o.status))) continue;
    }
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { status: "OPEN" } });
    reopened++;
    if (!cart.leadId) continue;
    const lead = await prisma.nativeLead.findFirst({ where: { id: cart.leadId, clienteId: workspaceId } });
    const meta = asRecord(lead?.metadata);
    if (!lead || lead.status !== "LOST" || meta.lostReason !== "carrinho_expirado") continue;
    const stage = await ensureAbandonedStage(workspaceId);
    const rest = { ...meta };
    delete rest.lostReason;
    delete rest.lostAt;
    await prisma.nativeLead.update({
      where: { id: lead.id },
      data: {
        status: "OPEN",
        stageId: stage.id,
        metadata: withStageHistory(rest, {
          stageId: stage.id,
          stage: stage.name,
          role: STAGE_ROLE_ABANDONED,
          at: new Date(),
          by: "auto",
          reason: "carrinho reaberto (janela de 90 dias)",
        }) as Prisma.InputJsonValue,
      },
    });
    leads++;
  }
  const aged = await ageOpenCarts({ workspaceId, notify: false });
  return { reopened, leads, aged: aged.moved };
}

/** Varredura periódica (cron): checkout próprio → promoção → janelas → expiração. */
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
  const aging = await ageOpenCarts({ notify: opts?.notify });
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
  return { commerceTracked, promoted, notified, aged: aging.moved, agingEnrolled: aging.enrolled, expired: stale.length, lost };
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
