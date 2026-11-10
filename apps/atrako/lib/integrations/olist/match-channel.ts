/**
 * Cruza pedido Olist com canal de origem (Woo / Mercado Livre):
 * 1) numeroPedidoEcommerce → externalId do canal
 * 2) fallback: e-mail/telefone (+ valor)
 */

import { prisma } from "@/lib/db";
import type { OlistOrder } from "./orders";

export type ChannelProvider = "WOOCOMMERCE" | "MERCADO_LIVRE";

export type ChannelMatch = {
  provider: ChannelProvider;
  orderId: string;
  contactId: string | null;
  leadId: string | null;
  externalId: string;
  matchedBy: "ecommerce_number" | "buyer_email_phone";
};

const CHANNEL_PROVIDERS: ChannelProvider[] = ["WOOCOMMERCE", "MERCADO_LIVRE"];

function ecommerceHint(order: OlistOrder): ChannelProvider | null {
  const raw = order.raw && typeof order.raw === "object" ? (order.raw as Record<string, unknown>) : {};
  const ecommerce =
    raw.ecommerce && typeof raw.ecommerce === "object" && !Array.isArray(raw.ecommerce)
      ? (raw.ecommerce as Record<string, unknown>)
      : {};
  const blob = [
    ecommerce.nomeEcommerce,
    ecommerce.nome,
    ecommerce.plataforma,
    ecommerce.ecommerceNome,
    raw.meio_pagamento,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/mercado\s*livre|\bml\b|mercadolivre/.test(blob)) return "MERCADO_LIVRE";
  if (/woo|wordpress|loja\s*virtual|e-?commerce/.test(blob)) return "WOOCOMMERCE";
  return null;
}

async function findByEcommerceNumber(
  workspaceId: string,
  provider: ChannelProvider,
  numeroEcommerce: string | null | undefined,
): Promise<ChannelMatch | null> {
  const externalId = (numeroEcommerce ?? "").trim();
  if (!externalId) return null;

  const row = await prisma.marketplaceOrder.findUnique({
    where: {
      clienteId_provider_externalId: {
        clienteId: workspaceId,
        provider,
        externalId,
      },
    },
    select: { id: true, contactId: true, leadId: true, externalId: true },
  });
  if (!row) return null;
  return {
    provider,
    orderId: row.id,
    contactId: row.contactId,
    leadId: row.leadId,
    externalId: row.externalId,
    matchedBy: "ecommerce_number",
  };
}

async function findByBuyer(
  workspaceId: string,
  provider: ChannelProvider,
  order: Pick<OlistOrder, "buyerEmail" | "buyerPhone" | "totalCents">,
): Promise<ChannelMatch | null> {
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
          ? [{ phone: { contains: phone.slice(-8) } }, { phoneE164: { contains: phone.slice(-8) } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!contact) return null;

  const candidates = await prisma.marketplaceOrder.findMany({
    where: { clienteId: workspaceId, provider, contactId: contact.id },
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
    provider,
    orderId: pick.id,
    contactId: pick.contactId,
    leadId: pick.leadId,
    externalId: pick.externalId,
    matchedBy: "buyer_email_phone",
  };
}

export async function resolveChannelMatch(
  workspaceId: string,
  order: OlistOrder,
): Promise<ChannelMatch | null> {
  const hint = ecommerceHint(order);
  const providers = hint
    ? [hint, ...CHANNEL_PROVIDERS.filter((p) => p !== hint)]
    : CHANNEL_PROVIDERS;

  for (const provider of providers) {
    const byNumber = await findByEcommerceNumber(workspaceId, provider, order.numeroEcommerce);
    if (byNumber) return byNumber;
  }
  for (const provider of providers) {
    const byBuyer = await findByBuyer(workspaceId, provider, order);
    if (byBuyer) return byBuyer;
  }
  return null;
}

/** Contato/lead/carrinho existentes quando a venda nasceu só na Olist. */
export async function resolveExistingPerson(workspaceId: string, order: OlistOrder) {
  const email = order.buyerEmail?.trim().toLowerCase() || null;
  const phoneDigits = (order.buyerPhone ?? "").replace(/\D/g, "");
  const phoneTail = phoneDigits.length >= 8 ? phoneDigits.slice(-8) : null;
  if (!email && !phoneTail) return null;

  const contact = await prisma.nativeContact.findFirst({
    where: {
      clienteId: workspaceId,
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(phoneTail
          ? [{ phone: { contains: phoneTail } }, { phoneE164: { contains: phoneTail } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!contact) return null;

  const [openLead, anyLead, openCart] = await Promise.all([
    prisma.nativeLead.findFirst({
      where: { clienteId: workspaceId, contactId: contact.id, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }),
    prisma.nativeLead.findFirst({
      where: { clienteId: workspaceId, contactId: contact.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }),
    prisma.abandonedCart.findFirst({
      where: { clienteId: workspaceId, contactId: contact.id, status: { in: ["OPEN", "PENDING"] } },
      orderBy: { abandonedAt: "desc" },
      select: { id: true, leadId: true },
    }),
  ]);

  return {
    contactId: contact.id,
    leadId: openLead?.id ?? openCart?.leadId ?? anyLead?.id ?? null,
    hadOpenCart: Boolean(openCart),
  };
}

/** Link bidirecional Olist ↔ canal. */
export async function linkOlistToChannel(input: {
  olistOrderId: string;
  olist: OlistOrder;
  match: ChannelMatch;
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

  const matchedFields =
    input.match.provider === "WOOCOMMERCE"
      ? { wooExternalId: input.match.externalId, wooOrderId: input.match.orderId }
      : { mlExternalId: input.match.externalId, mlOrderId: input.match.orderId };

  await prisma.marketplaceOrder.update({
    where: { id: olistRow.id },
    data: {
      contactId: input.match.contactId ?? undefined,
      leadId: input.match.leadId ?? undefined,
      rawPayload: {
        ...olistPayload,
        order: input.olist.raw,
        numeroEcommerce: input.olist.numeroEcommerce,
        matchedProvider: input.match.provider,
        matchedExternalId: input.match.externalId,
        matchedOrderId: input.match.orderId,
        matchedBy: input.match.matchedBy,
        matchedAt: new Date().toISOString(),
        ...matchedFields,
      } as object,
    },
  });

  const channelRow = await prisma.marketplaceOrder.findUnique({
    where: { id: input.match.orderId },
    select: { id: true, rawPayload: true },
  });
  if (!channelRow) return;

  const channelPayload =
    channelRow.rawPayload &&
    typeof channelRow.rawPayload === "object" &&
    !Array.isArray(channelRow.rawPayload)
      ? { ...(channelRow.rawPayload as Record<string, unknown>) }
      : {};

  await prisma.marketplaceOrder.update({
    where: { id: channelRow.id },
    data: {
      shippingStatus: input.olist.shippingStatus ?? input.olist.status,
      shippingId: input.olist.trackingCode ?? undefined,
      rawPayload: {
        ...channelPayload,
        olistOrderId: input.olist.id,
        olistNumero: input.olist.numero,
        olistStatus: input.olist.status,
        olistTrackingCode: input.olist.trackingCode,
        olistTrackingUrl: input.olist.trackingUrl,
        matchedBy: input.match.matchedBy,
        matchedAt: new Date().toISOString(),
      } as object,
    },
  });
}
