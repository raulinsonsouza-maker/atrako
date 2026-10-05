import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { CHANNEL_LABELS, type OrderChannel } from "@/lib/commerce-attribution/store-source";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";

function parseDay(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Compras reportadas pelo Meta × pedidos da loja identificados (cliente, produtos, anúncio). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "read");
  if (access.response) return access.response;

  const sp = request.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  let dataFim = parseDay(sp.get("dataFim")) ?? today;
  let dataInicio = parseDay(sp.get("dataInicio"));
  if (!dataInicio) {
    const dias = Math.min(365, Math.max(1, Number.parseInt(sp.get("periodo") ?? "30", 10) || 30));
    const d = new Date(`${dataFim}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (dias - 1));
    dataInicio = d.toISOString().slice(0, 10);
  }
  if (dataInicio > dataFim) [dataInicio, dataFim] = [dataFim, dataInicio];
  const from = new Date(`${dataInicio}T00:00:00-03:00`);
  const to = new Date(`${dataFim}T23:59:59.999-03:00`);

  const [metaRows, orders] = await Promise.all([
    prisma.metaAdPurchaseDaily.findMany({
      where: {
        clienteId: id,
        date: { gte: new Date(`${dataInicio}T00:00:00Z`), lte: new Date(`${dataFim}T00:00:00Z`) },
      },
    }),
    prisma.marketplaceOrder.findMany({
      where: {
        clienteId: id,
        occurredAt: { gte: from, lte: to },
        source: { is: { channel: "meta_ads" } },
      },
      orderBy: { occurredAt: "desc" },
      take: 300,
      include: { source: true, items: { select: { title: true, quantity: true } } },
    }),
  ]);

  const metaPurchases = metaRows.reduce((s, r) => s + r.clickPurchases + r.viewPurchases, 0);
  const metaValueCents = metaRows.reduce((s, r) => s + r.clickValueCents + r.viewValueCents, 0);
  const counted = orders.filter((o) => o.source?.adMethod === "meta_match" || o.source?.adMethod === "both");

  type CampaignAgg = {
    campaignId: string;
    campaignName: string;
    metaPurchases: number;
    metaValueCents: number;
    orders: number;
    valueCents: number;
  };
  const byCampaign = new Map<string, CampaignAgg>();
  const agg = (campaignId: string, campaignName: string) => {
    let row = byCampaign.get(campaignId);
    if (!row) {
      row = { campaignId, campaignName, metaPurchases: 0, metaValueCents: 0, orders: 0, valueCents: 0 };
      byCampaign.set(campaignId, row);
    }
    if (!row.campaignName && campaignName) row.campaignName = campaignName;
    return row;
  };
  for (const r of metaRows) {
    const row = agg(r.campaignId, r.campaignName);
    row.metaPurchases += r.clickPurchases + r.viewPurchases;
    row.metaValueCents += r.clickValueCents + r.viewValueCents;
  }
  for (const o of orders) {
    const row = agg(o.source?.metaCampaignId ?? "", o.source?.metaCampaignName ?? "");
    row.orders += 1;
    if (isRevenueOrder(o.status)) row.valueCents += o.totalCents ?? 0;
  }

  return NextResponse.json({
    periodo: { dataInicio, dataFim },
    meta: {
      purchases: metaPurchases,
      valueCents: metaValueCents,
      clickPurchases: metaRows.reduce((s, r) => s + r.clickPurchases, 0),
      viewPurchases: metaRows.reduce((s, r) => s + r.viewPurchases, 0),
    },
    identified: {
      orders: orders.length,
      valueCents: orders.reduce((s, o) => s + (isRevenueOrder(o.status) ? o.totalCents ?? 0 : 0), 0),
      countedByMeta: counted.length,
      confirmed: orders.filter((o) => o.source?.adConfidence === "confirmed").length,
      probable: orders.filter((o) => o.source?.adConfidence === "probable").length,
    },
    semPar: Math.max(0, metaPurchases - counted.length),
    byCampaign: [...byCampaign.values()].sort((a, b) => b.valueCents - a.valueCents || b.metaValueCents - a.metaValueCents),
    orders: orders.map((o) => ({
      id: o.id,
      externalId: o.externalId,
      leadId: o.leadId,
      buyerName: o.buyerName,
      totalCents: o.totalCents ?? 0,
      status: o.status,
      occurredAt: (o.occurredAt ?? o.createdAt).toISOString(),
      items: o.items.map((i) => `${i.quantity}× ${i.title}`),
      source: o.source
        ? {
            channel: o.source.channel,
            channelLabel: CHANNEL_LABELS[o.source.channel as OrderChannel] ?? o.source.channel,
            storeSource: o.source.storeSource,
            storeMedium: o.source.storeMedium,
            storeContent: o.source.storeContent,
            adMethod: o.source.adMethod,
            adConfidence: o.source.adConfidence,
            adWindow: o.source.adWindow,
            campaignName: o.source.metaCampaignName,
            adsetName: o.source.metaAdsetName,
            adName: o.source.metaAdName,
          }
        : null,
    })),
  });
}
