/**
 * Vendas confirmadas: com Olist conectada, a receita do Geral/Meta/ROAS
 * é 1× o pedido Olist pago; origem/UTM vêm do canal casado (Woo/ML).
 * Sem Olist, cai no comportamento clássico (todos os providers com isRevenueOrder).
 */

import { prisma } from "@/lib/db";
import { isOlistPaid } from "@/lib/integrations/olist/ingest-order";
import { brtDay, brtRange } from "./period";
import { isRevenueOrder } from "./order-status";
import { orderOriginKey, type OrderChannel } from "./store-source";

export type ConfirmedSale = {
  olistOrderId: string;
  externalId: string;
  totalCents: number;
  occurredAt: Date;
  day: string;
  contactId: string | null;
  leadId: string | null;
  /** Canal de origem da venda (WOOCOMMERCE, MERCADO_LIVRE, OLIST_ERP). */
  originProvider: string;
  originExternalId: string | null;
  matchedBy: string | null;
  channel: string;
  campaignName: string | null;
  adsetId: string | null;
  adId: string | null;
};

export type SalesReconcile = {
  olistConnected: boolean;
  confirmed: ConfirmedSale[];
  confirmedCents: number;
  confirmedCount: number;
  matchedWoo: number;
  matchedMl: number;
  erpOnly: number;
  /** Canal com isRevenueOrder sem Olist casada no período. */
  channelOnly: Array<{
    provider: string;
    externalId: string;
    totalCents: number;
    occurredAt: Date | null;
  }>;
  channelOnlyCents: number;
  channelOnlyCount: number;
  matchRate: number;
};

function payloadOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export async function isOlistConnected(clienteId: string) {
  const row = await prisma.workspaceConnection.findUnique({
    where: { clienteId_provider: { clienteId, provider: "OLIST_ERP" } },
    select: { status: true },
  });
  return row?.status === "ACTIVE";
}

type ChannelSource = {
  channel: string | null;
  metaCampaignName: string | null;
  metaAdsetId: string | null;
  metaAdId: string | null;
};

async function loadChannelSources(orderIds: string[]) {
  const map = new Map<string, ChannelSource>();
  if (!orderIds.length) return map;
  const rows = await prisma.marketplaceOrder.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      source: {
        select: {
          channel: true,
          metaCampaignName: true,
          metaAdsetId: true,
          metaAdId: true,
        },
      },
    },
  });
  for (const r of rows) {
    map.set(r.id, {
      channel: r.source?.channel ?? null,
      metaCampaignName: r.source?.metaCampaignName ?? null,
      metaAdsetId: r.source?.metaAdsetId ?? null,
      metaAdId: r.source?.metaAdId ?? null,
    });
  }
  return map;
}

/** Carrega vendas do período já deduplicadas (Olist) ou clássicas. */
export async function loadConfirmedSales(
  clienteId: string,
  inicio: string,
  fim: string,
): Promise<SalesReconcile> {
  const range = brtRange(inicio, fim);
  const olistConnected = await isOlistConnected(clienteId);

  if (!olistConnected) {
    const orders = await prisma.marketplaceOrder.findMany({
      where: { clienteId, occurredAt: range, NOT: { provider: "OLIST_ERP" } },
      select: {
        id: true,
        provider: true,
        externalId: true,
        status: true,
        totalCents: true,
        occurredAt: true,
        createdAt: true,
        contactId: true,
        leadId: true,
        source: {
          select: {
            channel: true,
            metaCampaignName: true,
            metaAdsetId: true,
            metaAdId: true,
          },
        },
      },
    });
    const confirmed: ConfirmedSale[] = [];
    for (const o of orders) {
      if (!isRevenueOrder(o.status)) continue;
      confirmed.push({
        olistOrderId: o.id,
        externalId: o.externalId,
        totalCents: o.totalCents ?? 0,
        occurredAt: o.occurredAt ?? o.createdAt,
        day: brtDay(o.occurredAt ?? o.createdAt),
        contactId: o.contactId,
        leadId: o.leadId,
        originProvider: o.provider,
        originExternalId: o.externalId,
        matchedBy: null,
        channel: o.source?.channel ?? "unknown",
        campaignName: o.source?.metaCampaignName ?? null,
        adsetId: o.source?.metaAdsetId ?? null,
        adId: o.source?.metaAdId ?? null,
      });
    }
    const cents = confirmed.reduce((s, c) => s + c.totalCents, 0);
    return {
      olistConnected: false,
      confirmed,
      confirmedCents: cents,
      confirmedCount: confirmed.length,
      matchedWoo: 0,
      matchedMl: 0,
      erpOnly: 0,
      channelOnly: [],
      channelOnlyCents: 0,
      channelOnlyCount: 0,
      matchRate: 0,
    };
  }

  const [olistRows, channelRows] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { clienteId, provider: "OLIST_ERP", occurredAt: range },
      select: {
        id: true,
        externalId: true,
        status: true,
        totalCents: true,
        occurredAt: true,
        createdAt: true,
        contactId: true,
        leadId: true,
        rawPayload: true,
      },
    }),
    prisma.marketplaceOrder.findMany({
      where: {
        clienteId,
        occurredAt: range,
        provider: { in: ["WOOCOMMERCE", "MERCADO_LIVRE", "SHOPIFY", "TRAY", "NUVEMSHOP"] },
      },
      select: {
        id: true,
        provider: true,
        externalId: true,
        status: true,
        totalCents: true,
        occurredAt: true,
        rawPayload: true,
      },
    }),
  ]);

  const matchedChannelIds: string[] = [];
  for (const o of olistRows) {
    const p = payloadOf(o.rawPayload);
    const id =
      (typeof p.matchedOrderId === "string" && p.matchedOrderId) ||
      (typeof p.wooOrderId === "string" && p.wooOrderId) ||
      (typeof p.mlOrderId === "string" && p.mlOrderId) ||
      null;
    if (id) matchedChannelIds.push(id);
  }
  const sources = await loadChannelSources([...new Set(matchedChannelIds)]);

  const confirmed: ConfirmedSale[] = [];
  let matchedWoo = 0;
  let matchedMl = 0;
  let erpOnly = 0;

  for (const o of olistRows) {
    // Alinha ao funil de vendas da Olist (não conta orçamento/em aberto).
    if (!isOlistPaid(o.status ?? "")) continue;
    const p = payloadOf(o.rawPayload);
    const matchedProvider =
      (typeof p.matchedProvider === "string" && p.matchedProvider) ||
      (p.wooOrderId || p.wooExternalId ? "WOOCOMMERCE" : null) ||
      (p.mlOrderId || p.mlExternalId ? "MERCADO_LIVRE" : null) ||
      null;
    const matchedOrderId =
      (typeof p.matchedOrderId === "string" && p.matchedOrderId) ||
      (typeof p.wooOrderId === "string" && p.wooOrderId) ||
      (typeof p.mlOrderId === "string" && p.mlOrderId) ||
      null;
    const matchedExternalId =
      (typeof p.matchedExternalId === "string" && p.matchedExternalId) ||
      (typeof p.wooExternalId === "string" && p.wooExternalId) ||
      (typeof p.mlExternalId === "string" && p.mlExternalId) ||
      null;
    const matchedBy = typeof p.matchedBy === "string" ? p.matchedBy : null;
    const src = matchedOrderId ? sources.get(matchedOrderId) : undefined;

    if (matchedProvider === "WOOCOMMERCE") matchedWoo += 1;
    else if (matchedProvider === "MERCADO_LIVRE") matchedMl += 1;
    else erpOnly += 1;

    confirmed.push({
      olistOrderId: o.id,
      externalId: o.externalId,
      totalCents: o.totalCents ?? 0,
      occurredAt: o.occurredAt ?? o.createdAt,
      day: brtDay(o.occurredAt ?? o.createdAt),
      contactId: o.contactId,
      leadId: o.leadId,
      originProvider: matchedProvider ?? "OLIST_ERP",
      originExternalId: matchedExternalId,
      matchedBy,
      channel: src?.channel ?? (matchedProvider ? "unknown" : "erp"),
      campaignName: src?.metaCampaignName ?? null,
      adsetId: src?.metaAdsetId ?? null,
      adId: src?.metaAdId ?? null,
    });
  }

  const linkedChannelKeys = new Set<string>();
  for (const c of confirmed) {
    if (c.originProvider !== "OLIST_ERP" && c.originExternalId) {
      linkedChannelKeys.add(`${c.originProvider}:${c.originExternalId}`);
    }
  }
  // também marca pelo olistOrderId no raw do canal
  for (const ch of channelRows) {
    const p = payloadOf(ch.rawPayload);
    if (typeof p.olistOrderId === "string" && p.olistOrderId) {
      linkedChannelKeys.add(`${ch.provider}:${ch.externalId}`);
    }
  }

  const channelOnly: SalesReconcile["channelOnly"] = [];
  for (const ch of channelRows) {
    if (!isRevenueOrder(ch.status)) continue;
    if (linkedChannelKeys.has(`${ch.provider}:${ch.externalId}`)) continue;
    channelOnly.push({
      provider: ch.provider,
      externalId: ch.externalId,
      totalCents: ch.totalCents ?? 0,
      occurredAt: ch.occurredAt,
    });
  }

  const confirmedCents = confirmed.reduce((s, c) => s + c.totalCents, 0);
  const channelOnlyCents = channelOnly.reduce((s, c) => s + c.totalCents, 0);
  const matched = matchedWoo + matchedMl;
  const matchRate = confirmed.length ? Math.round((matched / confirmed.length) * 100) : 0;

  return {
    olistConnected: true,
    confirmed,
    confirmedCents,
    confirmedCount: confirmed.length,
    matchedWoo,
    matchedMl,
    erpOnly,
    channelOnly,
    channelOnlyCents,
    channelOnlyCount: channelOnly.length,
    matchRate,
  };
}

export function confirmedOriginKey(sale: ConfirmedSale) {
  if (sale.originProvider === "OLIST_ERP") return "pdv";
  if (sale.originProvider === "MERCADO_LIVRE") return "mercadolivre";
  if (sale.originProvider === "WOOCOMMERCE") {
    const key = orderOriginKey(sale.originProvider, sale.channel as OrderChannel | string | null);
    // Sem UTM: ainda conta como Loja (não “Só ERP”).
    return key === "unknown" ? "loja" : key;
  }
  return orderOriginKey(sale.originProvider, sale.channel as OrderChannel | string | null);
}

/** Rótulos de canal na visão Geral (sem citar ERP). */
export function confirmedCanalLabel(originProvider: string) {
  if (originProvider === "WOOCOMMERCE") return "Loja";
  if (originProvider === "MERCADO_LIVRE") return "Mercado Livre";
  if (originProvider === "OLIST_ERP") return "PDV";
  return originProvider;
}

export function confirmedToStoreSales(confirmed: ConfirmedSale[]) {
  return confirmed.map((c) => ({
    day: c.day,
    channel: c.channel === "erp" ? "unknown" : c.channel,
    campaignName: c.campaignName,
    adsetId: c.adsetId,
    adId: c.adId,
    totalCents: c.totalCents,
  }));
}
