/**
 * Ingestão Nuvemshop → CRM + MarketplaceOrder + financeiro + atribuição.
 */

import { createEvent, createEventId } from "@atrako/events";
import { prisma } from "@/lib/db";
import { prisma as socialPrisma } from "@/lib/db-social";
import { Prisma } from "@/lib/generated/prisma";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { publishAtrakoEvents } from "@/lib/atrako/events";
import {
  ensureDefaultPipeline,
  STAGE_ROLE_WON,
} from "@/lib/modules/crm";
import { ingestPurchase } from "@/lib/symbius/attribution/engine";
import {
  extractNuvemshopBuyer,
  extractNuvemshopLineItems,
  isNuvemshopPaidStatus,
  nuvemshopOrderCurrency,
  nuvemshopOrderExternalId,
  nuvemshopOrderOccurredAt,
  nuvemshopOrderStatus,
  nuvemshopOrderTotalCents,
  type NormalizedNuvemshopLineItem,
  type NuvemshopOrder,
} from "./orders";

async function markNuvemshopBuyerInCrm(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
  orderId: string;
  externalOrderId: string;
  totalCents: number;
  status: string | null;
  items: NormalizedNuvemshopLineItem[];
  buyerPhone: string | null;
  buyerEmail: string | null;
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
  const paid = isNuvemshopPaidStatus(input.status);
  const marketingEligible = Boolean(input.buyerPhone || input.buyerEmail);

  const updatedLead = await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: paid ? "WON" : lead.status === "WON" ? "WON" : "OPEN",
      stageId: paid ? wonStage?.id ?? lead.stageId : lead.stageId,
      dealValue: new Prisma.Decimal(input.totalCents / 100),
      source: lead.source || "nuvemshop",
      metadata: {
        ...prevMeta,
        channel: "ecommerce",
        provider: "NUVEMSHOP",
        ecommerceBuyer: true,
        marketingEligible,
        nuvemshopOrderId: input.externalOrderId,
        orderId: input.orderId,
        productNames,
        lastTouchChannel: "nuvemshop",
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
      contact.metadata &&
      typeof contact.metadata === "object" &&
      !Array.isArray(contact.metadata)
        ? (contact.metadata as Record<string, unknown>)
        : {};
    await prisma.nativeContact.update({
      where: { id: contact.id },
      data: {
        metadata: {
          ...cMeta,
          ecommerceBuyer: true,
          marketingEligible,
          lastEcommerceProvider: "NUVEMSHOP",
          lastNuvemshopOrderId: input.externalOrderId,
          lastEcommercePurchaseAt: new Date().toISOString(),
          lastEcommerceProducts: productNames.slice(0, 10),
        },
      },
    });
  }

  return updatedLead;
}

export async function ingestNuvemshopHubOrder(input: {
  workspaceId: string;
  order: NuvemshopOrder;
  notification?: Record<string, unknown> | null;
}) {
  const externalId = nuvemshopOrderExternalId(input.order);
  const items = extractNuvemshopLineItems(input.order);
  const totalCents = nuvemshopOrderTotalCents(input.order);
  const status = nuvemshopOrderStatus(input.order);
  const currency = nuvemshopOrderCurrency(input.order);
  const occurredAt = nuvemshopOrderOccurredAt(input.order);
  const buyer = extractNuvemshopBuyer(input.order);

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "NUVEMSHOP",
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
          currency,
          buyerName: buyer.name ?? existing.buyerName,
          buyerEmail: buyer.email ?? existing.buyerEmail,
          buyerPhone: buyer.phone ?? existing.buyerPhone,
          rawPayload: {
            order: input.order,
            notification: input.notification ?? null,
          } as object,
          occurredAt,
        },
      });
      if (existing.items.length === 0 && items.length > 0) {
        await tx.marketplaceOrderItem.createMany({
          data: items.map((it) => ({
            orderId: existing.id,
            externalItemId: it.externalItemId,
            title: it.title,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            lineTotalCents: it.lineTotalCents,
            sku: it.sku,
          })),
        });
      }
    });

    if (existing.contactId && existing.leadId) {
      await markNuvemshopBuyerInCrm({
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
      });
    }

    if (isNuvemshopPaidStatus(status)) {
      await emitPaidEvent({
        workspaceId: input.workspaceId,
        orderId: existing.id,
        externalId,
        totalCents,
        currency,
        contactId: existing.contactId,
        leadId: existing.leadId,
        occurredAt,
      });
    }

    await maybeAttributePurchase(input.workspaceId, input.order);
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
    source: "nuvemshop",
    metadata: {
      channel: "ecommerce",
      provider: "NUVEMSHOP",
      nuvemshopOrderId: externalId,
      nuvemshopCustomerId: buyer.customerId,
      nuvemshopNumber: input.order.number ?? null,
      nuvemshopStatus: status,
      productNames: items.map((i) => i.title),
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "NUVEMSHOP",
      externalId,
      status,
      totalCents,
      currency,
      contactId: contact.id,
      leadId: lead.id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      rawPayload: {
        order: input.order,
        notification: input.notification ?? null,
      } as object,
      occurredAt,
      items: {
        create: items.map((it) => ({
          externalItemId: it.externalItemId,
          title: it.title,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          lineTotalCents: it.lineTotalCents,
          sku: it.sku,
        })),
      },
    },
  });

  const wonLead = await markNuvemshopBuyerInCrm({
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
  });

  try {
    const events = [
      createEvent({
        id: createEventId(),
        name: "order.created",
        source: "nuvemshop",
        idempotencyKey: `nuvemshop-order-${input.workspaceId}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          orderId: order.id,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
        },
        payload: {
          provider: "NUVEMSHOP",
          externalId,
          totalCents,
          amount: totalCents / 100,
          status,
          currency,
        },
      }),
      createEvent({
        id: createEventId(),
        name: "lead.created",
        source: "nuvemshop",
        idempotencyKey: `nuvemshop-lead-${input.workspaceId}-${lead.id}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
          orderId: order.id,
        },
        payload: {
          source: "nuvemshop",
          provider: "NUVEMSHOP",
          externalId,
        },
      }),
    ];

    if (isNuvemshopPaidStatus(status)) {
      events.push(
        createEvent({
          id: createEventId(),
          name: "payment.paid",
          source: "nuvemshop",
          idempotencyKey: `nuvemshop-paid-${input.workspaceId}-${externalId}`,
          occurredAt: occurredAt.toISOString(),
          context: {
            workspaceId: input.workspaceId,
            contactId: contact.id,
            leadId: wonLead?.id ?? lead.id,
            orderId: order.id,
          },
          payload: {
            provider: "NUVEMSHOP",
            externalId,
            amount: totalCents / 100,
            currency,
            description: `Nuvemshop #${input.order.number ?? externalId}`,
          },
        }),
      );
    }

    await publishAtrakoEvents(events);
  } catch {
    // ignore
  }

  await maybeAttributePurchase(input.workspaceId, input.order);

  return { order, created: true as const, contact, lead: wonLead ?? lead };
}

async function emitPaidEvent(input: {
  workspaceId: string;
  orderId: string;
  externalId: string;
  totalCents: number;
  currency: string;
  contactId: string | null;
  leadId: string | null;
  occurredAt: Date;
}) {
  try {
    await publishAtrakoEvents([
      createEvent({
        id: createEventId(),
        name: "payment.paid",
        source: "nuvemshop",
        idempotencyKey: `nuvemshop-paid-${input.workspaceId}-${input.externalId}`,
        occurredAt: input.occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          leadId: input.leadId,
          orderId: input.orderId,
        },
        payload: {
          provider: "NUVEMSHOP",
          externalId: input.externalId,
          amount: input.totalCents / 100,
          currency: input.currency,
          description: `Nuvemshop #${input.externalId}`,
        },
      }),
    ]);
  } catch {
    // ignore
  }
}

async function maybeAttributePurchase(
  workspaceId: string,
  order: NuvemshopOrder,
) {
  try {
    const org = await socialPrisma.organization.findFirst({
      where: { centralClienteId: workspaceId },
      select: { id: true },
    });
    if (!org) return;

    const buyer = extractNuvemshopBuyer(order);
    const totalCents = nuvemshopOrderTotalCents(order);
    const items = extractNuvemshopLineItems(order);

    await ingestPurchase({
      organizationId: org.id,
      transactionId: nuvemshopOrderExternalId(order),
      stId: null,
      email: buyer.email,
      phone: buyer.phone,
      customerId: buyer.customerId,
      value: totalCents / 100,
      currency: nuvemshopOrderCurrency(order),
      items: items.map((it) => ({
        id: it.externalItemId ?? it.sku ?? "item",
        name: it.title,
        quantity: it.quantity,
        price: it.unitPriceCents / 100,
      })),
      timestamp: nuvemshopOrderOccurredAt(order).toISOString(),
      eventId: `nuvemshop_${nuvemshopOrderExternalId(order)}`,
      rawPayload: order as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error(
      "[nuvemshop-attribution]",
      err instanceof Error ? err.message : "failed",
    );
  }
}

export async function upsertNuvemshopCatalogProduct(input: {
  workspaceId: string;
  productId: string;
  title: string;
  sku?: string | null;
  priceCents?: number | null;
  status?: string | null;
  raw?: unknown;
}) {
  await prisma.marketplaceCatalogItem.upsert({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "NUVEMSHOP",
        externalId: input.productId,
      },
    },
    create: {
      clienteId: input.workspaceId,
      provider: "NUVEMSHOP",
      externalId: input.productId,
      title: input.title,
      sku: input.sku ?? null,
      priceCents: input.priceCents ?? null,
      status: input.status ?? null,
      rawPayload: (input.raw ?? {}) as object,
    },
    update: {
      title: input.title,
      sku: input.sku ?? null,
      priceCents: input.priceCents ?? null,
      status: input.status ?? null,
      rawPayload: (input.raw ?? {}) as object,
    },
  });
}
