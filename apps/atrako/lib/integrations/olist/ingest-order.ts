/**
 * Ingestão pedido Olist → MarketplaceOrder + CRM (+ match Woo/ML).
 * Vendas fechadas no ERP recuperam carrinho do canal e vão para Ganho.
 */

import { prisma } from "@/lib/db";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { trackOrderPayment } from "@/lib/crm/abandoned-cart";
import {
  linkOlistToChannel,
  resolveChannelMatch,
  resolveExistingPerson,
} from "./match-channel";
import { getOlistOrder, type OlistOrder } from "./orders";

const OLIST_PAID = new Set([
  "aprovada",
  "preparando_envio",
  "faturada",
  "pronto_envio",
  "enviada",
  "entregue",
]);

export function isOlistPaid(status: string) {
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
  const channel = await resolveChannelMatch(input.workspaceId, order);
  const existingPerson = channel
    ? null
    : await resolveExistingPerson(input.workspaceId, order);

  const existing = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: input.workspaceId,
        provider: "OLIST_ERP",
        externalId,
      },
    },
  });

  let contactId =
    channel?.contactId ?? existingPerson?.contactId ?? existing?.contactId ?? null;
  let leadId = channel?.leadId ?? existingPerson?.leadId ?? existing?.leadId ?? null;
  let personIsNew = false;

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
    personIsNew = true;
  } else {
    const person = await upsertPersonAndLead({
      workspaceId: input.workspaceId,
      name: order.buyerName,
      email: order.buyerEmail,
      phone: order.buyerPhone,
      source: channel ? channel.provider.toLowerCase() : "olist",
      metadata: {
        channel: channel ? "store" : "erp",
        provider: "OLIST_ERP",
        olistOrderId: externalId,
        enrichOnly: true,
        matchedProvider: channel?.provider ?? null,
      },
    }).catch(() => null);
    if (person) {
      contactId = person.contact.id;
      leadId = leadId ?? person.lead.id;
    }
  }

  const payload = {
    order: order.raw,
    numeroEcommerce: order.numeroEcommerce,
    matchedProvider: channel?.provider ?? null,
    matchedExternalId: channel?.externalId ?? null,
    matchedOrderId: channel?.orderId ?? null,
    matchedBy: channel?.matchedBy ?? null,
    wooExternalId: channel?.provider === "WOOCOMMERCE" ? channel.externalId : null,
    wooOrderId: channel?.provider === "WOOCOMMERCE" ? channel.orderId : null,
    mlExternalId: channel?.provider === "MERCADO_LIVRE" ? channel.externalId : null,
    mlOrderId: channel?.provider === "MERCADO_LIVRE" ? channel.orderId : null,
    existingContact: Boolean(existingPerson) && !channel,
    personIsNew,
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

  if (channel) {
    await linkOlistToChannel({
      olistOrderId: saved.id,
      olist: order,
      match: channel,
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
    matchedWoo: channel?.provider === "WOOCOMMERCE",
    matchedMl: channel?.provider === "MERCADO_LIVRE",
    matchedChannel: channel?.provider ?? null,
    reusedContact: Boolean(existingPerson) && !channel,
    personIsNew,
  };
}
