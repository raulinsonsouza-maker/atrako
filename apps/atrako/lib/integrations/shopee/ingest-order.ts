/**
 * Ingestão Shopee → CRM + MarketplaceOrder + itens + financeiro.
 */

import { createEvent, createEventId } from "@atrako/events";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { publishAtrakoEvents } from "@/lib/atrako/events";
import {
  ensureDefaultPipeline,
  STAGE_ROLE_WON,
} from "@/lib/modules/crm";
import {
  extractShopeeBuyer,
  extractShopeeLineItems,
  getShopeeEscrowDetail,
  isShopeePaidStatus,
  shopeeOrderOccurredAt,
  shopeeOrderTotalCents,
  type NormalizedShopeeLineItem,
  type ShopeeOrderDetail,
} from "./orders";

async function markShopeeBuyerInCrm(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
  orderId: string;
  externalOrderId: string;
  totalCents: number;
  status: string | null;
  items: NormalizedShopeeLineItem[];
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
  const paid = isShopeePaidStatus(input.status);
  const marketingEligible = Boolean(input.buyerPhone || input.buyerEmail);

  const updatedLead = await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: paid ? "WON" : lead.status === "WON" ? "WON" : "OPEN",
      stageId: paid ? wonStage?.id ?? lead.stageId : lead.stageId,
      dealValue: new Prisma.Decimal(input.totalCents / 100),
      source: lead.source || "shopee",
      metadata: {
        ...prevMeta,
        channel: "marketplace",
        provider: "SHOPEE",
        marketplaceBuyer: true,
        marketingEligible,
        shopeeOrderSn: input.externalOrderId,
        shopeeBuyerUserId: input.buyerUserId,
        shopeeShopId: input.shopId,
        orderId: input.orderId,
        productNames,
        lastTouchChannel: "shopee",
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
          lastMarketplaceProvider: "SHOPEE",
          lastShopeeOrderSn: input.externalOrderId,
          shopeeBuyerUserId: input.buyerUserId,
          shopeeShopId: input.shopId,
          lastMarketplacePurchaseAt: new Date().toISOString(),
          lastMarketplaceProducts: productNames.slice(0, 10),
        },
      },
    });
  }

  return updatedLead;
}

export async function ingestShopeeOrder(input: {
  workspaceId: string;
  order: ShopeeOrderDetail;
  shopId?: string | number | null;
  notification?: Record<string, unknown> | null;
}) {
  const externalId = String(input.order.order_sn || "").trim();
  if (!externalId) throw new Error("shopee_order_missing_sn");

  const items = extractShopeeLineItems(input.order);
  const status = input.order.order_status ?? null;
  let totalCents = shopeeOrderTotalCents(input.order);
  let saleFeeCents = 0;
  let netCents: number | null = null;
  const shippingCostCents = Math.round(
    (input.order.actual_shipping_fee ??
      input.order.estimated_shipping_fee ??
      0) * 100,
  );
  const currency = input.order.currency ?? "BRL";
  const occurredAt = shopeeOrderOccurredAt(input.order);
  const buyer = extractShopeeBuyer(input.order);
  const shopId =
    input.shopId != null
      ? String(input.shopId)
      : null;

  if (isShopeePaidStatus(status)) {
    const escrow = await getShopeeEscrowDetail(input.workspaceId, externalId);
    const income = escrow?.order_income;
    if (income) {
      if (typeof income.buyer_total_amount === "number") {
        totalCents = Math.round(income.buyer_total_amount * 100);
      }
      const fees =
        (income.commission_fee ?? 0) + (income.service_fee ?? 0);
      saleFeeCents = Math.round(fees * 100);
      if (typeof income.escrow_amount === "number") {
        netCents = Math.round(income.escrow_amount * 100);
      }
    }
  }
  if (netCents == null) {
    netCents = totalCents - saleFeeCents - shippingCostCents;
  }

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "SHOPEE",
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
      await markShopeeBuyerInCrm({
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

    if (isShopeePaidStatus(status)) {
      await emitPaidEvent({
        workspaceId: input.workspaceId,
        orderId: existing.id,
        externalId,
        amount: (netCents ?? totalCents) / 100,
        currency,
        contactId: existing.contactId,
        leadId: existing.leadId,
        occurredAt,
      });
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
    source: "shopee",
    metadata: {
      channel: "marketplace",
      provider: "SHOPEE",
      marketplaceBuyer: true,
      shopeeOrderSn: externalId,
      shopeeBuyerUserId: buyer.buyerUserId,
      shopeeShopId: shopId,
      shopeeStatus: status,
      productNames: items.map((i) => i.title),
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "SHOPEE",
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

  const wonLead = await markShopeeBuyerInCrm({
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

  try {
    const events = [
      createEvent({
        id: createEventId(),
        name: "order.created",
        source: "shopee",
        idempotencyKey: `shopee-order-${input.workspaceId}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          orderId: order.id,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
        },
        payload: {
          provider: "SHOPEE",
          externalId,
          totalCents,
          netCents,
          status,
          currency,
        },
      }),
      createEvent({
        id: createEventId(),
        name: "lead.created",
        source: "shopee",
        idempotencyKey: `shopee-lead-${input.workspaceId}-${lead.id}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
          orderId: order.id,
        },
        payload: {
          source: "shopee",
          provider: "SHOPEE",
          externalId,
        },
      }),
    ];

    if (isShopeePaidStatus(status)) {
      events.push(
        createEvent({
          id: createEventId(),
          name: "payment.paid",
          source: "shopee",
          idempotencyKey: `shopee-paid-${input.workspaceId}-${externalId}`,
          occurredAt: occurredAt.toISOString(),
          context: {
            workspaceId: input.workspaceId,
            contactId: contact.id,
            leadId: wonLead?.id ?? lead.id,
            orderId: order.id,
          },
          payload: {
            provider: "SHOPEE",
            externalId,
            amount: (netCents ?? totalCents) / 100,
            currency,
            description: `Shopee ${externalId}`,
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

async function emitPaidEvent(input: {
  workspaceId: string;
  orderId: string;
  externalId: string;
  amount: number;
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
        source: "shopee",
        idempotencyKey: `shopee-paid-${input.workspaceId}-${input.externalId}`,
        occurredAt: input.occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          leadId: input.leadId,
          orderId: input.orderId,
        },
        payload: {
          provider: "SHOPEE",
          externalId: input.externalId,
          amount: input.amount,
          currency: input.currency,
          description: `Shopee ${input.externalId}`,
        },
      }),
    ]);
  } catch {
    // ignore
  }
}

export async function upsertShopeeCatalogProduct(input: {
  workspaceId: string;
  item: {
    item_id?: number;
    item_name?: string;
    item_sku?: string;
    item_status?: string;
    price_info?: Array<{ current_price?: number }>;
  };
}) {
  const externalId =
    input.item.item_id != null ? String(input.item.item_id) : "";
  if (!externalId) return null;
  const title = String(input.item.item_name || "Produto").slice(0, 300);
  const price = input.item.price_info?.[0]?.current_price;
  const priceCents =
    typeof price === "number" && Number.isFinite(price)
      ? Math.round(price * 100)
      : null;

  return prisma.marketplaceCatalogItem.upsert({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "SHOPEE",
        externalId,
      },
    },
    create: {
      clienteId: input.workspaceId,
      provider: "SHOPEE",
      externalId,
      title,
      status: input.item.item_status
        ? String(input.item.item_status).slice(0, 40)
        : null,
      sku: input.item.item_sku?.slice(0, 120) ?? null,
      priceCents,
      rawPayload: input.item as object,
    },
    update: {
      title,
      status: input.item.item_status
        ? String(input.item.item_status).slice(0, 40)
        : null,
      sku: input.item.item_sku?.slice(0, 120) ?? null,
      priceCents,
      rawPayload: input.item as object,
    },
  });
}
