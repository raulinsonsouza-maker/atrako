/**
 * Ingestão pedido Olist → MarketplaceOrder + CRM (+ match Woo).
 * Vendas fechadas no ERP (proposta/PDV) recuperam carrinho Woo e vão para Ganho.
 */

import { prisma } from "@/lib/db";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { trackOrderPayment } from "@/lib/crm/abandoned-cart";
import { linkOlistToWoo, resolveWooMatch } from "./match-woo";
import { getOlistOrder, type OlistOrder } from "./orders";

const OLIST_PAID = new Set([
  "aprovada",
  "preparando_envio",
  "faturada",
  "pronto_envio",
  "enviada",
  "entregue",
]);

function isOlistPaid(status: string) {
  return OLIST_PAID.has((status || "").toLowerCase());
}

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

async function syncOlistCrmState(input: {
  workspaceId: string;
  order: OlistOrder;
  contactId: string | null;
  leadId: string | null;
}) {
  if (!isOlistPaid(input.order.status)) return;
  try {
    await trackOrderPayment({
      workspaceId: input.workspaceId,
      provider: "OLIST_ERP",
      externalOrderId: String(input.order.id),
      paid: true,
      occurredAt: input.order.occurredAt ?? new Date(),
      totalCents: input.order.totalCents,
      currency: input.order.currency,
      contactId: input.contactId,
      leadId: input.leadId,
      name: input.order.buyerName,
      email: input.order.buyerEmail,
      phone: input.order.buyerPhone,
      items: input.order.items.map((it) => ({
        title: it.title,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        sku: it.sku,
      })),
    });
  } catch (err) {
    console.error("[olist-crm]", err instanceof Error ? err.message : err);
  }
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
    if (!order.buyerEmail || !order.items.length) {
      order = await getOlistOrder(input.workspaceId, id);
    }
  }
  if (!order?.id) throw new Error("pedido Olist inválido");

  const externalId = String(order.id);
  const woo = await resolveWooMatch(input.workspaceId, order);

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
    matchedBy: woo?.matchedBy ?? null,
  };

  const saved = existing
    ? await prisma.marketplaceOrder.update({
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
      })
    : await prisma.marketplaceOrder.create({
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

  await syncOlistItems(saved.id, order).catch((err) =>
    console.error("[olist-items]", err instanceof Error ? err.message : err),
  );

  if (woo) {
    await linkOlistToWoo({
      workspaceId: input.workspaceId,
      olistOrderId: saved.id,
      olist: order,
      woo,
    }).catch((err) => console.error("[olist-match]", err instanceof Error ? err.message : err));
  }

  await syncOlistCrmState({
    workspaceId: input.workspaceId,
    order,
    contactId,
    leadId,
  });

  return {
    order: saved,
    created: !existing,
    matchedWoo: Boolean(woo),
  };
}
