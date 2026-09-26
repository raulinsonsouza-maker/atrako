/**
 * Ingestão de pedido ML → pessoa/CRM (cliente de marketplace) + MarketplaceOrder + itens.
 * Pedido pago → lead Ganho com dealValue, pronto para promoções / WA.
 */

import { createEvent, createEventId, type AtrakoEvent } from "@atrako/events";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { publishAtrakoEvents } from "@/lib/atrako/events";
import {
  ensureDefaultPipeline,
  STAGE_ROLE_WON,
} from "@/lib/modules/crm";
import {
  extractMlBuyerContact,
  extractMlOrderItems,
  extractOrderEconomics,
  getMlOrder,
  type MlOrder,
  type NormalizedMlLineItem,
} from "./orders";
import { extractShippingEconomics, getMlShipment } from "./shipments";

const PAID_STATUSES = new Set(["paid", "confirmed"]);

function isPaidStatus(status: string | null | undefined) {
  return Boolean(status && PAID_STATUSES.has(status));
}

async function markMarketplaceBuyerInCrm(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
  orderId: string;
  externalOrderId: string;
  totalCents: number;
  status: string | null;
  items: NormalizedMlLineItem[];
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
  const productIds = input.items
    .map((i) => i.externalItemId)
    .filter((id): id is string => Boolean(id));
  const paid = isPaidStatus(input.status);
  const marketingEligible = Boolean(input.buyerPhone || input.buyerEmail);

  const updatedLead = await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: paid ? "WON" : lead.status === "WON" ? "WON" : "OPEN",
      stageId: paid ? wonStage?.id ?? lead.stageId : lead.stageId,
      dealValue: new Prisma.Decimal(input.totalCents / 100),
      source: lead.source || "mercadolivre",
      metadata: {
        ...prevMeta,
        channel: "marketplace",
        provider: "MERCADO_LIVRE",
        marketplaceBuyer: true,
        marketingEligible,
        meliOrderId: input.externalOrderId,
        orderId: input.orderId,
        productIds,
        productNames,
        lastTouchChannel: "mercadolivre",
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
          marketplaceBuyer: true,
          marketingEligible,
          lastMarketplaceProvider: "MERCADO_LIVRE",
          lastMarketplaceOrderId: input.externalOrderId,
          lastMarketplacePurchaseAt: new Date().toISOString(),
          lastMarketplaceProducts: productNames.slice(0, 10),
        },
      },
    });
  }

  return updatedLead;
}

export async function ingestMercadoLivreOrder(input: {
  workspaceId: string;
  orderId: string | number;
  notification?: Record<string, unknown> | null;
}) {
  const externalId = String(input.orderId);
  const mlOrder = await getMlOrder(input.workspaceId, externalId);
  const items = extractMlOrderItems(mlOrder);
  let shippingCostCents = 0;
  let shippingStatus: string | null = null;
  let shippingMode: string | null = null;
  let logisticType: string | null = null;
  const shippingId =
    mlOrder.shipping?.id != null ? String(mlOrder.shipping.id) : null;

  if (shippingId) {
    try {
      const shipment = await getMlShipment(input.workspaceId, shippingId);
      const ship = extractShippingEconomics(shipment);
      shippingCostCents = ship.shippingCostCents;
      shippingStatus = ship.shippingStatus;
      shippingMode = ship.shippingMode;
      logisticType = ship.logisticType;
    } catch {
      // frete pode ainda não estar disponível
    }
  }

  const economics = extractOrderEconomics(mlOrder, items, shippingCostCents);
  const totalCents = economics.totalCents;

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "MERCADO_LIVRE",
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
          status: mlOrder.status ?? existing.status,
          totalCents,
          saleFeeCents: economics.saleFeeCents,
          shippingCostCents: economics.shippingCostCents,
          netCents: economics.netCents,
          shippingId: shippingId ?? existing.shippingId,
          shippingStatus: shippingStatus ?? existing.shippingStatus,
          shippingMode: shippingMode ?? existing.shippingMode,
          logisticType: logisticType ?? existing.logisticType,
          currency: mlOrder.currency_id ?? existing.currency,
          rawPayload: {
            order: mlOrder,
            notification: input.notification ?? null,
          } as object,
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
      await markMarketplaceBuyerInCrm({
        workspaceId: input.workspaceId,
        contactId: existing.contactId,
        leadId: existing.leadId,
        orderId: existing.id,
        externalOrderId: externalId,
        totalCents,
        status: mlOrder.status ?? existing.status,
        items,
        buyerPhone: existing.buyerPhone,
        buyerEmail: existing.buyerEmail,
      });
    }

    const refreshed = await prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: existing.id },
    });
    return { order: refreshed, created: false as const };
  }

  return persistMlOrder({
    workspaceId: input.workspaceId,
    mlOrder,
    items,
    economics: {
      ...economics,
      shippingStatus,
      shippingMode,
      logisticType,
    },
    notification: input.notification,
  });
}

async function persistMlOrder(input: {
  workspaceId: string;
  mlOrder: MlOrder;
  items: NormalizedMlLineItem[];
  economics: {
    totalCents: number;
    saleFeeCents: number;
    shippingCostCents: number;
    netCents: number;
    shippingId: string | null;
    shippingStatus: string | null;
    shippingMode: string | null;
    logisticType: string | null;
  };
  notification?: Record<string, unknown> | null;
}) {
  const externalId = String(input.mlOrder.id);
  const buyer = extractMlBuyerContact(input.mlOrder);
  const items = input.items;
  const occurredAt = input.mlOrder.date_closed
    ? new Date(input.mlOrder.date_closed)
    : input.mlOrder.date_created
      ? new Date(input.mlOrder.date_created)
      : new Date();

  const marketingEligible = Boolean(buyer.phone || buyer.email);

  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: input.workspaceId,
    name: buyer.name,
    email: buyer.email,
    phone: buyer.phone,
    source: "mercadolivre",
    metadata: {
      channel: "marketplace",
      provider: "MERCADO_LIVRE",
      marketplaceBuyer: true,
      marketingEligible,
      meliOrderId: externalId,
      meliBuyerId: buyer.buyerId,
      meliStatus: input.mlOrder.status ?? null,
      itemCount: items.length,
      units: items.reduce((sum, it) => sum + it.quantity, 0),
      productNames: items.map((i) => i.title),
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "MERCADO_LIVRE",
      externalId,
      status: input.mlOrder.status ?? null,
      totalCents: input.economics.totalCents,
      saleFeeCents: input.economics.saleFeeCents,
      shippingCostCents: input.economics.shippingCostCents,
      netCents: input.economics.netCents,
      shippingId: input.economics.shippingId,
      shippingStatus: input.economics.shippingStatus,
      shippingMode: input.economics.shippingMode,
      logisticType: input.economics.logisticType,
      currency: input.mlOrder.currency_id ?? "BRL",
      contactId: contact.id,
      leadId: lead.id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      rawPayload: {
        order: input.mlOrder,
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

  const wonLead = await markMarketplaceBuyerInCrm({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    leadId: lead.id,
    orderId: order.id,
    externalOrderId: externalId,
    totalCents: input.economics.totalCents,
    status: input.mlOrder.status ?? null,
    items,
    buyerPhone: buyer.phone,
    buyerEmail: buyer.email,
  });

  try {
    const events: AtrakoEvent[] = [
      createEvent({
        id: createEventId(),
        name: "order.created",
        source: "mercadolivre",
        idempotencyKey: `ml-order-${input.workspaceId}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          orderId: order.id,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
        },
        payload: {
          provider: "MERCADO_LIVRE",
          externalId,
          totalCents: input.economics.totalCents,
          saleFeeCents: input.economics.saleFeeCents,
          shippingCostCents: input.economics.shippingCostCents,
          netCents: input.economics.netCents,
          status: order.status,
          marketingEligible,
          items: items.map((it) => ({
            id: it.externalItemId,
            title: it.title,
            quantity: it.quantity,
            lineTotalCents: it.lineTotalCents,
          })),
        },
      }),
      createEvent({
        id: createEventId(),
        name: "lead.created",
        source: "mercadolivre",
        idempotencyKey: `ml-lead-${input.workspaceId}-${lead.id}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
          orderId: order.id,
        },
        payload: {
          source: "mercadolivre",
          provider: "MERCADO_LIVRE",
          externalId,
          marketingEligible,
        },
      }),
    ];

    if (isPaidStatus(input.mlOrder.status)) {
      events.push(
        createEvent({
          id: createEventId(),
          name: "payment.paid",
          source: "mercadolivre",
          idempotencyKey: `ml-paid-${input.workspaceId}-${externalId}`,
          occurredAt: occurredAt.toISOString(),
          context: {
            workspaceId: input.workspaceId,
            contactId: contact.id,
            leadId: wonLead?.id ?? lead.id,
            orderId: order.id,
          },
          payload: {
            provider: "MERCADO_LIVRE",
            externalId,
            totalCents: input.economics.totalCents,
            netCents: input.economics.netCents,
            marketingEligible,
          },
        }),
      );
    }

    await publishAtrakoEvents(events);
  } catch {
    // Event bus não deve bloquear ingestão
  }

  return { order, created: true as const, contact, lead: wonLead ?? lead };
}
