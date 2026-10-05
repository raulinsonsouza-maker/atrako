/**
 * Ingestão de pedido WooCommerce → pessoa/CRM + MarketplaceOrder (+ atribuição).
 */

import { createEvent, createEventId } from "@atrako/events";
import { prisma } from "@/lib/db";
import { prisma as socialPrisma } from "@/lib/db-social";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { publishAtrakoEvents } from "@/lib/atrako/events";
import { ingestPurchase } from "@/lib/symbius/attribution/engine";
import { reconcileOrderSources } from "@/lib/commerce-attribution/reconcile";
import { markLeadLost, trackOrderPayment } from "@/lib/crm/abandoned-cart";
import { birthDateFromStorePayload, upsertContactBirthday } from "@/lib/flows/important-dates";
import {
  extractWooBuyerContact,
  getWooOrder,
  isWooPaidOrder,
  isWooRefundedOrder,
  isWooUnpaidOrder,
  wooMetaValue,
  wooOrderItemsEnriched,
  wooOrderTotalCents,
  type WooOrder,
} from "./orders";

/** MarketplaceOrderItem com foto/link — base de recomendações, recompra e itens no e-mail. */
async function syncWooOrderItems(workspaceId: string, orderId: string, wooOrder: WooOrder) {
  const items = await wooOrderItemsEnriched(workspaceId, wooOrder);
  if (!items.length) return;
  await prisma.$transaction([
    prisma.marketplaceOrderItem.deleteMany({ where: { orderId } }),
    prisma.marketplaceOrderItem.createMany({
      data: items.map((it) => ({
        orderId,
        externalItemId: it.externalItemId,
        title: it.title.slice(0, 300),
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        lineTotalCents: it.unitPriceCents * it.quantity,
        sku: it.sku?.slice(0, 120) ?? null,
        imageUrl: it.imageUrl?.slice(0, 1000) ?? null,
        productUrl: it.productUrl?.slice(0, 1000) ?? null,
      })),
    }),
  ]);
}

/** Pago → Ganho (+ recupera carrinho); não pago → carrinho abandonado; reembolso → Perdido. */
async function syncWooOrderState(input: {
  workspaceId: string;
  wooOrder: WooOrder;
  contactId: string | null;
  leadId: string | null;
  occurredAt: Date;
}) {
  if (isWooRefundedOrder(input.wooOrder)) {
    if (input.leadId) {
      await markLeadLost(input.workspaceId, input.leadId, "reembolso", {
        lostOrderRef: `WOOCOMMERCE:${input.wooOrder.id}`,
      }).catch((err) => console.error("[woo-lost]", err));
    }
    return;
  }
  const paid = isWooPaidOrder(input.wooOrder);
  if (!paid && !isWooUnpaidOrder(input.wooOrder)) return;
  const buyer = extractWooBuyerContact(input.wooOrder);
  try {
    await trackOrderPayment({
      workspaceId: input.workspaceId,
      provider: "WOOCOMMERCE",
      externalOrderId: String(input.wooOrder.id),
      paid,
      occurredAt: input.wooOrder.date_created ? new Date(input.wooOrder.date_created) : input.occurredAt,
      totalCents: wooOrderTotalCents(input.wooOrder),
      currency: input.wooOrder.currency,
      contactId: input.contactId,
      leadId: input.leadId,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      items: await wooOrderItemsEnriched(input.workspaceId, input.wooOrder),
      recoveryUrl: input.wooOrder.payment_url || null,
    });
  } catch (err) {
    console.error("[woo-abandoned-cart]", err instanceof Error ? err.message : err);
  }
}

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
    const buyer = extractWooBuyerContact(wooOrder);
    await prisma.marketplaceOrder.update({
      where: { id: existing.id },
      data: {
        status: wooOrder.status ?? existing.status,
        totalCents: wooOrderTotalCents(wooOrder),
        currency: wooOrder.currency ?? existing.currency,
        buyerName: buyer.name ?? existing.buyerName,
        buyerEmail: buyer.email ?? existing.buyerEmail,
        buyerPhone: buyer.phone ?? existing.buyerPhone,
        occurredAt: wooOrder.date_paid
          ? new Date(wooOrder.date_paid)
          : wooOrder.date_created
            ? new Date(wooOrder.date_created)
            : existing.occurredAt,
        rawPayload: {
          order: wooOrder,
          webhook: input.webhookPayload ?? null,
        } as object,
      },
    });
    await syncWooOrderItems(input.workspaceId, existing.id, wooOrder).catch((err) =>
      console.error("[woo-items]", err instanceof Error ? err.message : err),
    );
    await maybeAttributePurchase(input.workspaceId, wooOrder);
    await refreshWooOrderSource(input.workspaceId, wooOrder);
    const updated = await prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: existing.id },
    });
    await syncWooOrderState({
      workspaceId: input.workspaceId,
      wooOrder,
      contactId: updated.contactId,
      leadId: updated.leadId,
      occurredAt: updated.occurredAt ?? updated.createdAt,
    });
    return { order: updated, created: false as const };
  }

  // Rascunho do checkout em blocos: sem dados de comprador, não é pedido ainda.
  if ((wooOrder.status ?? "").toLowerCase() === "checkout-draft") {
    return { order: null, created: false as const, skipped: "checkout-draft" as const };
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
  await syncWooOrderItems(input.workspaceId, order.id, input.wooOrder).catch((err) =>
    console.error("[woo-items]", err instanceof Error ? err.message : err),
  );
  const birth = birthDateFromStorePayload("WOOCOMMERCE", input.wooOrder);
  if (birth) {
    await upsertContactBirthday({ workspaceId: input.workspaceId, contactId: contact.id, raw: birth, source: "woocommerce" }).catch(
      () => null,
    );
  }

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
  await refreshWooOrderSource(input.workspaceId, input.wooOrder);
  await syncWooOrderState({
    workspaceId: input.workspaceId,
    wooOrder: input.wooOrder,
    contactId: contact.id,
    leadId: lead.id,
    occurredAt,
  });

  return { order, created: true as const, contact, lead };
}

/** Origem do pedido (UTM da loja + anúncio Meta conciliado) para o dia em que foi criado. */
async function refreshWooOrderSource(workspaceId: string, wooOrder: WooOrder) {
  const day = /^\d{4}-\d{2}-\d{2}/.test(wooOrder.date_created ?? "")
    ? wooOrder.date_created!.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  await reconcileOrderSources(workspaceId, { dateFrom: day, dateTo: day }).catch((err) =>
    console.error("[woo-order-source]", err instanceof Error ? err.message : err),
  );
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
