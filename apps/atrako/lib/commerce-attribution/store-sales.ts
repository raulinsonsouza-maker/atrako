/** Pedidos pagos da loja no período, a mesma base do Geral, do Meta e da comissão. */

import { prisma } from "@/lib/db";
import { confirmedToStoreSales, loadConfirmedSales } from "./confirmed-sales";

export type StoreSale = {
  day: string;
  channel: string;
  campaignName: string | null;
  adsetId: string | null;
  adId: string | null;
  totalCents: number;
};

const CANAL_CHANNEL: Record<string, string> = {
  meta: "meta_ads",
  google: "google_ads",
};

export async function storeHasOrders(clienteId: string) {
  const row = await prisma.marketplaceOrder.findFirst({ where: { clienteId }, select: { id: true } });
  return Boolean(row);
}

/** Com Olist conectada: 1× pedido ERP confirmado (atribuição do canal). Sem Olist: canais clássicos. */
export async function loadStoreSales(clienteId: string, inicio: string, fim: string): Promise<StoreSale[]> {
  const reconcile = await loadConfirmedSales(clienteId, inicio, fim);
  return confirmedToStoreSales(reconcile.confirmed);
}

/** `geral` = todos os pedidos pagos. `meta` / `google` = só a origem daquele anúncio. */
export function salesForCanal(sales: StoreSale[], canal: string) {
  const key = canal.toLowerCase();
  if (key === "geral") return sales;
  const channel = CANAL_CHANNEL[key];
  if (!channel) return [];
  return sales.filter((s) => s.channel === channel);
}

export function salesGrouped(sales: StoreSale[], keyOf: (s: StoreSale) => string) {
  const map = new Map<string, { n: number; cents: number }>();
  for (const s of sales) {
    const key = keyOf(s);
    const row = map.get(key) ?? { n: 0, cents: 0 };
    row.n += 1;
    row.cents += s.totalCents;
    map.set(key, row);
  }
  return map;
}

export function sumSales(sales: StoreSale[]) {
  const cents = sales.reduce((s, o) => s + o.totalCents, 0);
  return { pedidos: sales.length, receitaCents: cents, receita: Math.round(cents) / 100 };
}

export function salesByDay(sales: StoreSale[]) {
  const map = new Map<string, { pedidos: number; cents: number }>();
  for (const s of sales) {
    const row = map.get(s.day) ?? { pedidos: 0, cents: 0 };
    row.pedidos += 1;
    row.cents += s.totalCents;
    map.set(s.day, row);
  }
  return map;
}

type SeriesPoint = { inicio: Date; purchases: number; valorConversao: number };

/** Zera o Pixel da série e coloca os pedidos pagos no balde do dia. A soma fecha com o KPI. */
export function applySeriesSales(series: SeriesPoint[], sales: StoreSale[], agrupamento: "semanal" | "mensal" | "diario") {
  for (const s of series) {
    s.purchases = 0;
    s.valorConversao = 0;
  }
  const ordered = [...series].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  for (const sale of sales) {
    const at = noon(sale.day);
    const exact = ordered.find((s) => holds(s.inicio, at, agrupamento));
    const bucket = exact ?? ordered.filter((s) => s.inicio.getTime() <= at.getTime()).at(-1) ?? ordered[0];
    if (!bucket) continue;
    bucket.purchases += 1;
    bucket.valorConversao += sale.totalCents / 100;
  }
  for (const s of series) s.valorConversao = Math.round(s.valorConversao * 100) / 100;
}

function noon(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function holds(inicio: Date, at: Date, agrupamento: "semanal" | "mensal" | "diario") {
  if (agrupamento === "diario") {
    return inicio.getFullYear() === at.getFullYear() && inicio.getMonth() === at.getMonth() && inicio.getDate() === at.getDate();
  }
  if (agrupamento === "mensal") return inicio.getFullYear() === at.getFullYear() && inicio.getMonth() === at.getMonth();
  const start = inicio.getTime();
  return at.getTime() >= start && at.getTime() < start + 7 * 86_400_000;
}

type CampaignRow = {
  nome: string;
  purchases: number;
  faturamento: number;
  investimento: number;
  resultType: string;
  resultados: number | null;
  custoResultado: number | null;
  cpa: number | null;
  ticketMedio: number | null;
  roas: number | null;
};

/** Troca compras/faturamento do Pixel pelas vendas pagas da loja, por nome de campanha. */
export function overlayCampaignSales<T extends CampaignRow>(campanhas: T[], sales: StoreSale[]): T[] {
  const byName = new Map<string, { n: number; cents: number }>();
  for (const s of sales) {
    const nome = s.campaignName || "Campanha não identificada";
    const row = byName.get(nome) ?? { n: 0, cents: 0 };
    row.n += 1;
    row.cents += s.totalCents;
    byName.set(nome, row);
  }
  for (const c of campanhas) {
    const hit = byName.get(c.nome) ?? { n: 0, cents: 0 };
    byName.delete(c.nome);
    paintCampaign(c, hit.n, hit.cents);
  }
  for (const [nome, hit] of byName) {
    if (hit.n <= 0) continue;
    const blank = {
      nome,
      status: null,
      diasAtivos: 0,
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      leads: 0,
      purchases: 0,
      faturamento: 0,
      conversas: 0,
      profileVisits: 0,
      resultType: "vendas",
      resultados: 0,
      custoResultado: null,
      cpl: null,
      cpa: null,
      ticketMedio: null,
      roas: null,
      ctr: null,
    } as unknown as T;
    paintCampaign(blank, hit.n, hit.cents);
    campanhas.push(blank);
  }
  return campanhas;
}

function paintCampaign(c: CampaignRow, n: number, cents: number) {
  c.purchases = n;
  c.faturamento = Math.round(cents) / 100;
  if (n > 0) {
    c.resultType = "vendas";
    c.resultados = n;
    c.custoResultado = c.investimento > 0 ? c.investimento / n : null;
  } else if (c.resultType === "vendas") {
    c.resultados = 0;
    c.custoResultado = null;
  }
  c.cpa = n > 0 && c.investimento > 0 ? c.investimento / n : null;
  c.ticketMedio = n > 0 ? c.faturamento / n : null;
  c.roas = c.investimento > 0 && c.faturamento > 0 ? c.faturamento / c.investimento : null;
}

type AdLike = {
  id: string;
  insights?: {
    data?: Array<{
      actions?: Array<{ action_type: string; value: string }>;
      action_values?: Array<{ action_type: string; value: string }>;
    }>;
  };
};

const PURCHASE_ACTIONS = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "website_purchase",
]);

/** Compras do criativo = pedidos pagos atribuídos àquele anúncio. A soma fecha com a aba Meta. */
export function applyStorePurchases(ads: AdLike[], sales: StoreSale[]) {
  const byAd = new Map<string, { n: number; cents: number }>();
  for (const s of sales) {
    if (!s.adId) continue;
    const row = byAd.get(s.adId) ?? { n: 0, cents: 0 };
    row.n += 1;
    row.cents += s.totalCents;
    byAd.set(s.adId, row);
  }
  for (const ad of ads) {
    const hit = byAd.get(ad.id) ?? { n: 0, cents: 0 };
    const rows = ad.insights?.data ?? [];
    rows.forEach((row, i) => {
      const actions = (row.actions ?? []).filter((a) => !PURCHASE_ACTIONS.has(a.action_type));
      const values = (row.action_values ?? []).filter((a) => !PURCHASE_ACTIONS.has(a.action_type));
      if (i === 0 && hit.n > 0) {
        actions.push({ action_type: "offsite_conversion.fb_pixel_purchase", value: String(hit.n) });
        values.push({ action_type: "offsite_conversion.fb_pixel_purchase", value: (hit.cents / 100).toFixed(2) });
      }
      row.actions = actions;
      row.action_values = values;
    });
  }
}
