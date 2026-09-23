/**
 * Ingestão de pedido WooCommerce → pessoa/CRM + MarketplaceOrder (+ atribuição).
 */

import { createEvent, createEventId } from "@atrako/events";
import { prisma } from "@/lib/db";
import { prisma as socialPrisma } from "@/lib/db-social";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { publishAtrakoEvents } from "@/lib/atrako/events";
import { ingestPurchase } from "@/lib/symbius/attribution/engine";
import {
  extractWooBuyerContact,
  getWooOrder,
  wooMetaValue,
  wooOrderTotalCents,
  type WooOrder,
} from "./orders";

export async function ingestWooCommerceOrder(input: {
  workspaceId: string;
  orderId?: string | number | null;
  order?: WooOrder | null;
  webhookPayload?: Record<string, unknown> | null;
}) {
  let wooOrder = input.order ?? null;
  if (!wooOrder) {
    const rawId = input.orderId ?? input.webhookPayload?.id;
    if (rawId == null || (typeof rawId !== "string" && typeof rawId !== "number")) {
      throw new Error("orderId obrigatório");
    }
    wooOrder = await getWooOrder(input.workspaceId, rawId);
  }

  const externalId = String(wooOrder.id);
  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "WOOCOMMERCE",
        externalId,
      },
    },
  });
  if (existing) {
    await maybeAttributePurchase(input.workspaceId, wooOrder);
    return { order: existing, created: false as const };
  }

  return persistWooOrder({
    workspaceId: input.workspaceId,
    wooOrder,
    webhookPayload: input.webhookPayload,
  });
}

async function persistWooOrder(input: {
  workspaceId: string;
  wooOrder: WooOrder;
  webhookPayload?: Record<string, unknown> | null;
}) {
  const externalId = String(input.wooOrder.id);
  const buyer = extractWooBuyerContact(input.wooOrder);
  const totalCents = wooOrderTotalCents(input.wooOrder);
  const occurredAt = input.wooOrder.date_paid
    ? new Date(input.wooOrder.date_paid)
    : input.wooOrder.date_created
      ? new Date(input.wooOrder.date_created)
      : new Date();

  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: input.workspaceId,
    name: buyer.name,
    email: buyer.email,
    phone: buyer.phone,
    source: "woocommerce",
    metadata: {
      channel: "ecommerce",
      provider: "WOOCOMMERCE",
      wooOrderId: externalId,
      wooCustomerId: buyer.customerId,
      wooStatus: input.wooOrder.status ?? null,
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "WOOCOMMERCE",
      externalId,
      status: input.wooOrder.status ?? null,
      totalCents,
      currency: input.wooOrder.currency ?? "BRL",
      contactId: contact.id,
      leadId: lead.id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      rawPayload: {
        order: input.wooOrder,
        webhook: input.webhookPayload ?? null,
      } as object,
      occurredAt,
    },
  });

  try {
    await publishAtrakoEvents([
      createEvent({
        id: createEventId(),
        name: "order.created",
        source: "commerce",
        idempotencyKey: `woo-order-${input.workspaceId}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          orderId: order.id,
          contactId: contact.id,
          leadId: lead.id,
        },
        payload: {
          provider: "WOOCOMMERCE",
          externalId,
          totalCents,
          status: order.status,
        },
      }),
      createEvent({
        id: createEventId(),
        name: "lead.created",
        source: "commerce",
        idempotencyKey: `woo-lead-${input.workspaceId}-${lead.id}-${externalId}`,
        occurredAt: occurredAt.toISOString(),
        context: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          leadId: lead.id,
          orderId: order.id,
        },
        payload: {
          source: "woocommerce",
          provider: "WOOCOMMERCE",
          externalId,
        },
      }),
    ]);
  } catch {
    // Event bus não deve bloquear ingestão
  }

  await maybeAttributePurchase(input.workspaceId, input.wooOrder);

  return { order, created: true as const, contact, lead };
}

async function maybeAttributePurchase(workspaceId: string, wooOrder: WooOrder) {
  try {
    const org = await socialPrisma.organization.findFirst({
      where: { centralClienteId: workspaceId },
      select: { id: true },
    });
    if (!org) return;

    const buyer = extractWooBuyerContact(wooOrder);
    const stId =
      wooMetaValue(wooOrder, "symbius_lead_id") ||
      wooMetaValue(wooOrder, "st_id") ||
      null;
    const total = Number(wooOrder.total ?? 0);
    if (!Number.isFinite(total)) return;

    await ingestPurchase({
      organizationId: org.id,
      transactionId: String(wooOrder.id),
      stId,
      email: buyer.email,
      phone: buyer.phone,
      customerId: buyer.customerId != null ? String(buyer.customerId) : null,
      value: total,
      currency: wooOrder.currency ?? "BRL",
      items: (wooOrder.line_items ?? []).map((it) => ({
        id: String(it.product_id ?? it.sku ?? it.id ?? "item"),
        name: String(it.name ?? ""),
        quantity: Number(it.quantity ?? 1),
        price: Number(it.total ?? 0) / Math.max(1, Number(it.quantity ?? 1)),
      })),
      timestamp: wooOrder.date_paid || wooOrder.date_created || null,
      eventId: `woocommerce_${wooOrder.id}`,
      rawPayload: wooOrder as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error(
      "[woo-attribution]",
      err instanceof Error ? err.message : "failed",
    );
  }
}
