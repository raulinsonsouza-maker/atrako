/**
 * Compat: match Woo via motor multi-canal.
 * Preferir `resolveChannelMatch` / `linkOlistToChannel` em código novo.
 */

import type { OlistOrder } from "./orders";
import {
  linkOlistToChannel,
  resolveChannelMatch,
  type ChannelMatch,
} from "./match-channel";

export type WooMatch = {
  orderId: string;
  contactId: string | null;
  leadId: string | null;
  externalId: string;
  matchedBy: "ecommerce_number" | "buyer_email_phone";
};

function asWoo(match: ChannelMatch | null): WooMatch | null {
  if (!match || match.provider !== "WOOCOMMERCE") return null;
  return {
    orderId: match.orderId,
    contactId: match.contactId,
    leadId: match.leadId,
    externalId: match.externalId,
    matchedBy: match.matchedBy,
  };
}

export async function resolveWooMatch(
  workspaceId: string,
  order: OlistOrder,
): Promise<WooMatch | null> {
  return asWoo(await resolveChannelMatch(workspaceId, order));
}

export async function findWooOrderByEcommerceNumber(
  workspaceId: string,
  numeroEcommerce: string | null | undefined,
): Promise<WooMatch | null> {
  if (!(numeroEcommerce ?? "").trim()) return null;
  return resolveWooMatch(workspaceId, {
    id: "_",
    numero: null,
    numeroEcommerce: numeroEcommerce ?? null,
    status: "",
    totalCents: 0,
    currency: "BRL",
    occurredAt: null,
    buyerName: null,
    buyerEmail: null,
    buyerPhone: null,
    stateUf: null,
    cityRaw: null,
    trackingCode: null,
    trackingUrl: null,
    shippingStatus: null,
    items: [],
    raw: {},
  });
}

export async function findWooOrderByBuyer(
  workspaceId: string,
  order: Pick<OlistOrder, "buyerEmail" | "buyerPhone" | "totalCents" | "buyerName">,
): Promise<WooMatch | null> {
  return resolveWooMatch(workspaceId, {
    id: "_",
    numero: null,
    numeroEcommerce: null,
    status: "",
    totalCents: order.totalCents ?? 0,
    currency: "BRL",
    occurredAt: null,
    buyerName: order.buyerName ?? null,
    buyerEmail: order.buyerEmail ?? null,
    buyerPhone: order.buyerPhone ?? null,
    stateUf: null,
    cityRaw: null,
    trackingCode: null,
    trackingUrl: null,
    shippingStatus: null,
    items: [],
    raw: {},
  });
}

export async function linkOlistToWoo(input: {
  workspaceId: string;
  olistOrderId: string;
  olist: OlistOrder;
  woo: WooMatch;
}) {
  await linkOlistToChannel({
    olistOrderId: input.olistOrderId,
    olist: input.olist,
    match: {
      provider: "WOOCOMMERCE",
      orderId: input.woo.orderId,
      contactId: input.woo.contactId,
      leadId: input.woo.leadId,
      externalId: input.woo.externalId,
      matchedBy: input.woo.matchedBy,
    },
  });
}
