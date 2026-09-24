/**
 * Ingestão Shopify → CRM + MarketplaceOrder + itens + financeiro + atribuição.
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
  extractShopifyBuyer,
  extractShopifyLineItems,
  isShopifyPaidStatus,
  shopifyNoteValue,
  shopifyOrderCurrency,
  shopifyOrderExternalId,
  shopifyOrderOccurredAt,
  shopifyOrderStatus,
  shopifyOrderTotalCents,
  type NormalizedShopifyLineItem,
  type ShopifyOrder,
} from "./orders";

async function markShopifyBuyerInCrm(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
  orderId: string;
  externalOrderId: string;
  totalCents: number;
  status: string | null;
  items: NormalizedShopifyLineItem[];
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
  const paid = isShopifyPaidStatus(input.status);
  const marketingEligible = Boolean(input.buyerPhone || input.buyerEmail);

  const updatedLead = await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      status: paid ? "WON" : lead.status === "WON" ? "WON" : "OPEN",
      stageId: paid ? wonStage?.id ?? lead.stageId : lead.stageId,
      dealValue: new Prisma.Decimal(input.totalCents / 100),
      source: lead.source || "shopify",
      metadata: {
        ...prevMeta,
        channel: "ecommerce",
        provider: "SHOPIFY",
        ecommerceBuyer: true,
        marketingEligible,
        shopifyOrderId: input.externalOrderId,
        orderId: input.orderId,
        productNames,
        lastTouchChannel: "shopify",
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
          lastEcommerceProvider: "SHOPIFY",
          lastShopifyOrderId: input.externalOrderId,
          lastEcommercePurchaseAt: new Date().toISOString(),
          lastEcommerceProducts: productNames.slice(0, 10),
        },
      },
    });
  }

  return updatedLead;
}

export async function ingestShopifyHubOrder(input: {
  workspaceId: string;
  order: ShopifyOrder;
  webhookPayload?: Record<string, unknown> | null;
}) {
  const externalId = shopifyOrderExternalId(input.order);
  const items = extractShopifyLineItems(input.order);
  const totalCents = shopifyOrderTotalCents(input.order);
  const status = shopifyOrderStatus(input.order);
  const currency = shopifyOrderCurrency(input.order);
  const occurredAt = shopifyOrderOccurredAt(input.order);
  const buyer = extractShopifyBuyer(input.order);

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "SHOPIFY",
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
            webhook: input.webhookPayload ?? null,
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
      await markShopifyBuyerInCrm({
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

    if (isShopifyPaidStatus(status)) {
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
    source: "shopify",
    metadata: {
      channel: "ecommerce",
      provider: "SHOPIFY",
      shopifyOrderId: externalId,
      shopifyCustomerId: buyer.customerId,
      shopifyStatus: status,
      productNames: items.map((i) => i.title),
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "SHOPIFY",
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
        webhook: input.webhookPayload ?? null,
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

  const wonLead = await markShopifyBuyerInCrm({
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
        source: "shopify",
        idempotencyKey: `shopify-order-${input.workspaceId}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          orderId: order.id,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
        },
        payload: {
          provider: "SHOPIFY",
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
        source: "shopify",
        idempotencyKey: `shopify-lead-${input.workspaceId}-${lead.id}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          leadId: wonLead?.id ?? lead.id,
          orderId: order.id,
        },
        payload: {
          source: "shopify",
          provider: "SHOPIFY",
          externalId,
        },
      }),
    ];

    if (isShopifyPaidStatus(status)) {
      events.push(
        createEvent({
          id: createEventId(),
          name: "payment.paid",
          source: "shopify",
          idempotencyKey: `shopify-paid-${input.workspaceId}-${externalId}`,
          occurredAt: occurredAt.toISOString(),
          context: {
            workspaceId: input.workspaceId,
            contactId: contact.id,
            leadId: wonLead?.id ?? lead.id,
            orderId: order.id,
          },
          payload: {
            provider: "SHOPIFY",
            externalId,
            amount: totalCents / 100,
            currency,
            description: `Shopify #${externalId}`,
          },
        }),
      );
    }

    await publishAtrakoEvents(events);
  } catch {
    // Event bus não deve bloquear ingestão
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
        source: "shopify",
        idempotencyKey: `shopify-paid-${input.workspaceId}-${input.externalId}`,
        occurredAt: input.occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          leadId: input.leadId,
          orderId: input.orderId,
        },
        payload: {
          provider: "SHOPIFY",
          externalId: input.externalId,
          amount: input.totalCents / 100,
          currency: input.currency,
          description: `Shopify #${input.externalId}`,
        },
      }),
    ]);
  } catch {
    // ignore
  }
}

async function maybeAttributePurchase(workspaceId: string, order: ShopifyOrder) {
  try {
    const org = await socialPrisma.organization.findFirst({
      where: { centralClienteId: workspaceId },
      select: { id: true },
    });
    if (!org) return;

    const buyer = extractShopifyBuyer(order);
    const stId =
      shopifyNoteValue(order, "symbius_lead_id") ||
      shopifyNoteValue(order, "st_id") ||
      null;
    const totalCents = shopifyOrderTotalCents(order);
    const items = extractShopifyLineItems(order);

    await ingestPurchase({
      organizationId: org.id,
      transactionId: shopifyOrderExternalId(order),
      stId,
      email: buyer.email,
      phone: buyer.phone,
      customerId: buyer.customerId,
      value: totalCents / 100,
      currency: shopifyOrderCurrency(order),
      items: items.map((it) => ({
        id: it.externalItemId ?? it.sku ?? "item",
        name: it.title,
        quantity: it.quantity,
        price: it.unitPriceCents / 100,
      })),
      timestamp: shopifyOrderOccurredAt(order).toISOString(),
      eventId: `shopify_${shopifyOrderExternalId(order)}`,
      rawPayload: order as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error(
      "[shopify-attribution]",
      err instanceof Error ? err.message : "failed",
    );
  }
}

export async function ingestShopifyCustomer(input: {
  workspaceId: string;
  customer: {
    id?: string | number | null;
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
}) {
  const first = input.customer.first_name || input.customer.firstName || "";
  const last = input.customer.last_name || input.customer.lastName || "";
  const name = `${first} ${last}`.trim() || null;
  const email = input.customer.email || null;
  const phone = input.customer.phone || null;
  if (!email && !phone && !name) return null;

  let customerId: string | null = null;
  if (input.customer.id != null) {
    const s = String(input.customer.id);
    const gid = s.match(/Customer\/(\d+)/);
    customerId = gid ? gid[1] : s.replace(/\D/g, "") || s;
  }

  return upsertPersonAndLead({
    workspaceId: input.workspaceId,
    name,
    email,
    phone,
    source: "shopify",
    metadata: {
      channel: "ecommerce",
      provider: "SHOPIFY",
      shopifyCustomerId: customerId,
    },
  });
}

export async function upsertShopifyCatalogProduct(input: {
  workspaceId: string;
  product: {
    id?: string | number | null;
    title?: string | null;
    status?: string | null;
    variants?: Array<{ sku?: string | null; price?: string | number | null }>;
  };
  raw?: unknown;
}) {
  let externalId = "";
  if (input.product.id != null) {
    const s = String(input.product.id);
    const gid = s.match(/Product\/(\d+)/);
    externalId = gid ? gid[1] : s.replace(/\D/g, "") || s;
  }
  if (!externalId) return null;

  const title = String(input.product.title || "Produto").slice(0, 300);
  const variant = input.product.variants?.[0];
  const sku = variant?.sku ? String(variant.sku).slice(0, 120) : null;
  let priceCents: number | null = null;
  if (variant?.price != null) {
    const n = Number(variant.price);
    if (Number.isFinite(n)) priceCents = Math.round(n * 100);
  }

  return prisma.marketplaceCatalogItem.upsert({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "SHOPIFY",
        externalId,
      },
    },
    create: {
      clienteId: input.workspaceId,
      provider: "SHOPIFY",
      externalId,
      title,
      status: input.product.status ? String(input.product.status).slice(0, 40) : null,
      sku,
      priceCents,
      rawPayload: (input.raw ?? input.product) as object,
    },
    update: {
      title,
      status: input.product.status ? String(input.product.status).slice(0, 40) : null,
      sku,
      priceCents,
      rawPayload: (input.raw ?? input.product) as object,
    },
  });
}
