/**
 * Cruza pedido Olist com WooCommerce:
 * 1) numeroPedidoEcommerce → externalId Woo
 * 2) fallback: e-mail/telefone (+ valor) quando a venda foi fechada no ERP (proposta)
 *    sem número do e-commerce.
 */

import { prisma } from "@/lib/db";
import type { OlistOrder } from "./orders";

export type WooMatch = {
  orderId: string;
  contactId: string | null;
  leadId: string | null;
  externalId: string;
  matchedBy: "ecommerce_number" | "buyer_email_phone";
};

export async function findWooOrderByEcommerceNumber(
  workspaceId: string,
  numeroEcommerce: string | null | undefined,
): Promise<WooMatch | null> {
  const externalId = (numeroEcommerce ?? "").trim();
  if (!externalId) return null;

  const woo = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: workspaceId,
        provider: "WOOCOMMERCE",
        externalId,
      },
    },
    select: {
      id: true,
      contactId: true,
      leadId: true,
      externalId: true,
    },
  });
  if (!woo) return null;
  return {
    orderId: woo.id,
    contactId: woo.contactId,
    leadId: woo.leadId,
    externalId: woo.externalId,
    matchedBy: "ecommerce_number",
  };
}

/** Match por comprador quando a venda nasceu de proposta/PDV sem numero_ecommerce. */
export async function findWooOrderByBuyer(
  workspaceId: string,
  order: Pick<OlistOrder, "buyerEmail" | "buyerPhone" | "totalCents" | "buyerName">,
): Promise<WooMatch | null> {
  const email = order.buyerEmail?.trim().toLowerCase() || null;
  const phoneDigits = (order.buyerPhone ?? "").replace(/\D/g, "");
  const phone = phoneDigits.length >= 10 ? phoneDigits : null;
  if (!email && !phone) return null;

  const contact = await prisma.nativeContact.findFirst({
    where: {
      clienteId: workspaceId,
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(phone
          ? [
              { phone: { contains: phone.slice(-8) } },
              { phoneE164: { contains: phone.slice(-8) } },
            ]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!contact) return null;

  const candidates = await prisma.marketplaceOrder.findMany({
    where: {
      clienteId: workspaceId,
      provider: "WOOCOMMERCE",
      contactId: contact.id,
    },
    orderBy: { occurredAt: "desc" },
    take: 20,
    select: {
      id: true,
      contactId: true,
      leadId: true,
      externalId: true,
      totalCents: true,
      status: true,
    },
  });
  if (!candidates.length) return null;

  const total = order.totalCents ?? 0;
  const sameValue = candidates.find(
    (c) => c.totalCents != null && Math.abs((c.totalCents ?? 0) - total) <= 100,
  );
  const unpaid = candidates.find((c) =>
    ["pending", "on-hold", "cancelled", "failed"].includes((c.status ?? "").toLowerCase()),
  );
  const pick = sameValue ?? unpaid ?? candidates[0];
  if (!pick) return null;

  return {
    orderId: pick.id,
    contactId: pick.contactId,
    leadId: pick.leadId,
    externalId: pick.externalId,
    matchedBy: "buyer_email_phone",
  };
}

export async function resolveWooMatch(
  workspaceId: string,
  order: OlistOrder,
): Promise<WooMatch | null> {
  return (
    (await findWooOrderByEcommerceNumber(workspaceId, order.numeroEcommerce)) ??
    (await findWooOrderByBuyer(workspaceId, order))
  );
}

/** Grava link bidirecional nos rawPayload e espelha rastreio no Woo. */
export async function linkOlistToWoo(input: {
  workspaceId: string;
  olistOrderId: string;
  olist: OlistOrder;
  woo: WooMatch;
}) {
  const olistRow = await prisma.marketplaceOrder.findUnique({
    where: { id: input.olistOrderId },
    select: { id: true, rawPayload: true },
  });
  if (!olistRow) return;

  const olistPayload =
    olistRow.rawPayload && typeof olistRow.rawPayload === "object" && !Array.isArray(olistRow.rawPayload)
      ? { ...(olistRow.rawPayload as Record<string, unknown>) }
      : {};

  await prisma.marketplaceOrder.update({
    where: { id: olistRow.id },
    data: {
      contactId: input.woo.contactId ?? undefined,
      leadId: input.woo.leadId ?? undefined,
      rawPayload: {
        ...olistPayload,
        order: input.olist.raw,
        wooExternalId: input.woo.externalId,
        wooOrderId: input.woo.orderId,
        matchedBy: input.woo.matchedBy,
        matchedAt: new Date().toISOString(),
      } as object,
    },
  });

  const wooRow = await prisma.marketplaceOrder.findUnique({
    where: { id: input.woo.orderId },
    select: { id: true, rawPayload: true },
  });
  if (!wooRow) return;

  const wooPayload =
    wooRow.rawPayload && typeof wooRow.rawPayload === "object" && !Array.isArray(wooRow.rawPayload)
      ? { ...(wooRow.rawPayload as Record<string, unknown>) }
      : {};

  await prisma.marketplaceOrder.update({
    where: { id: wooRow.id },
    data: {
      shippingStatus: input.olist.shippingStatus ?? input.olist.status,
      shippingId: input.olist.trackingCode ?? undefined,
      rawPayload: {
        ...wooPayload,
        olistOrderId: input.olist.id,
        olistNumero: input.olist.numero,
        olistStatus: input.olist.status,
        olistTrackingCode: input.olist.trackingCode,
        olistTrackingUrl: input.olist.trackingUrl,
        matchedBy: input.woo.matchedBy,
        matchedAt: new Date().toISOString(),
      } as object,
    },
  });
}
