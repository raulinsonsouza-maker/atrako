/**
 * Grava `MarketplaceOrderSource` de cada pedido de loja: origem gravada pela loja (UTM)
 * + anúncio Meta que contou a compra (conciliação valor × dia). É o único escritor da tabela.
 */

import { prisma } from "@/lib/db";
import { matchPurchasesToOrders, type MatchOrder, type MatchUnit } from "./match";
import { parseWooOrderSource, type StoreOrderSource } from "./store-source";

/** Pedidos feitos no site (onde o Pixel dispara). Marketplaces não passam pelo Pixel do anunciante. */
const SITE_PROVIDERS = ["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"];
const PAID_STATUSES = new Set(["processing", "completed", "paid", "approved", "authorized", "pago", "aprovado"]);
const IGNORED_STATUSES = new Set(["checkout-draft", "trash"]);
const STORE_TZ = "America/Sao_Paulo";

function dayInTz(d: Date, tz = STORE_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type RawWoo = { order?: { date_created?: string; meta_data?: Array<{ key?: string; value?: unknown }> } };

/** Dia local do pedido. Woo grava `date_created` no fuso da loja — é quando o Pixel dispara no obrigado. */
function orderDay(o: { provider: string; rawPayload: unknown; occurredAt: Date | null; createdAt: Date }) {
  if (o.provider === "WOOCOMMERCE") {
    const created = (o.rawPayload as RawWoo | null)?.order?.date_created;
    if (typeof created === "string" && /^\d{4}-\d{2}-\d{2}/.test(created)) return created.slice(0, 10);
  }
  return dayInTz(o.occurredAt ?? o.createdAt);
}

function storeSourceOf(o: { provider: string; rawPayload: unknown }): StoreOrderSource | null {
  if (o.provider === "WOOCOMMERCE") {
    const order = (o.rawPayload as RawWoo | null)?.order;
    return order ? parseWooOrderSource(order) : null;
  }
  return null;
}

export type ReconcileResult = {
  orders: number;
  metaUnits: number;
  matchedUnits: number;
  matchedOrders: number;
  unmatched: Array<{ day: string; adId: string; adName: string; window: string; purchases: number; valueCents: number; reason: string }>;
};

/** Recalcula a origem dos pedidos com dia local em [dateFrom, dateTo] (YYYY-MM-DD). */
export async function reconcileOrderSources(
  clienteId: string,
  range: { dateFrom: string; dateTo: string },
): Promise<ReconcileResult> {
  const loadFrom = shiftDay(range.dateFrom, -3);
  const loadTo = shiftDay(range.dateTo, 3);

  const [orders, rows] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: {
        clienteId,
        provider: { in: SITE_PROVIDERS },
        OR: [
          { occurredAt: { gte: new Date(`${loadFrom}T00:00:00Z`), lte: new Date(`${loadTo}T23:59:59Z`) } },
          { occurredAt: null, createdAt: { gte: new Date(`${loadFrom}T00:00:00Z`), lte: new Date(`${loadTo}T23:59:59Z`) } },
        ],
      },
      select: { id: true, provider: true, status: true, totalCents: true, rawPayload: true, occurredAt: true, createdAt: true },
    }),
    prisma.metaAdPurchaseDaily.findMany({
      where: {
        clienteId,
        date: { gte: new Date(`${shiftDay(range.dateFrom, -1)}T00:00:00Z`), lte: new Date(`${shiftDay(range.dateTo, 1)}T00:00:00Z`) },
      },
    }),
  ]);

  const enriched = orders
    .filter((o) => !IGNORED_STATUSES.has((o.status ?? "").toLowerCase()))
    .map((o) => ({ ...o, day: orderDay(o), store: storeSourceOf(o) }));

  const matchOrders: MatchOrder[] = enriched.map((o) => ({
    id: o.id,
    day: o.day,
    totalCents: o.totalCents ?? 0,
    paid: PAID_STATUSES.has((o.status ?? "").toLowerCase()),
    utmCampaignId: o.store?.meta?.campaignId ?? null,
    utmAdId: o.store?.meta?.adId ?? null,
  }));

  const rowByKey = new Map<string, (typeof rows)[number]>();
  const units: MatchUnit[] = [];
  for (const r of rows) {
    const day = r.date.toISOString().slice(0, 10);
    for (const window of ["click", "view"] as const) {
      const purchases = window === "click" ? r.clickPurchases : r.viewPurchases;
      const valueCents = window === "click" ? r.clickValueCents : r.viewValueCents;
      if (purchases <= 0 || valueCents <= 0) continue;
      const key = `${r.id}:${window}`;
      rowByKey.set(key, r);
      units.push({ key, day, window, purchases, valueCents, campaignId: r.campaignId, adId: r.adId });
    }
  }

  const { claims, unmatched } = matchPurchasesToOrders(units, matchOrders);

  // Nomes de anúncio/campanha para pedidos com UTM que o Meta não contou na janela.
  const adNames = new Map<string, { adName: string; adsetId: string; adsetName: string; campaignId: string; campaignName: string }>();
  const campaignNames = new Map<string, string>();
  const knownAds = await prisma.metaAdPurchaseDaily.findMany({
    where: { clienteId },
    distinct: ["adId"],
    orderBy: { date: "desc" },
    select: { adId: true, adName: true, adsetId: true, adsetName: true, campaignId: true, campaignName: true },
  });
  for (const a of knownAds) {
    adNames.set(a.adId, a);
    campaignNames.set(a.campaignId, a.campaignName);
  }

  const now = new Date();
  let written = 0;
  for (const o of enriched) {
    if (o.day < range.dateFrom || o.day > range.dateTo) continue;
    const store = o.store;
    const claim = claims.get(o.id);
    const row = claim ? rowByKey.get(claim.unit.key) : undefined;
    const utm = store?.meta ?? null;
    const utmAd = utm?.adId ? adNames.get(utm.adId) : undefined;

    let ad: {
      adMethod: string | null;
      adConfidence: string | null;
      adWindow: string | null;
      metaCampaignId: string | null;
      metaCampaignName: string | null;
      metaAdsetId: string | null;
      metaAdsetName: string | null;
      metaAdId: string | null;
      metaAdName: string | null;
      matchedAt: Date | null;
    };
    if (row && claim) {
      ad = {
        adMethod: claim.utmAgrees ? "both" : "meta_match",
        adConfidence: claim.utmAgrees ? "confirmed" : "probable",
        adWindow: claim.unit.window,
        metaCampaignId: row.campaignId,
        metaCampaignName: row.campaignName,
        metaAdsetId: row.adsetId,
        metaAdsetName: row.adsetName,
        metaAdId: row.adId,
        metaAdName: row.adName,
        matchedAt: now,
      };
    } else if (utm) {
      const campaignId = utm.campaignId ?? utmAd?.campaignId ?? null;
      ad = {
        adMethod: "utm",
        adConfidence: "confirmed",
        adWindow: "click",
        metaCampaignId: campaignId,
        metaCampaignName: utm.campaignName ?? utmAd?.campaignName ?? (campaignId ? campaignNames.get(campaignId) ?? null : null),
        metaAdsetId: utm.adsetId ?? utmAd?.adsetId ?? null,
        metaAdsetName: utmAd?.adsetName ?? null,
        metaAdId: utm.adId,
        metaAdName: utmAd?.adName ?? utm.adName,
        matchedAt: now,
      };
    } else {
      ad = {
        adMethod: null,
        adConfidence: null,
        adWindow: null,
        metaCampaignId: null,
        metaCampaignName: null,
        metaAdsetId: null,
        metaAdsetName: null,
        metaAdId: null,
        metaAdName: null,
        matchedAt: null,
      };
    }

    const data = {
      clienteId,
      channel: ad.adMethod ? "meta_ads" : store?.channel ?? "unknown",
      storeSource: store?.storeSource ?? null,
      storeMedium: store?.storeMedium ?? null,
      storeCampaign: store?.storeCampaign ?? null,
      storeContent: store?.storeContent ?? null,
      storeTerm: store?.storeTerm ?? null,
      referrer: store?.referrer ?? null,
      landingUrl: store?.landingUrl ?? null,
      deviceType: store?.deviceType ?? null,
      sessionPages: store?.sessionPages ?? null,
      sessionCount: store?.sessionCount ?? null,
      hasFbclid: store?.hasFbclid ?? false,
      ...ad,
    };
    await prisma.marketplaceOrderSource.upsert({
      where: { orderId: o.id },
      create: { orderId: o.id, ...data },
      update: data,
    });
    written++;
  }

  const inRange = (day: string) => day >= range.dateFrom && day <= range.dateTo;
  return {
    orders: written,
    metaUnits: units.filter((u) => inRange(u.day)).length,
    matchedUnits: new Set([...claims.values()].filter((c) => inRange(c.unit.day)).map((c) => c.unit.key)).size,
    matchedOrders: [...claims.values()].filter((c) => inRange(c.unit.day)).length,
    unmatched: unmatched
      .filter((m) => inRange(m.unit.day))
      .map((m) => ({
        day: m.unit.day,
        adId: m.unit.adId,
        adName: rowByKey.get(m.unit.key)?.adName ?? "",
        window: m.unit.window,
        purchases: m.unit.purchases,
        valueCents: m.unit.valueCents,
        reason: m.reason,
      })),
  };
}
