/**
 * Pedido pago → atribuição da venda ao fluxo/campanha, saída dos fluxos de venda,
 * perfil atualizado e matrícula no pós-compra / segunda compra.
 *
 * Atribuída: cupom do passo OU clique no /r dentro da janela (padrão 5 dias).
 * Influenciada: recebeu/abriu e comprou em até N dias (padrão 3), sem clique nem cupom.
 */

import { prisma } from "@/lib/db";
import { normalizePersonEmail, normalizePersonPhone } from "@/lib/atrako/person";
import { extractCouponCodes } from "@/lib/flows/orders-util";
import { applyDeliveryEvent } from "@/lib/flows/delivery-status";
import { enrollContact, exitEnrollments, SALES_TRIGGERS } from "@/lib/flows/engine";
import { recomputeProfile, storeTypicalIntervalDays } from "@/lib/flows/profile";
import { loadMessagingPrefs } from "@/lib/flows/prefs";
import { birthDateFromStorePayload, upsertContactBirthday } from "@/lib/flows/important-dates";
import type { RenderItem } from "@/lib/flows/types";

const DAY = 86_400_000;

export type OrderPaidInput = {
  workspaceId: string;
  contactId?: string | null;
  leadId?: string | null;
  email?: string | null;
  phone?: string | null;
  orderRef: string;
  totalCents: number;
  paidAt: Date;
  provider: string;
  rawPayload?: unknown;
  items?: RenderItem[];
  couponCodes?: string[];
};

async function resolveContactId(input: OrderPaidInput) {
  if (input.contactId) return input.contactId;
  const email = normalizePersonEmail(input.email);
  const phone = normalizePersonPhone(input.phone);
  if (!email && !phone) return null;
  const c = await prisma.nativeContact.findFirst({
    where: {
      clienteId: input.workspaceId,
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }, { phoneE164: phone }] : [])],
    },
    select: { id: true },
  });
  return c?.id ?? null;
}

export type Attribution = {
  deliveryId: string;
  kind: "ATTRIBUTED" | "INFLUENCED";
  via: "coupon" | "click" | "received";
} | null;

/** Escolhe a entrega que gerou a venda. */
export async function attributeOrder(input: {
  workspaceId: string;
  contactId: string;
  paidAt: Date;
  couponCodes: string[];
  attributionDays: number;
  influenceDays: number;
}): Promise<Attribution> {
  const since = new Date(input.paidAt.getTime() - input.attributionDays * DAY);
  const deliveries = await prisma.messageDelivery.findMany({
    where: {
      clienteId: input.workspaceId,
      contactId: input.contactId,
      isTest: false,
      convertedAt: null,
      sentAt: { gte: since, lte: input.paidAt },
    },
    orderBy: { sentAt: "desc" },
    select: { id: true, couponCode: true, clickedAt: true, openedAt: true, deliveredAt: true, sentAt: true },
    take: 50,
  });
  return pickAttribution(deliveries, input);
}

export type AttributionCandidate = {
  id: string;
  couponCode: string | null;
  clickedAt: Date | null;
  openedAt: Date | null;
  deliveredAt: Date | null;
  sentAt: Date | null;
};

/** Cupom > clique > recebida (janela de influência). `deliveries` mais recentes primeiro. */
export function pickAttribution(
  deliveries: AttributionCandidate[],
  input: { paidAt: Date; couponCodes: string[]; influenceDays: number },
): Attribution {
  const coupons = new Set(input.couponCodes.map((c) => c.toUpperCase()));
  const byCoupon = deliveries.find((d) => d.couponCode && coupons.has(d.couponCode.toUpperCase()));
  if (byCoupon) return { deliveryId: byCoupon.id, kind: "ATTRIBUTED", via: "coupon" };
  const byClick = deliveries.find((d) => d.clickedAt && d.clickedAt <= input.paidAt);
  if (byClick) return { deliveryId: byClick.id, kind: "ATTRIBUTED", via: "click" };
  const influenceSince = input.paidAt.getTime() - input.influenceDays * DAY;
  const received = deliveries.find(
    (d) => (d.openedAt || d.deliveredAt || d.sentAt) && (d.sentAt?.getTime() ?? 0) >= influenceSince,
  );
  if (received) return { deliveryId: received.id, kind: "INFLUENCED", via: "received" };
  return null;
}

export async function onOrderPaid(input: OrderPaidInput) {
  const contactId = await resolveContactId(input);
  if (!contactId) return { contactId: null };
  const { prefs } = await loadMessagingPrefs(input.workspaceId);
  let raw = input.rawPayload;
  if (!raw && input.orderRef.includes(":")) {
    const externalId = input.orderRef.slice(input.orderRef.indexOf(":") + 1);
    const mo = await prisma.marketplaceOrder.findUnique({
      where: {
        clienteId_provider_externalId: { clienteId: input.workspaceId, provider: input.provider, externalId },
      },
      select: { rawPayload: true },
    });
    raw = mo?.rawPayload ?? null;
  }
  const couponCodes = input.couponCodes ?? extractCouponCodes(input.provider, raw);
  const birth = birthDateFromStorePayload(input.provider, raw);
  if (birth) {
    await upsertContactBirthday({ workspaceId: input.workspaceId, contactId, raw: birth, source: input.provider.toLowerCase() }).catch(
      () => null,
    );
  }

  // Idempotência: mesmo pedido não atribui duas vezes (webhooks repetidos)
  const already = await prisma.messageDelivery.findFirst({
    where: { clienteId: input.workspaceId, convertedOrderRef: input.orderRef.slice(0, 160) },
    select: { id: true },
  });
  const attribution = already
    ? null
    : await attributeOrder({
        workspaceId: input.workspaceId,
        contactId,
        paidAt: input.paidAt,
        couponCodes,
        attributionDays: prefs.attributionDays,
        influenceDays: prefs.influenceDays,
      });

  if (attribution) {
    await applyDeliveryEvent({
      deliveryId: attribution.deliveryId,
      clienteId: input.workspaceId,
      contactId,
      event: "converted",
      at: input.paidAt,
      meta: { orderRef: input.orderRef, cents: input.totalCents, via: attribution.via, kind: attribution.kind },
      providerEventId: `order:${input.orderRef}`.slice(0, 160),
      extra: {
        convertedCents: input.totalCents,
        convertedOrderRef: input.orderRef.slice(0, 160),
        conversionKind: attribution.kind,
      },
    });
  }

  await exitEnrollments({
    clienteId: input.workspaceId,
    contactId,
    reason: "purchased",
    triggers: SALES_TRIGGERS,
    conversion: { orderRef: input.orderRef, cents: input.totalCents, at: input.paidAt },
  });

  const { profile } = await recomputeProfile(input.workspaceId, contactId);

  // wonBy no lead
  if (attribution) {
    const d = await prisma.messageDelivery.findUnique({
      where: { id: attribution.deliveryId },
      select: { id: true, channel: true, flowId: true, campaignId: true, stepId: true, couponCode: true, subject: true, templateName: true },
    });
    const flow = d?.flowId ? await prisma.messageFlow.findUnique({ where: { id: d.flowId }, select: { name: true, key: true } }) : null;
    const campaign = d?.campaignId ? await prisma.messageCampaign.findUnique({ where: { id: d.campaignId }, select: { name: true } }) : null;
    const step = d?.stepId ? await prisma.messageFlowStep.findUnique({ where: { id: d.stepId }, select: { position: true } }) : null;
    const lead = input.leadId
      ? await prisma.nativeLead.findFirst({ where: { id: input.leadId, clienteId: input.workspaceId } })
      : await prisma.nativeLead.findFirst({
          where: { clienteId: input.workspaceId, contactId },
          orderBy: { updatedAt: "desc" },
        });
    if (lead && d) {
      const prev = (lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {}) as Record<string, unknown>;
      await prisma.nativeLead.update({
        where: { id: lead.id },
        data: {
          metadata: {
            ...prev,
            wonBy: {
              deliveryId: d.id,
              channel: d.channel,
              kind: attribution.kind,
              via: attribution.via,
              flowId: d.flowId,
              flowName: flow?.name ?? null,
              flowKey: flow?.key ?? null,
              campaignId: d.campaignId,
              campaignName: campaign?.name ?? null,
              stepPosition: step?.position ?? null,
              couponCode: d.couponCode,
              orderRef: input.orderRef,
              cents: input.totalCents,
              at: input.paidAt.toISOString(),
            },
          } as object,
        },
      });
    }
  }

  // Pós-compra + segunda compra — só pedido recente (sync/backfill de histórico não dispara)
  const recent = Date.now() - input.paidAt.getTime() < 3 * DAY;
  if (!recent) return { contactId, attribution, profile: { ordersCount: profile.ordersCount, lifecycle: profile.lifecycle } };
  await enrollContact({
    clienteId: input.workspaceId,
    trigger: "order_paid",
    contactId,
    leadId: input.leadId ?? null,
    refType: "order",
    refId: input.orderRef.slice(0, 120),
    dedupeKey: `paid:${input.orderRef}`.slice(0, 160),
    context: { items: input.items ?? [], orderRef: input.orderRef, totalCents: input.totalCents, provider: input.provider },
  });
  if (profile.ordersCount === 1) {
    // Passos do playbook em 21/24 dias: desloca para o e-mail cair ~7 dias antes do intervalo típico
    const interval = await storeTypicalIntervalDays(input.workspaceId);
    await enrollContact({
      clienteId: input.workspaceId,
      trigger: "second_purchase",
      contactId,
      dedupeKey: `second:${contactId}`,
      startAt: new Date(Date.now() + Math.max(0, interval - 28) * DAY),
      context: { items: input.items ?? [], provider: input.provider },
    });
  }

  if (attribution?.kind === "ATTRIBUTED") {
    const { sendRecoveredConversion } = await import("@/lib/flows/ads-loop");
    await sendRecoveredConversion({
      workspaceId: input.workspaceId,
      contactId,
      orderRef: input.orderRef,
      totalCents: input.totalCents,
      paidAt: input.paidAt,
      deliveryId: attribution.deliveryId,
    }).catch((err) => console.warn("[flows] capi", err instanceof Error ? err.message : err));
  }

  return { contactId, attribution, profile: { ordersCount: profile.ordersCount, lifecycle: profile.lifecycle } };
}
