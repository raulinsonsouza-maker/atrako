/**
 * Cruza pedido Olist com WooCommerce pelo numeroPedidoEcommerce.
 */

import { prisma } from "@/lib/db";
import type { OlistOrder } from "./orders";

export type WooMatch = {
  orderId: string;
  contactId: string | null;
  leadId: string | null;
  externalId: string;
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
      rawPayload: true,
    },
  });
  if (!woo) return null;
  return {
    orderId: woo.id,
    contactId: woo.contactId,
    leadId: woo.leadId,
    externalId: woo.externalId,
  };
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
        matchedAt: new Date().toISOString(),
      } as object,
    },
  });
}
