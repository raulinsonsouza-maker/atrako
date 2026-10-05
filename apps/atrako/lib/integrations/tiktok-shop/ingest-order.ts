/**
 * Ingestão TikTok Shop → CRM + MarketplaceOrder + itens + financeiro.
 */

import { createEvent, createEventId } from "@atrako/events";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { publishAtrakoEvents } from "@/lib/atrako/events";
import { ensureDefaultPipeline, STAGE_ROLE_WON } from "@/lib/modules/crm";
import {
  extractTiktokShopBuyer,
  extractTiktokShopLineItems,
  isTiktokShopPaidStatus,
  tiktokShopMoneyToCents,
  tiktokShopOrderOccurredAt,
  tiktokShopOrderTotalCents,
  type NormalizedTiktokShopLineItem,
  type TiktokShopOrder,
  type TiktokShopProduct,
} from "./orders";

const LEAD_SOURCE = "tiktokshop";

type AtrakoEventList = Parameters<typeof publishAtrakoEvents>[0];

async function markTiktokShopBuyerInCrm(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
  orderId: string;
  externalOrderId: string;
  totalCents: number;
  status: string | null;
  items: NormalizedTiktokShopLineItem[];
  buyerPhone: string | null;
  buyerEmail: string | null;
  buyerUserId: string | null;
  shopId: string | null;
}) {
  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const wonStage = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
  });
  if (!lead) return null;

  const prevMeta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const productNames = input.items.map((i) => i.title);
  const paid = isTiktokShopPaidStatus(input.status);
  const marketingEligible = Boolean(input.buyerPhone || input.buyerEmail);

  const updatedLead = await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: paid ? "WON" : lead.status === "WON" ? "WON" : "OPEN",
      stageId: paid ? wonStage?.id ?? lead.stageId : lead.stageId,
      dealValue: new Prisma.Decimal(input.totalCents / 100),
      source: lead.source || LEAD_SOURCE,
      metadata: {
        ...prevMeta,
        channel: "marketplace",
        provider: "TIKTOK_SHOP",
        marketplaceBuyer: true,
        marketingEligible,
        tiktokShopOrderId: input.externalOrderId,
        tiktokShopBuyerUserId: input.buyerUserId,
        tiktokShopShopId: input.shopId,
        orderId: input.orderId,
        productNames,
        lastTouchChannel: LEAD_SOURCE,
        lastTouchAt: new Date().toISOString(),
        ...(paid
          ? { paidAt: new Date().toISOString(), orderPending: false }
          : { orderPending: true }),
      },
    },
  });

  const contact = await prisma.nativeContact.findFirst({
    where: { id: input.contactId, clienteId: input.workspaceId },
  });
  if (contact) {
    const cMeta =
      contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
        ? (contact.metadata as Record<string, unknown>)
        : {};
    await prisma.nativeContact.update({
      where: { id: contact.id },
      data: {
        metadata: {
          ...cMeta,
          marketplaceBuyer: true,
          marketingEligible,
          lastMarketplaceProvider: "TIKTOK_SHOP",
          lastTiktokShopOrderId: input.externalOrderId,
          tiktokShopBuyerUserId: input.buyerUserId,
          tiktokShopShopId: input.shopId,
          lastMarketplacePurchaseAt: new Date().toISOString(),
          lastMarketplaceProducts: productNames.slice(0, 10),
        },
      },
    });
  }

  return updatedLead;
}

export async function ingestTiktokShopOrder(input: {
  workspaceId: string;
  order: TiktokShopOrder;
  shopId?: string | null;
  notification?: Record<string, unknown> | null;
}) {
  const externalId = String(input.order.id || "").trim();
  if (!externalId) throw new Error("tiktok_shop_order_missing_id");

  const items = extractTiktokShopLineItems(input.order);
  const status = input.order.status ?? null;
  const totalCents = tiktokShopOrderTotalCents(input.order);
  const saleFeeCents = 0;
  const shippingCostCents = tiktokShopMoneyToCents(input.order.payment?.shipping_fee);
  const netCents = totalCents - saleFeeCents - shippingCostCents;
  const currency = input.order.payment?.currency ?? "BRL";
  const occurredAt = tiktokShopOrderOccurredAt(input.order);
  const buyer = extractTiktokShopBuyer(input.order);
  const shopId = input.shopId ? String(input.shopId) : null;
  const paid = isTiktokShopPaidStatus(status);
  const rawPayload = { order: input.order, notification: input.notification ?? null } as object;

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "TIKTOK_SHOP",
        externalId,
      },
    },
    include: { items: { select: { id: true } } },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.marketplaceOrder.update({
        where: { id: existing.id },
        data: {
          status: status ?? existing.status,
          totalCents,
          saleFeeCents,
          shippingCostCents,
          netCents,
          currency,
          buyerName: buyer.name ?? existing.buyerName,
          buyerEmail: buyer.email ?? existing.buyerEmail,
          buyerPhone: buyer.phone ?? existing.buyerPhone,
          rawPayload,
          occurredAt,
        },
      });
      if (existing.items.length === 0 && items.length > 0) {
        await tx.marketplaceOrderItem.createMany({
          data: items.map((it) => ({ orderId: existing.id, ...it })),
        });
      }
    });

    if (existing.contactId && existing.leadId) {
      await markTiktokShopBuyerInCrm({
        workspaceId: input.workspaceId,
        contactId: existing.contactId,
        leadId: existing.leadId,
        orderId: existing.id,
        externalOrderId: externalId,
        totalCents,
        status,
        items,
        buyerPhone: buyer.phone ?? existing.buyerPhone,
        buyerEmail: buyer.email ?? existing.buyerEmail,
        buyerUserId: buyer.buyerUserId,
        shopId,
      });
    }

    if (paid) {
      await publishSafely([
        paidEvent({
          workspaceId: input.workspaceId,
          orderId: existing.id,
          externalId,
          amount: netCents / 100,
          currency,
          contactId: existing.contactId,
          leadId: existing.leadId,
          occurredAt,
        }),
      ]);
    }

    const refreshed = await prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: existing.id },
    });
    return { order: refreshed, created: false as const };
  }

  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: input.workspaceId,
    name: buyer.name,
    email: buyer.email,
    phone: buyer.phone,
    source: LEAD_SOURCE,
    metadata: {
      channel: "marketplace",
      provider: "TIKTOK_SHOP",
      marketplaceBuyer: true,
      tiktokShopOrderId: externalId,
      tiktokShopBuyerUserId: buyer.buyerUserId,
      tiktokShopShopId: shopId,
      tiktokShopStatus: status,
      productNames: items.map((i) => i.title),
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "TIKTOK_SHOP",
      externalId,
      status,
      totalCents,
      saleFeeCents,
      shippingCostCents,
      netCents,
      currency,
      contactId: contact.id,
      leadId: lead.id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      rawPayload,
      occurredAt,
      items: { create: items },
    },
  });

  const wonLead = await markTiktokShopBuyerInCrm({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    leadId: lead.id,
    orderId: order.id,
    externalOrderId: externalId,
    totalCents,
    status,
    items,
    buyerPhone: buyer.phone,
    buyerEmail: buyer.email,
    buyerUserId: buyer.buyerUserId,
    shopId,
  });
  const leadId = wonLead?.id ?? lead.id;

  const events: AtrakoEventList = [
    createEvent({
      id: createEventId(),
      name: "order.created",
      source: "tiktok",
      idempotencyKey: `tiktok-shop-order-${input.workspaceId}-${externalId}`,
      occurredAt: occurredAt.toISOString(),
      context: { workspaceId: input.workspaceId, orderId: order.id, contactId: contact.id, leadId },
      payload: { provider: "TIKTOK_SHOP", externalId, totalCents, netCents, status, currency },
    }),
    createEvent({
      id: createEventId(),
      name: "lead.created",
      source: "tiktok",
      idempotencyKey: `tiktok-shop-lead-${input.workspaceId}-${lead.id}-${externalId}`,
      occurredAt: occurredAt.toISOString(),
      context: { workspaceId: input.workspaceId, contactId: contact.id, leadId, orderId: order.id },
      payload: { source: LEAD_SOURCE, provider: "TIKTOK_SHOP", externalId },
    }),
  ];
  if (paid) {
    events.push(
      paidEvent({
        workspaceId: input.workspaceId,
        orderId: order.id,
        externalId,
        amount: netCents / 100,
        currency,
        contactId: contact.id,
        leadId,
        occurredAt,
      }),
    );
  }
  await publishSafely(events);

  return { order, created: true as const, contact, lead: wonLead ?? lead };
}

function paidEvent(input: {
  workspaceId: string;
  orderId: string;
  externalId: string;
  amount: number;
  currency: string;
  contactId: string | null;
  leadId: string | null;
  occurredAt: Date;
}) {
  return createEvent({
    id: createEventId(),
    name: "payment.paid",
    source: "tiktok",
    idempotencyKey: `tiktok-shop-paid-${input.workspaceId}-${input.externalId}`,
    occurredAt: input.occurredAt.toISOString(),
    context: {
      workspaceId: input.workspaceId,
      contactId: input.contactId ?? undefined,
      leadId: input.leadId ?? undefined,
      orderId: input.orderId,
    },
    payload: {
      provider: "TIKTOK_SHOP",
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
      description: `TikTok Shop ${input.externalId}`,
    },
  });
}

async function publishSafely(events: AtrakoEventList) {
  try {
    await publishAtrakoEvents(events);
  } catch {
    // Event bus não deve bloquear ingestão
  }
}

export async function upsertTiktokShopCatalogProduct(input: {
  workspaceId: string;
  product: TiktokShopProduct;
}) {
  const externalId = input.product.id ? String(input.product.id) : "";
  if (!externalId) return null;
  const title = String(input.product.title || "Produto").slice(0, 300);
  const sku = input.product.skus?.[0];
  const price = sku?.price?.sale_price ?? sku?.price?.tax_exclusive_price;
  const priceCents = price != null ? tiktokShopMoneyToCents(price) : null;
  const status = input.product.status ? String(input.product.status).slice(0, 40) : null;
  const sellerSku = sku?.seller_sku?.slice(0, 120) ?? null;

  return prisma.marketplaceCatalogItem.upsert({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "TIKTOK_SHOP",
        externalId,
      },
    },
    create: {
      clienteId: input.workspaceId,
      provider: "TIKTOK_SHOP",
      externalId,
      title,
      status,
      sku: sellerSku,
      priceCents,
      rawPayload: input.product as object,
    },
    update: {
      title,
      status,
      sku: sellerSku,
      priceCents,
      rawPayload: input.product as object,
    },
  });
}
