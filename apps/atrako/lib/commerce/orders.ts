/**
 * Domínio Commerce — pedidos, cupons, entitlements.
 * Pixel/tracking: WorkspaceSettings.tracking (Config).
 * Pagamento: WorkspaceConnection MERCADO_PAGO (Config).
 */

import { prisma } from "@/lib/db";
import { upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import {
  ensureDefaultPipeline,
  STAGE_ROLE_WON,
} from "@/lib/modules/crm";
import { createEvent, publishEventBatch } from "@atrako/events";
import { Prisma } from "@/lib/generated/prisma";

export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export function isValidCpf(cpf: string) {
  const s = onlyDigits(cpf);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(s[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(s[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(s[10]);
}

export async function validateCoupon(
  clienteId: string,
  code: string,
  productId: string,
  subtotalCents: number,
) {
  const coupon = await prisma.commerceCoupon.findUnique({
    where: { clienteId_code: { clienteId, code: code.trim().toUpperCase() } },
    include: { products: true },
  });
  if (!coupon || !coupon.active) return { ok: false as const, error: "Cupom inválido" };
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false as const, error: "Cupom ainda não válido" };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false as const, error: "Cupom expirado" };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false as const, error: "Cupom esgotado" };
  }
  if (coupon.products.length && !coupon.products.some((p) => p.productId === productId)) {
    return { ok: false as const, error: "Cupom não vale para este produto" };
  }
  const discountCents =
    coupon.type === "PERCENT"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(subtotalCents, coupon.value);
  return { ok: true as const, coupon, discountCents };
}

/** Move lead do contato para Ganho com dealValue do pedido. */
async function markLeadWonFromOrder(input: {
  workspaceId: string;
  contactId: string | null;
  email: string;
  orderId: string;
  totalCents: number;
  productIds: string[];
  productNames: string[];
}) {
  let lead = input.contactId
    ? await prisma.nativeLead.findFirst({
        where: {
          clienteId: input.workspaceId,
          contactId: input.contactId,
          OR: [{ status: "OPEN" }, { status: "WON" }],
        },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  if (!lead) {
    const contact = await prisma.nativeContact.findFirst({
      where: {
        clienteId: input.workspaceId,
        email: input.email.toLowerCase(),
      },
    });
    if (contact) {
      lead = await prisma.nativeLead.findFirst({
        where: {
          clienteId: input.workspaceId,
          contactId: contact.id,
          OR: [{ status: "OPEN" }, { status: "WON" }],
        },
        orderBy: { updatedAt: "desc" },
      });
    }
  }

  if (!lead) return null;

  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const wonStage = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  const prevMeta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const updatedLead = await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: "WON",
      stageId: wonStage?.id ?? lead.stageId,
      dealValue: new Prisma.Decimal(input.totalCents / 100),
      metadata: {
        ...prevMeta,
        orderId: input.orderId,
        productIds: input.productIds,
        productNames: input.productNames,
        paidAt: new Date().toISOString(),
        orderPending: false,
        channel: prevMeta.channel ?? "checkout",
        lastTouchChannel: "checkout",
        lastTouchAt: new Date().toISOString(),
      },
    },
  });

  return updatedLead;
}

export async function approveOrder(orderId: string) {
  const order = await prisma.commerceOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status === "APPROVED") return order;

  const updated = await prisma.commerceOrder.update({
    where: { id: orderId },
    data: { status: "APPROVED", approvedAt: new Date() },
    include: { items: true },
  });

  if (order.couponId) {
    await prisma.commerceCoupon.update({
      where: { id: order.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  for (const item of updated.items) {
    await prisma.commerceEntitlement.upsert({
      where: {
        clienteId_email_productId: {
          clienteId: updated.clienteId,
          email: updated.email.toLowerCase(),
          productId: item.productId,
        },
      },
      create: {
        clienteId: updated.clienteId,
        email: updated.email.toLowerCase(),
        productId: item.productId,
        orderId: updated.id,
      },
      update: { revokedAt: null, orderId: updated.id },
    });
  }

  const productNames = updated.items.map((i) => i.name);
  const productIds = updated.items.map((i) => i.productId);
  const mainName = productNames[0] || "Pedido";

  const wonLead = await markLeadWonFromOrder({
    workspaceId: updated.clienteId,
    contactId: updated.contactId,
    email: updated.email,
    orderId: updated.id,
    totalCents: updated.totalCents,
    productIds,
    productNames,
  }).catch(() => null);

  const leadMeta =
    wonLead?.metadata &&
    typeof wonLead.metadata === "object" &&
    !Array.isArray(wonLead.metadata)
      ? (wonLead.metadata as Record<string, unknown>)
      : {};

  const pageSlug =
    typeof leadMeta.pageSlug === "string" ? leadMeta.pageSlug : undefined;
  const formId =
    typeof leadMeta.formId === "string" ? leadMeta.formId : undefined;
  const formSlug =
    typeof leadMeta.formSlug === "string" ? leadMeta.formSlug : undefined;
  const formName =
    typeof leadMeta.formName === "string" ? leadMeta.formName : undefined;
  const pageUrl =
    typeof leadMeta.pageUrl === "string" ? leadMeta.pageUrl : undefined;
  const pageProductId =
    typeof leadMeta.pageProductId === "string"
      ? leadMeta.pageProductId
      : undefined;

  const descParts = [mainName];
  if (pageSlug) descParts.push(`LP ${pageSlug}`);
  if (formName || formSlug) descParts.push(`Form ${formName || formSlug}`);
  const description = descParts.join(" · ");

  await upsertLedgerEntry({
    clienteId: updated.clienteId,
    type: "INCOME",
    amount: updated.totalCents / 100,
    occurredAt: updated.approvedAt ?? new Date(),
    source: "commerce",
    sourceRef: updated.id,
    idempotencyKey: `commerce-order-${updated.id}`,
    leadId: wonLead?.id ?? null,
    contact: updated.email,
    provider: "MERCADO_PAGO",
    description,
    metadata: {
      orderId: updated.id,
      productIds,
      productNames,
      pageSlug: pageSlug ?? null,
      pageUrl: pageUrl ?? null,
      pageProductId: pageProductId ?? null,
      formId: formId ?? null,
      formSlug: formSlug ?? null,
      formName: formName ?? null,
      firstTouchSource: wonLead?.source ?? null,
      firstTouchChannel:
        typeof leadMeta.channel === "string" ? leadMeta.channel : null,
      utmSource: updated.utmSource,
      utmMedium: updated.utmMedium,
      utmCampaign: updated.utmCampaign,
      totalCents: updated.totalCents,
      contactId: updated.contactId,
      leadId: wonLead?.id ?? null,
    },
  });

  await publishEventBatch([
    createEvent({
      name: "payment.paid",
      source: "commerce",
      idempotencyKey: `commerce-paid-${updated.id}`,
      context: {
        workspaceId: updated.clienteId,
        contactId: updated.contactId ?? undefined,
        leadId: wonLead?.id,
        orderId: updated.id,
      },
      payload: {
        orderId: updated.id,
        amount: updated.totalCents / 100,
        productIds,
        productNames,
        leadId: wonLead?.id,
        email: updated.email,
        description: `${mainName} pago`,
      },
    }),
    createEvent({
      name: "order.completed",
      source: "commerce",
      idempotencyKey: `commerce-completed-${updated.id}`,
      context: {
        workspaceId: updated.clienteId,
        contactId: updated.contactId ?? undefined,
        leadId: wonLead?.id,
        orderId: updated.id,
      },
      payload: {
        orderId: updated.id,
        amount: updated.totalCents / 100,
        productIds,
        productNames,
        leadId: wonLead?.id,
      },
    }),
  ]).catch(() => null);

  return updated;
}

export async function revokeEntitlementsForOrder(orderId: string) {
  await prisma.commerceEntitlement.updateMany({
    where: { orderId },
    data: { revokedAt: new Date() },
  });
}
