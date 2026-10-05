import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { isEcommerceCliente } from "@/lib/clientProfiles";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { CHANNEL_LABELS, type OrderChannel } from "@/lib/commerce-attribution/store-source";

const SITE_PROVIDERS = new Set(["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"]);

const PROVIDER_LABELS: Record<string, string> = {
  TRAY: "Tray",
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  NUVEMSHOP: "Nuvemshop",
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  TIKTOK_SHOP: "TikTok Shop",
  CHECKOUT: "Checkout Atrako",
  META: "Meta Ads",
  GOOGLE: "Google Ads",
  LINKEDIN: "LinkedIn Ads",
  TIKTOK: "TikTok Ads",
};

/** Compradores importados de lojas/marketplaces já contam como pedidos, não como leads. */
const ORDER_LEAD_SOURCES = ["tray", "shopify", "woocommerce", "nuvemshop", "mercadolivre", "shopee", "tiktokshop"];

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Visão Geral: soma de mídia, vendas (lojas, marketplaces, checkout) e leads do CRM. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "public-read");
  if (access.response) return access.response;

  const sp = request.nextUrl.searchParams;
  const dias = Math.min(365, Math.max(1, parseInt(sp.get("periodo") ?? "30", 10) || 30));
  let dataInicio = parseDateOnly(sp.get("dataInicio"));
  let dataFim = parseDateOnly(sp.get("dataFim"));
  if (!dataInicio || !dataFim || dataInicio > dataFim) {
    dataFim = new Date();
    dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    dataInicio.setHours(0, 0, 0, 0);
  }
  dataFim.setHours(23, 59, 59, 999);
  const range = { gte: dataInicio, lte: dataFim };

  const [cliente, midia, pedidos, checkout, crmLeads, relConv, relCost] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id },
      select: { nome: true, slug: true, perfilPanel: true, objetivoMidia: true },
    }),
    prisma.fatoMidiaDiario.groupBy({
      by: ["canal"],
      where: { clienteId: id, data: range },
      _sum: {
        investimento: true,
        leads: true,
        conversoes: true,
        purchases: true,
        websitePurchasesConversionValue: true,
      },
    }),
    prisma.marketplaceOrder.findMany({
      where: { clienteId: id, occurredAt: range },
      select: {
        provider: true,
        status: true,
        totalCents: true,
        source: { select: { channel: true, adMethod: true } },
      },
    }),
    prisma.commerceOrder.aggregate({
      where: { clienteId: id, status: "APPROVED", createdAt: range },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.nativeLead.count({
      where: {
        clienteId: id,
        createdAt: range,
        OR: [{ source: null }, { source: { notIn: ORDER_LEAD_SOURCES } }],
      },
    }),
    prisma.messageDelivery.groupBy({
      by: ["conversionKind"],
      where: { clienteId: id, isTest: false, convertedAt: range },
      _count: { _all: true },
      _sum: { convertedCents: true },
    }),
    prisma.messageDelivery.aggregate({
      where: { clienteId: id, isTest: false, createdAt: range },
      _sum: { costMicros: true },
    }),
  ]);

  type Bucket = { id: string; label: string; pedidos: number; receitaCents: number };
  const add = (map: Map<string, Bucket>, id: string, label: string, cents: number) => {
    const row = map.get(id) ?? { id, label, pedidos: 0, receitaCents: 0 };
    row.pedidos += 1;
    row.receitaCents += cents;
    map.set(id, row);
  };
  const porLoja = new Map<string, Bucket>();
  const porOrigem = new Map<string, Bucket>();
  let cancelados = 0;
  let metaIdentificadas = 0;
  for (const o of pedidos) {
    if (o.source?.adMethod === "meta_match" || o.source?.adMethod === "both") metaIdentificadas += 1;
    if (!isRevenueOrder(o.status)) {
      cancelados += 1;
      continue;
    }
    const cents = o.totalCents ?? 0;
    const lojaLabel = PROVIDER_LABELS[o.provider] ?? o.provider;
    add(porLoja, o.provider, lojaLabel, cents);
    if (!SITE_PROVIDERS.has(o.provider)) {
      add(porOrigem, o.provider, lojaLabel, cents);
      continue;
    }
    const ch = (o.source?.channel ?? "unknown") as OrderChannel;
    add(porOrigem, ch, ch === "unknown" ? "Sem origem" : CHANNEL_LABELS[ch] ?? ch, cents);
  }

  const canaisVenda = [...porLoja.values()];
  if (checkout._count._all > 0) {
    const row = {
      id: "CHECKOUT",
      label: PROVIDER_LABELS.CHECKOUT,
      pedidos: checkout._count._all,
      receitaCents: checkout._sum.totalCents ?? 0,
    };
    canaisVenda.push(row);
    porOrigem.set(row.id, { ...row });
  }
  canaisVenda.sort((a, b) => b.receitaCents - a.receitaCents);

  const canaisMidia = midia
    .map((m) => ({
      id: m.canal,
      label: PROVIDER_LABELS[m.canal] ?? m.canal,
      investimento: Math.round(Number(m._sum.investimento ?? 0) * 100) / 100,
      leads: (m._sum.leads ?? 0) + (m.canal === "GOOGLE" ? m._sum.conversoes ?? 0 : 0),
      compras: m._sum.purchases ?? 0,
      receitaAtribuida:
        Math.round(Number(m._sum.websitePurchasesConversionValue ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.investimento - a.investimento);

  // Sem vendas de loja/marketplace/checkout no período, as compras atribuídas pelos
  // anúncios viram a fonte de vendas. Com loja, ela é a fonte (evita contar o pedido duas vezes).
  let fonteVendas: "lojas" | "anuncios" = "lojas";
  if (canaisVenda.length === 0 && isEcommerceCliente(cliente)) {
    for (const m of canaisMidia) {
      if (m.compras <= 0 && m.receitaAtribuida <= 0) continue;
      canaisVenda.push({
        id: `ADS_${m.id}`,
        label: `${m.label} (atribuído)`,
        pedidos: m.compras,
        receitaCents: Math.round(m.receitaAtribuida * 100),
      });
    }
    if (canaisVenda.length > 0) {
      fonteVendas = "anuncios";
      canaisVenda.sort((a, b) => b.receitaCents - a.receitaCents);
    }
  }

  const receitaCents = canaisVenda.reduce((s, c) => s + c.receitaCents, 0);
  const totalPedidos = canaisVenda.reduce((s, c) => s + c.pedidos, 0);
  const investimento = canaisMidia.reduce((s, c) => s + c.investimento, 0);
  const leadsMidia = canaisMidia.reduce((s, c) => s + c.leads, 0);
  const receita = receitaCents / 100;

  const attributed = relConv.find((r) => r.conversionKind === "ATTRIBUTED");
  const influenced = relConv.find((r) => r.conversionKind === "INFLUENCED");
  const relReceita = (attributed?._sum.convertedCents ?? 0) / 100;
  // Receita do relacionamento já está dentro da receita das lojas: só separa, não soma.
  const receitaSemRel = Math.max(0, receita - relReceita);

  const metaMidia = canaisMidia.find((m) => m.id === "META");
  const metaReceita = (porOrigem.get("meta_ads")?.receitaCents ?? 0) / 100;
  const origens = fonteVendas === "lojas" ? [...porOrigem.values()].sort((a, b) => b.receitaCents - a.receitaCents) : [];

  return NextResponse.json({
    periodo: { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() },
    fonteVendas,
    ecommerce: isEcommerceCliente(cliente),
    totais: {
      receita,
      pedidos: totalPedidos,
      ticketMedio: totalPedidos > 0 ? Math.round((receita / totalPedidos) * 100) / 100 : 0,
      investimento: Math.round(investimento * 100) / 100,
      roas: investimento > 0 ? Math.round((receita / investimento) * 100) / 100 : null,
      leadsCrm: crmLeads,
      leadsMidia,
      roasSemRelacionamento:
        investimento > 0 ? Math.round((receitaSemRel / investimento) * 100) / 100 : null,
    },
    relacionamento: {
      receitaAtribuida: relReceita,
      pedidosAtribuidos: attributed?._count._all ?? 0,
      receitaInfluenciada: (influenced?._sum.convertedCents ?? 0) / 100,
      pedidosInfluenciados: influenced?._count._all ?? 0,
      custoWhatsApp: Math.round((relCost._sum.costMicros ?? 0) / 10_000) / 100,
      participacao: receita > 0 ? Math.round((relReceita / receita) * 1000) / 10 : null,
    },
    canaisVenda,
    canaisMidia,
    cancelados,
    origens,
    meta: metaMidia
      ? {
          investimento: metaMidia.investimento,
          comprasReportadas: metaMidia.compras,
          valorReportado: metaMidia.receitaAtribuida,
          identificadas: metaIdentificadas,
          pedidos: porOrigem.get("meta_ads")?.pedidos ?? 0,
          receita: metaReceita,
          roas: metaMidia.investimento > 0 ? Math.round((metaReceita / metaMidia.investimento) * 100) / 100 : null,
        }
      : null,
  });
}
