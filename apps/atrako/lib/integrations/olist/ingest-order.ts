/**
 * Ingestão pedido Olist → MarketplaceOrder + CRM (+ match Woo).
 */

import { prisma } from "@/lib/db";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { findWooOrderByEcommerceNumber, linkOlistToWoo } from "./match-woo";
import { getOlistOrder, type OlistOrder } from "./orders";

async function syncOlistItems(orderId: string, order: OlistOrder) {
  if (!order.items.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${orderId}))) AS l`;
    await tx.marketplaceOrderItem.deleteMany({ where: { orderId } });
    await tx.marketplaceOrderItem.createMany({
      data: order.items.map((it) => ({
        orderId,
        externalItemId: it.externalItemId,
        title: it.title.slice(0, 300),
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        lineTotalCents: it.unitPriceCents * it.quantity,
        sku: it.sku,
      })),
    });
  });
}

export async function ingestOlistOrder(input: {
  workspaceId: string;
  orderId?: string | number | null;
  order?: OlistOrder | null;
  /** Se true, busca detalhe completo (itens/cliente) na API. */
  fetchDetail?: boolean;
}) {
  let order = input.order ?? null;
  const id = input.orderId ?? order?.id;
  if (!order && id != null) {
    order = await getOlistOrder(input.workspaceId, id);
  } else if (order && input.fetchDetail !== false && id != null) {
    // Lista v2 vem sem e-mail/itens — completa.
    if (!order.buyerEmail || !order.items.length) {
      order = await getOlistOrder(input.workspaceId, id);
    }
  }
  if (!order?.id) throw new Error("pedido Olist inválido");

  const externalId = String(order.id);
  const woo = await findWooOrderByEcommerceNumber(input.workspaceId, order.numeroEcommerce);

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "OLIST_ERP",
        externalId,
      },
    },
  });

  let contactId = woo?.contactId ?? existing?.contactId ?? null;
  let leadId = woo?.leadId ?? existing?.leadId ?? null;

  if (!contactId) {
    const person = await upsertPersonAndLead({
      workspaceId: input.workspaceId,
      name: order.buyerName,
      email: order.buyerEmail,
      phone: order.buyerPhone,
      source: "olist",
      metadata: {
        channel: "erp",
        provider: "OLIST_ERP",
        olistOrderId: externalId,
        olistNumero: order.numero,
        numeroEcommerce: order.numeroEcommerce,
        olistStatus: order.status,
      },
    });
    contactId = person.contact.id;
    leadId = person.lead.id;
  } else if (order.buyerEmail || order.buyerPhone || order.buyerName) {
    // Enriquece contato Woo sem novo lead.
    await upsertPersonAndLead({
      workspaceId: input.workspaceId,
      name: order.buyerName,
      email: order.buyerEmail,
      phone: order.buyerPhone,
      source: "olist",
      metadata: {
        channel: "erp",
        provider: "OLIST_ERP",
        olistOrderId: externalId,
        enrichOnly: true,
      },
    }).catch(() => null);
  }

  const payload = {
    order: order.raw,
    numeroEcommerce: order.numeroEcommerce,
    wooExternalId: woo?.externalId ?? null,
    wooOrderId: woo?.orderId ?? null,
  };

  if (existing) {
    const updated = await prisma.marketplaceOrder.update({
      where: { id: existing.id },
      data: {
        status: order.status,
        totalCents: order.totalCents,
        currency: order.currency,
        buyerName: order.buyerName ?? existing.buyerName,
        buyerEmail: order.buyerEmail ?? existing.buyerEmail,
        buyerPhone: order.buyerPhone ?? existing.buyerPhone,
        stateUf: order.stateUf ?? existing.stateUf,
        cityRaw: order.cityRaw ?? existing.cityRaw,
        shippingStatus: order.shippingStatus,
        shippingId: order.trackingCode,
        contactId,
        leadId,
        occurredAt: order.occurredAt ?? existing.occurredAt,
        rawPayload: payload as object,
      },
    });
    await syncOlistItems(updated.id, order).catch((err) =>
      console.error("[olist-items]", err instanceof Error ? err.message : err),
    );
    if (woo) {
      await linkOlistToWoo({
        workspaceId: input.workspaceId,
        olistOrderId: updated.id,
        olist: order,
        woo,
      }).catch((err) => console.error("[olist-match]", err instanceof Error ? err.message : err));
    }
    return { order: updated, created: false as const, matchedWoo: Boolean(woo) };
  }

  const created = await prisma.marketplaceOrder.create({
    data: {
      clienteId: input.workspaceId,
      provider: "OLIST_ERP",
      externalId,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
      contactId,
      leadId,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      stateUf: order.stateUf,
      cityRaw: order.cityRaw,
      shippingStatus: order.shippingStatus,
      shippingId: order.trackingCode,
      rawPayload: payload as object,
      occurredAt: order.occurredAt ?? new Date(),
    },
  });

  await syncOlistItems(created.id, order).catch((err) =>
    console.error("[olist-items]", err instanceof Error ? err.message : err),
  );

  if (woo) {
    await linkOlistToWoo({
      workspaceId: input.workspaceId,
      olistOrderId: created.id,
      olist: order,
      woo,
    }).catch((err) => console.error("[olist-match]", err instanceof Error ? err.message : err));
  }

  return { order: created, created: true as const, matchedWoo: Boolean(woo) };
}
