/** Relatório de vendas atribuídas ao Meta + comissão — cálculo puro (sem banco), compartilhado por API, PDF e CSV. */

import { isPaidOrderStatus, orderStatusLabel } from "../commerce-attribution/order-status";

export type OrderInput = {
  id: string;
  externalId: string;
  provider: string;
  status: string | null;
  totalCents: number | null;
  buyerName: string | null;
  cityName: string | null;
  cityRaw: string | null;
  stateUf: string | null;
  occurredAt: Date | null;
  createdAt: Date;
  rawPayload: unknown;
  items: Array<{ title: string; sku: string | null; quantity: number; unitPriceCents: number; lineTotalCents: number }>;
  source: {
    adMethod: string | null;
    adWindow: string | null;
    metaCampaignId: string | null;
    metaCampaignName: string | null;
    metaAdsetId: string | null;
    metaAdsetName: string | null;
    metaAdId: string | null;
    metaAdName: string | null;
  } | null;
};

export type MetaPurchaseInput = { clickPurchases: number; clickValueCents: number; viewPurchases: number; viewValueCents: number };

export type PedidoRelatorio = {
  id: string;
  numero: string;
  data: string;
  comprador: string | null;
  cidade: string | null;
  uf: string | null;
  status: string | null;
  statusLabel: string | null;
  totalCents: number;
  freteCents: number;
  descontoCents: number;
  comissaoCents: number;
  itens: Array<{ titulo: string; sku: string | null; quantidade: number; unitarioCents: number; totalCents: number }>;
  campanhaId: string | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
};

type Totais = { pedidos: number; faturamentoCents: number; comissaoCents: number };

export type VendasMetaReport = {
  versao: 1;
  periodo: { dataInicio: string; dataFim: string };
  comissaoPercent: number;
  geradoEm: string;
  resumo: Totais & {
    freteCents: number;
    descontoCents: number;
    ticketMedioCents: number;
    unidades: number;
    comissaoSemFreteCents: number;
  };
  porCampanha: Array<Totais & { campanhaId: string | null; campanha: string }>;
  porAnuncio: Array<Totais & { campanha: string; conjunto: string; anuncio: string }>;
  porProduto: Array<{ titulo: string; sku: string | null; quantidade: number; pedidos: number; receitaCents: number }>;
  pedidos: PedidoRelatorio[];
  /** Pedidos atribuídos ao Meta que ainda não foram pagos ou foram cancelados (fora da comissão). */
  naoConcretizados: { pedidos: number; valorCents: number };
  meta: { compras: number; valorCents: number };
};

export function comissaoDe(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

function reaisToCents(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

type RawOrder = { order?: { shipping_total?: unknown; discount_total?: unknown; number?: unknown } };

function wooExtras(raw: unknown) {
  const order = (raw as RawOrder | null)?.order;
  return {
    freteCents: reaisToCents(order?.shipping_total),
    descontoCents: reaisToCents(order?.discount_total),
    numero: order?.number != null && order.number !== "" ? String(order.number) : null,
  };
}

const SEM_CAMPANHA = "Campanha não identificada";

export function aggregateVendasMetaReport(input: {
  periodo: { dataInicio: string; dataFim: string };
  comissaoPercent: number;
  orders: OrderInput[];
  metaPurchases: MetaPurchaseInput[];
  now?: Date;
}): VendasMetaReport {
  const pct = input.comissaoPercent;
  const pedidos: PedidoRelatorio[] = [];
  const naoConcretizados = { pedidos: 0, valorCents: 0 };

  for (const o of input.orders) {
    const total = o.totalCents ?? 0;
    if (!isPaidOrderStatus(o.status)) {
      naoConcretizados.pedidos += 1;
      naoConcretizados.valorCents += total;
      continue;
    }
    const extras = o.provider === "WOOCOMMERCE" ? wooExtras(o.rawPayload) : { freteCents: 0, descontoCents: 0, numero: null };
    pedidos.push({
      id: o.id,
      numero: extras.numero ?? o.externalId,
      data: (o.occurredAt ?? o.createdAt).toISOString(),
      comprador: o.buyerName,
      cidade: o.cityName ?? o.cityRaw,
      uf: o.stateUf,
      status: o.status,
      statusLabel: orderStatusLabel(o.status),
      totalCents: total,
      freteCents: extras.freteCents,
      descontoCents: extras.descontoCents,
      comissaoCents: comissaoDe(total, pct),
      itens: o.items.map((i) => ({
        titulo: i.title,
        sku: i.sku,
        quantidade: i.quantity,
        unitarioCents: i.unitPriceCents,
        totalCents: i.lineTotalCents,
      })),
      campanhaId: o.source?.metaCampaignId ?? null,
      campanha: o.source?.metaCampaignName ?? null,
      conjunto: o.source?.metaAdsetName ?? null,
      anuncio: o.source?.metaAdName ?? null,
    });
  }
  pedidos.sort((a, b) => a.data.localeCompare(b.data));

  const faturamento = pedidos.reduce((s, p) => s + p.totalCents, 0);
  const frete = pedidos.reduce((s, p) => s + p.freteCents, 0);
  const desconto = pedidos.reduce((s, p) => s + p.descontoCents, 0);
  const unidades = pedidos.reduce((s, p) => s + p.itens.reduce((q, i) => q + i.quantidade, 0), 0);

  const totais = (list: PedidoRelatorio[]): Totais => {
    const cents = list.reduce((s, p) => s + p.totalCents, 0);
    return { pedidos: list.length, faturamentoCents: cents, comissaoCents: comissaoDe(cents, pct) };
  };

  const groupBy = <K extends string>(keyOf: (p: PedidoRelatorio) => K) => {
    const map = new Map<K, PedidoRelatorio[]>();
    for (const p of pedidos) {
      const k = keyOf(p);
      const list = map.get(k);
      if (list) list.push(p);
      else map.set(k, [p]);
    }
    return map;
  };
  const byFaturamento = (a: Totais, b: Totais) => b.faturamentoCents - a.faturamentoCents || b.pedidos - a.pedidos;

  const porCampanha = [...groupBy((p) => p.campanhaId ?? p.campanha ?? "").values()]
    .map((list) => ({
      campanhaId: list[0].campanhaId,
      campanha: list.find((p) => p.campanha)?.campanha ?? SEM_CAMPANHA,
      ...totais(list),
    }))
    .sort(byFaturamento);

  const porAnuncio = [...groupBy((p) => `${p.campanha ?? ""}\u0000${p.conjunto ?? ""}\u0000${p.anuncio ?? ""}`).values()]
    .map((list) => ({
      campanha: list[0].campanha ?? SEM_CAMPANHA,
      conjunto: list[0].conjunto ?? "—",
      anuncio: list[0].anuncio ?? "—",
      ...totais(list),
    }))
    .sort(byFaturamento);

  const produtos = new Map<string, { titulo: string; sku: string | null; quantidade: number; pedidos: Set<string>; receitaCents: number }>();
  for (const p of pedidos) {
    for (const i of p.itens) {
      const key = i.sku || i.titulo;
      const row = produtos.get(key) ?? { titulo: i.titulo, sku: i.sku, quantidade: 0, pedidos: new Set<string>(), receitaCents: 0 };
      row.quantidade += i.quantidade;
      row.receitaCents += i.totalCents;
      row.pedidos.add(p.id);
      produtos.set(key, row);
    }
  }
  const porProduto = [...produtos.values()]
    .map((r) => ({ titulo: r.titulo, sku: r.sku, quantidade: r.quantidade, pedidos: r.pedidos.size, receitaCents: r.receitaCents }))
    .sort((a, b) => b.receitaCents - a.receitaCents || b.quantidade - a.quantidade);

  return {
    versao: 1,
    periodo: input.periodo,
    comissaoPercent: pct,
    geradoEm: (input.now ?? new Date()).toISOString(),
    resumo: {
      pedidos: pedidos.length,
      faturamentoCents: faturamento,
      comissaoCents: comissaoDe(faturamento, pct),
      freteCents: frete,
      descontoCents: desconto,
      ticketMedioCents: pedidos.length ? Math.round(faturamento / pedidos.length) : 0,
      unidades,
      comissaoSemFreteCents: comissaoDe(Math.max(0, faturamento - frete), pct),
    },
    porCampanha,
    porAnuncio,
    porProduto,
    pedidos,
    naoConcretizados,
    meta: {
      compras: input.metaPurchases.reduce((s, r) => s + r.clickPurchases + r.viewPurchases, 0),
      valorCents: input.metaPurchases.reduce((s, r) => s + r.clickValueCents + r.viewValueCents, 0),
    },
  };
}

/* ───────────── Formatação (PT-BR) ───────────── */

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPercent(pct: number): string {
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** "24/08/2026 14:32" em BRT. */
export function formatDateTimeBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/* ───────────── CSV ───────────── */

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function decimalBR(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** CSV para Excel pt-BR: separador `;`, decimal com vírgula, BOM UTF-8. */
export function vendasMetaCsv(report: VendasMetaReport, tipo: "pedidos" | "itens" = "pedidos"): string {
  const rows: Array<Array<string | number | null>> = [];
  const base = (p: PedidoRelatorio) => [
    p.numero,
    formatDateTimeBR(p.data),
    p.comprador,
    p.cidade,
    p.uf,
    p.statusLabel,
  ];
  const origem = (p: PedidoRelatorio) => [p.campanha, p.conjunto, p.anuncio];
  if (tipo === "itens") {
    rows.push(["Pedido", "Data", "Comprador", "Cidade", "UF", "Status", "Produto", "SKU", "Quantidade", "Valor unitário (R$)", "Total do item (R$)", "Campanha", "Conjunto", "Anúncio"]);
    for (const p of report.pedidos) {
      for (const i of p.itens) {
        rows.push([...base(p), i.titulo, i.sku, i.quantidade, decimalBR(i.unitarioCents), decimalBR(i.totalCents), ...origem(p)]);
      }
    }
  } else {
    rows.push(["Pedido", "Data", "Comprador", "Cidade", "UF", "Status", "Itens", "Frete (R$)", "Desconto (R$)", "Total (R$)", `Comissão ${formatPercent(report.comissaoPercent)} (R$)`, "Campanha", "Conjunto", "Anúncio"]);
    for (const p of report.pedidos) {
      rows.push([
        ...base(p),
        p.itens.map((i) => `${i.quantidade}x ${i.titulo}`).join(" | "),
        decimalBR(p.freteCents),
        decimalBR(p.descontoCents),
        decimalBR(p.totalCents),
        decimalBR(p.comissaoCents),
        ...origem(p),
      ]);
    }
    rows.push([]);
    rows.push(["Total", null, null, null, null, null, `${report.resumo.pedidos} pedidos`, decimalBR(report.resumo.freteCents), decimalBR(report.resumo.descontoCents), decimalBR(report.resumo.faturamentoCents), decimalBR(report.resumo.comissaoCents)]);
  }
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
