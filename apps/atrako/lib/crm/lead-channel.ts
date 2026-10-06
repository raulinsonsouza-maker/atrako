/**
 * Canal de aquisição do lead (de onde ele veio) e quando entrou no funil.
 * Comprador: canal do primeiro pedido com origem conhecida (a loja grava a sessão).
 * Sem pedido: UTM salva no lead, ou a própria origem do lead (WhatsApp, Instagram…).
 */

import { prisma } from "@/lib/db";
import { classifyChannel, orderOriginKey } from "@/lib/commerce-attribution/store-source";

export type LeadAcquisition = { channel: string; enteredAt: Date };

const SOURCE_CHANNEL: Record<string, string> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  instagram_dm: "instagram",
  facebook: "facebook",
  meta: "meta_ads",
  meta_lead: "meta_ads",
  meta_lead_ads: "meta_ads",
  google_ads: "google_ads",
  email: "email",
};

type Row = {
  id: string;
  source: string | null;
  metadata: unknown;
  createdAt: Date;
  provider: string | null;
  channel: string | null;
  firstOrderAt: Date | null;
  firstCartAt: Date | null;
};

function pick(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function channelFromLead(row: Row): string {
  if (row.provider) return orderOriginKey(row.provider, row.channel);
  const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
  const utmSource = pick(meta, ["utmSource", "utm_source"]);
  const utmMedium = pick(meta, ["utmMedium", "utm_medium"]);
  const referrer = pick(meta, ["referrer", "referer"]);
  if (utmSource || utmMedium || referrer) {
    return classifyChannel({
      source: utmSource,
      medium: utmMedium,
      referrer,
      sourceType: null,
      hasGclid: Boolean(pick(meta, ["gclid", "gbraid", "wbraid"])),
      metaIdInUtm: false,
    });
  }
  return SOURCE_CHANNEL[(row.source ?? "").toLowerCase()] ?? "unknown";
}

export async function getLeadAcquisition(clienteId: string): Promise<Map<string, LeadAcquisition>> {
  const rows = await prisma.$queryRaw<Row[]>`
    with first_known as (
      select distinct on (o."contactId") o."contactId", o.provider, s.channel
      from "MarketplaceOrder" o
      left join "MarketplaceOrderSource" s on s."orderId" = o.id
      where o."clienteId" = ${clienteId} and o."contactId" is not null
      order by o."contactId", (s.channel is null or s.channel = 'unknown'), o."occurredAt" asc nulls last
    ),
    first_order as (
      select "contactId", min("occurredAt") as first_at
      from "MarketplaceOrder"
      where "clienteId" = ${clienteId} and "contactId" is not null
      group by 1
    ),
    first_cart as (
      select "leadId", min("abandonedAt") as first_at
      from "AbandonedCart"
      where "clienteId" = ${clienteId} and "leadId" is not null
      group by 1
    )
    select l.id, l.source, l.metadata, l."createdAt",
      fk.provider, fk.channel,
      fo.first_at as "firstOrderAt", fc.first_at as "firstCartAt"
    from "NativeLead" l
    left join first_known fk on fk."contactId" = l."contactId"
    left join first_order fo on fo."contactId" = l."contactId"
    left join first_cart fc on fc."leadId" = l.id
    where l."clienteId" = ${clienteId}
  `;

  const out = new Map<string, LeadAcquisition>();
  for (const row of rows) {
    const times = [row.createdAt, row.firstOrderAt, row.firstCartAt]
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.getTime());
    out.set(row.id, { channel: channelFromLead(row), enteredAt: new Date(Math.min(...times)) });
  }
  return out;
}

/** `YYYY-MM-DD` (dia de Brasília) → limites do dia em UTC. */
export function brtDayBounds(from?: string | null, to?: string | null) {
  const ok = (v?: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  return {
    gte: ok(from) ? new Date(`${from}T00:00:00.000-03:00`) : null,
    lte: ok(to) ? new Date(`${to}T23:59:59.999-03:00`) : null,
  };
}
