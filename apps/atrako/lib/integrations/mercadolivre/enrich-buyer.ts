/**
 * Completa o comprador de um pedido do Mercado Livre com cobrança e envio.
 * O pedido sozinho quase nunca traz telefone, e-mail ou cidade.
 */

import { prisma } from "@/lib/db";
import { normalizePlace } from "@/lib/geo/place";
import { normalizePersonEmail, normalizePersonPhone, toPhoneE164 } from "@/lib/atrako/person";
import { mlFetch } from "./client";
import { getMlBillingInfo } from "./orders";
import { parseMlBuyerFacts, type MlBuyerFacts } from "./buyer-facts";

const ENRICH_COOLDOWN_MS = 15 * 60 * 1000;

type OrderRow = {
  id: string;
  clienteId: string;
  provider: string;
  externalId: string;
  shippingId: string | null;
  contactId: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  cityName: string | null;
  rawPayload: unknown;
  shippingMode?: string | null;
  logisticType?: string | null;
  shippingStatus?: string | null;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function mlBuyerNeedsRefresh(order: {
  provider: string;
  buyerPhone: string | null;
  buyerEmail: string | null;
  cityName: string | null;
  rawPayload: unknown;
}) {
  if (order.provider !== "MERCADO_LIVRE") return false;
  if (order.buyerPhone || order.buyerEmail || order.cityName) return false;
  const at = asRecord(order.rawPayload).buyerEnrichedAt;
  if (typeof at !== "string") return true;
  const stamp = Date.parse(at);
  return !Number.isFinite(stamp) || Date.now() - stamp >= ENRICH_COOLDOWN_MS;
}

export async function fetchMlBuyerFacts(input: {
  workspaceId: string;
  externalId: string;
  shippingId?: string | null;
  order: unknown;
  shipment?: unknown | null;
}) {
  const [billing, shipment] = await Promise.all([
    getMlBillingInfo(input.workspaceId, input.externalId).catch(() => null),
    input.shipment
      ? Promise.resolve(input.shipment)
      : input.shippingId
        ? mlFetch(input.workspaceId, `/shipments/${input.shippingId}`, {
            signal: AbortSignal.timeout(8000),
          }).catch(() => null)
        : Promise.resolve(null),
  ]);
  return {
    facts: parseMlBuyerFacts({ order: input.order, billing, shipment }),
    billing,
    shipment,
  };
}

async function fillContact(
  workspaceId: string,
  contactId: string,
  facts: MlBuyerFacts,
  place: { city: string | null; state: string | null },
) {
  const contact = await prisma.nativeContact.findFirst({
    where: { id: contactId, clienteId: workspaceId },
  });
  if (!contact) return null;

  const phone = contact.phone ?? normalizePersonPhone(facts.phone);
  const email = contact.email ?? normalizePersonEmail(facts.email);
  const meta = asRecord(contact.metadata);
  const genericName = !contact.name.trim() || contact.name === "Contato" || contact.name === facts.nickname;
  const name = genericName && facts.name ? facts.name.slice(0, 200) : contact.name;

  await prisma.nativeContact.update({
    where: { id: contact.id },
    data: {
      name,
      phone,
      email,
      phoneE164: contact.phoneE164 ?? toPhoneE164(phone),
      metadata: {
        ...meta,
        ...(facts.nickname ? { nickname: facts.nickname } : {}),
        ...(place.city ? { location: { city: place.city, state: place.state } } : {}),
        anonymous: phone || email ? false : meta.anonymous === true,
      } as object,
    },
  });

  return { name, phone, email };
}

/** Grava telefone, e-mail, cidade e o JSON de cobrança/envio. Não apaga o que já existia. */
export async function saveMlBuyerFacts(input: {
  workspaceId: string;
  marketplaceOrderId: string;
  contactId: string | null;
  rawPayload: unknown;
  facts: MlBuyerFacts;
  billing: unknown;
  shipment: unknown;
}) {
  const place = normalizePlace(input.facts.city, input.facts.state);
  const city = place.cityName ?? place.cityRaw;
  const phone = normalizePersonPhone(input.facts.phone);
  const email = normalizePersonEmail(input.facts.email);
  const prev = asRecord(input.rawPayload);
  const rawPayload = {
    ...prev,
    billing: input.billing ?? prev.billing ?? null,
    shipment: input.shipment ?? prev.shipment ?? null,
    buyerEnrichedAt: new Date().toISOString(),
  };

  await prisma.marketplaceOrder.update({
    where: { id: input.marketplaceOrderId },
    data: {
      ...(input.facts.name ? { buyerName: input.facts.name.slice(0, 200) } : {}),
      ...(email ? { buyerEmail: email } : {}),
      ...(phone ? { buyerPhone: phone } : {}),
      ...(place.stateUf ? { stateUf: place.stateUf } : {}),
      ...(place.cityName ? { cityName: place.cityName } : {}),
      ...(place.cityRaw ? { cityRaw: place.cityRaw } : {}),
      rawPayload: rawPayload as object,
    },
  });

  const contact = input.contactId
    ? await fillContact(input.workspaceId, input.contactId, input.facts, {
        city,
        state: place.stateUf,
      })
    : null;

  return { phone, email, name: contact?.name ?? input.facts.name, cityName: place.cityName, cityRaw: place.cityRaw, stateUf: place.stateUf, rawPayload };
}

export async function refreshMlBuyerIfThin(order: OrderRow, known?: { order?: unknown; shipment?: unknown | null }) {
  if (!mlBuyerNeedsRefresh(order)) return null;
  const stored = asRecord(order.rawPayload);
  const bundle = await fetchMlBuyerFacts({
    workspaceId: order.clienteId,
    externalId: order.externalId,
    shippingId: order.shippingId,
    order: known?.order ?? stored.order ?? null,
    shipment: known?.shipment ?? stored.shipment ?? null,
  });
  return saveMlBuyerFacts({
    workspaceId: order.clienteId,
    marketplaceOrderId: order.id,
    contactId: order.contactId,
    rawPayload: order.rawPayload,
    facts: bundle.facts,
    billing: bundle.billing,
    shipment: bundle.shipment,
  });
}
