import { prisma } from "@/lib/db";
import { executeAnalystTool } from "@/lib/analyst/dataTools";
import { getPipelineBoard } from "@/lib/modules/crm";
import { summarizeLedger } from "@/lib/atrako/finance-ledger";
import { getPersonJourney } from "@/lib/atrako/person";
import { getAbandonedCartSummary } from "@/lib/crm/abandoned-cart";
import { getCartRecoveryMetrics, getRepurchaseMetrics } from "@/lib/commerce/customer-metrics";
import { getComportamento, type Comportamento } from "@/lib/commerce/comportamento";
import { isRevenueOrder, orderStatusLabel } from "@/lib/commerce-attribution/order-status";
import { shippingFacetKey, shippingLabel } from "@/lib/integrations/mercadolivre/shipments";
import { stateName } from "@/lib/geo/place";
import { CHANNEL_LABELS, orderOriginKey, type OrderChannel } from "@/lib/commerce-attribution/store-source";
import type { ModuleKey } from "@/lib/modules/registry";
import {
  PERIOD_PRESETS,
  resolvePeriod,
  toAnalystPeriodContext,
  type AtrakoCoverage,
  type AtrakoPeriod,
  type AtrakoWorkspaceContext,
} from "./context";
import { maskEmail, maskPhone, revealToken, type PiiVault } from "./safety";
import type { Artifact, ContactCardArtifact } from "./artifacts";
import { chartsFor } from "./charts";
import { MAX_CARDS, contactCard, listCarts, listLeads } from "./crm-cards";

/**
 * Catálogo de ferramentas do Atrako. Cada ferramenta:
 * - recebe `clienteId` do runtime (sessão), nunca dos argumentos do modelo;
 * - devolve `{ data, coverage, source }` — o modelo sabe se é zero real ou falta de fonte;
 * - nunca expõe tokens, `credentialsEnc` ou contato em massa (e-mail/telefone mascarados).
 */

export type CoverageState = "available" | "empty" | "not_connected";

export type ToolSource = {
  tool: string;
  label: string;
  period?: { start: string; end: string; previousStart?: string; previousEnd?: string };
  note?: string;
};

export type PendingAction = {
  tool: string;
  summary: string;
  preview: Record<string, unknown>;
  args: Record<string, unknown>;
};

export type ToolResult = {
  data: unknown;
  coverage: CoverageState;
  source: ToolSource;
  /** Ações DRAFT: proposta aguardando confirmação do usuário. */
  pendingAction?: PendingAction;
  /** Cards na conversa (gráfico, referências, prévia, teste) — o modelo só recebe o resumo. */
  artifacts?: Artifact[];
};

export type ToolRuntime = {
  ctx: AtrakoWorkspaceContext;
  vault?: PiiVault;
  /** Atualiza o rótulo do passo no orb durante ferramentas longas. */
  onProgress?: (label: string) => void;
  signal?: AbortSignal;
  /** O que o usuário escreveu nesta conversa (não o que o modelo resumiu). */
  userText?: string;
  /** Só a mensagem desta vez. A confirmação da página olha para ela, não para o histórico. */
  lastUserMessage?: string;
};

type JsonSchema = Record<string, unknown>;

export type AtrakoTool = {
  name: string;
  /** Rótulo do passo no orb ("Consultando campanhas"). */
  step: string;
  description: string;
  parameters: JsonSchema;
  /** WRITE grava direto (criação/publicação pedida pelo usuário). */
  risk: "READ" | "DRAFT" | "WRITE";
  /** Só aparece se o módulo estiver ligado no workspace. */
  module?: ModuleKey;
  /** Ferramenta demorada (gera página com IA): estende o prazo total da resposta. */
  longRunning?: boolean;
  /** Cria recurso: depois de um sucesso, novas chamadas na mesma resposta não criam outro. */
  oncePerTurn?: boolean;
  run: (args: Record<string, unknown>, rt: ToolRuntime) => Promise<ToolResult>;
};

// ── schema helpers (compatíveis com strict mode: tudo required, opcional = null) ──

export const nullableString = (description: string, values?: readonly string[]) =>
  values
    ? { type: ["string", "null"], enum: [...values, null], description }
    : { type: ["string", "null"], description };

export const nullableInt = (description: string) => ({ type: ["integer", "null"], description });

const PERIOD_PROPS = {
  periodo: nullableString(
    "Período pré-definido. Use null para o padrão (últimos 30 dias). Use 'personalizado' com inicio/fim.",
    PERIOD_PRESETS,
  ),
  inicio: nullableString("Data inicial YYYY-MM-DD (só quando o usuário der datas)."),
  fim: nullableString("Data final YYYY-MM-DD (inclusive)."),
} as const;

export function objectSchema(props: Record<string, unknown>): JsonSchema {
  return {
    type: "object",
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

const periodSchema = (extra: Record<string, unknown> = {}) => objectSchema({ ...PERIOD_PROPS, ...extra });

// ── utilidades ──

const money = (cents: number | null | undefined) => Math.round(Number(cents ?? 0)) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, total: number) => (total > 0 ? round2((part / total) * 100) : null);
const delta = (cur: number, prev: number) => (prev > 0 ? round2(((cur - prev) / prev) * 100) : null);

function periodOf(args: Record<string, unknown>, rt: ToolRuntime): AtrakoPeriod {
  return resolvePeriod(args, rt.ctx.today, rt.ctx.timezone);
}

function periodSource(p: AtrakoPeriod): ToolSource["period"] {
  return {
    start: p.startLabel,
    end: p.endLabel,
    previousStart: p.previousStartLabel,
    previousEnd: p.previousEndLabel,
  };
}

function coverageFor(rt: ToolRuntime, keys: Array<keyof AtrakoCoverage>, hasRows: boolean): CoverageState {
  if (!keys.some((k) => rt.ctx.coverage[k])) return "not_connected";
  return hasRows ? "available" : "empty";
}

const CARD_GUIDANCE =
  "Os primeiros já aparecem como cartão do cliente na conversa (contato, etapa, itens, valor, data). Responda em 2-4 frases sem bullets repetindo esses campos: destaque o que importa (há quanto tempo, se já recebeu mensagem, histórico de compra) e termine com uma sugestão concreta numa frase natural.";

const range = (p: AtrakoPeriod) => ({ gte: p.start, lte: p.end });
const prevRange = (p: AtrakoPeriod) => ({ gte: p.previousStart, lte: p.previousEnd });
const reais = (cents: number | null | undefined) => (cents == null ? null : money(cents));

const DIAS_COMPRA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;
const MESES_COMPRA = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloSerieCompra(data: string, agrupamento: Comportamento["serieAgrupamento"]) {
  const [ano, mes, dia] = data.split("-");
  const curto = MESES_COMPRA[Number(mes) - 1] ?? mes;
  if (agrupamento === "mes") return `${curto}/${ano.slice(2)}`;
  if (agrupamento === "semana") return `sem ${dia}/${mes}`;
  return `${dia}/${mes}`;
}

/** O mesmo recorte da aba Comportamento, em reais e sem carrinho nem e-mail. */
function comportamentoParaAgente(view: Comportamento) {
  const receita = view.tickets.receitaCents;
  const fatia = (pedidos: number, cents: number) => ({
    pedidos,
    receita: money(cents),
    participacaoPct: pct(cents, receita),
  });
  const picos = view.heatmap
    .flatMap((row, dia) => row.map((pedidos, hora) => ({ dia: DIAS_COMPRA[dia] ?? String(dia), hora, pedidos })))
    .filter((cell) => cell.pedidos > 0)
    .sort((a, b) => b.pedidos - a.pedidos)
    .slice(0, 5);
  const serie = view.serie.filter((row) => row.totalCents > 0);
  return {
    leitura: view.leitura,
    tickets: {
      pedido: reais(view.tickets.pedidoCents),
      porCliente: reais(view.tickets.porClienteCents),
      primeiraCompra: reais(view.tickets.primeiraCents),
      recompra: reais(view.tickets.recompraCents),
      anterior: {
        pedido: reais(view.ticketsAnterior.pedidoCents),
        porCliente: reais(view.ticketsAnterior.porClienteCents),
      },
    },
    recompra: {
      receitaNova: money(view.recompra.receitaPrimeiraCents),
      pedidosNovos: view.recompra.pedidosPrimeira,
      receitaRecompra: money(view.recompra.receitaRecompraCents),
      pedidosRecompra: view.recompra.pedidosRecompra,
      participacaoRecorrentePct: view.recompra.participacaoRecorrentesPct,
      pedidosSemComprador: view.recompra.pedidosSemContato,
      receitaSemComprador: money(view.recompra.receitaSemContatoCents),
    },
    ltv: {
      medio: reais(view.ltv.medioCents),
      compradores: view.ltv.compradores,
      receita: money(view.ltv.receitaCents),
    },
    genero: {
      mulheres: fatia(view.genero.f.pedidos, view.genero.f.receitaCents),
      homens: fatia(view.genero.m.pedidos, view.genero.m.receitaCents),
      naoIdentificado: fatia(view.genero.u.pedidos, view.genero.u.receitaCents),
      nota: "Estimativa pelo primeiro nome. A loja não envia sexo. Nomes genéricos ficam sem identificação.",
    },
    origens: view.origens.slice(0, 8).map((row) => ({
      origem: row.label,
      clientes: row.clientes,
      receita: money(row.receitaCents),
      ticket: reais(row.ticketCents),
      voltaramPct: row.recompraPct,
    })),
    produtos: view.produtos.slice(0, 8).map((row) => ({
      nome: row.nome,
      quantidade: row.quantidade,
      receita: money(row.receitaCents),
      compradores: row.compradores,
      ticket: reais(row.ticketCents),
      voltaram: row.recompras,
    })),
    depoisComprou: view.pares.slice(0, 6).map((row) => ({
      de: row.de,
      para: row.para,
      compradores: row.compradores,
    })),
    maioresCompradores: view.topCompradores.slice(0, 8).map((row) => ({
      nome: row.nome,
      pedidos: row.pedidos,
      receita: money(row.receitaCents),
    })),
    lugares: view.estados.slice(0, 8).map((row) => ({
      lugar: row.nome,
      pedidos: row.pedidos,
      receita: money(row.receitaCents),
      cidade: row.cidades[0]?.nome ?? null,
    })),
    quandoCompram: picos,
    serie: {
      agrupamento: view.serieAgrupamento,
      pontos: (serie.length > 18 ? serie.slice(-18) : serie).map((row) => ({
        periodo: rotuloSerieCompra(row.data, view.serieAgrupamento),
        total: money(row.totalCents),
        nova: money(row.primeiraCents),
        recompra: money(row.recompraCents),
      })),
    },
  };
}

/** Delegação ao InPilot (mídia, campanhas, criativos, funil externo, GA, metas). */
async function analyst(
  tool: string,
  label: string,
  analystName: string,
  args: Record<string, unknown>,
  rt: ToolRuntime,
  coverageKeys: Array<keyof AtrakoCoverage>,
  analystArgs: Record<string, unknown> = {},
): Promise<ToolResult> {
  const period = periodOf(args, rt);
  if (coverageKeys.length && !coverageKeys.some((k) => rt.ctx.coverage[k])) {
    return {
      data: null,
      coverage: "not_connected",
      source: { tool, label, period: periodSource(period), note: "Fonte não conectada neste workspace." },
    };
  }
  const c = await toAnalystPeriodContext(rt.ctx, period);
  const out = await executeAnalystTool(analystName, analystArgs, c);
  return {
    data: out.data,
    coverage: "available",
    source: {
      tool,
      label,
      period: periodSource(period),
      note: typeof (out.source as { limitations?: unknown }).limitations === "string"
        ? String((out.source as { limitations?: unknown }).limitations)
        : undefined,
    },
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  TRAY: "Tray",
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  NUVEMSHOP: "Nuvemshop",
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  TIKTOK_SHOP: "TikTok Shop",
  CHECKOUT: "Checkout Atrako",
  FOOD: "Food",
  META: "Meta Ads",
  GOOGLE: "Google Ads",
  LINKEDIN: "LinkedIn Ads",
  TIKTOK: "TikTok Ads",
};
const SITE_PROVIDERS = new Set(["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"]);

async function salesSnapshot(clienteId: string, r: { gte: Date; lte: Date }) {
  const [orders, checkout, food, media] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { clienteId, occurredAt: r },
      select: { provider: true, status: true, totalCents: true, source: { select: { channel: true } } },
    }),
    prisma.commerceOrder.aggregate({
      where: { clienteId, status: "APPROVED", createdAt: r },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.foodOrder.aggregate({
      where: { clienteId, paymentStatus: "APPROVED", paidAt: r },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.fatoMidiaDiario.groupBy({
      by: ["canal"],
      where: { clienteId, data: r },
      _sum: { investimento: true, purchases: true, websitePurchasesConversionValue: true },
    }),
  ]);
  type Bucket = { label: string; pedidos: number; receita: number };
  const byStore = new Map<string, Bucket>();
  const byOrigin = new Map<string, Bucket>();
  const add = (map: Map<string, Bucket>, key: string, label: string, cents: number) => {
    const row = map.get(key) ?? { label, pedidos: 0, receita: 0 };
    row.pedidos += 1;
    row.receita += money(cents);
    map.set(key, row);
  };
  let cancelados = 0;
  for (const o of orders) {
    if (!isRevenueOrder(o.status)) {
      cancelados += 1;
      continue;
    }
    const cents = o.totalCents ?? 0;
    const storeLabel = PROVIDER_LABELS[o.provider] ?? o.provider;
    add(byStore, o.provider, storeLabel, cents);
    const key = orderOriginKey(o.provider, o.source?.channel);
    const originLabel = !SITE_PROVIDERS.has(o.provider)
      ? storeLabel
      : key === "unknown"
        ? "Sem origem identificada"
        : CHANNEL_LABELS[key as OrderChannel] ?? key;
    add(byOrigin, key, originLabel, cents);
  }
  if (checkout._count._all > 0) {
    const row = { label: PROVIDER_LABELS.CHECKOUT, pedidos: checkout._count._all, receita: money(checkout._sum.totalCents) };
    byStore.set("CHECKOUT", row);
    byOrigin.set("CHECKOUT", { ...row });
  }
  if (food._count._all > 0) {
    const row = { label: PROVIDER_LABELS.FOOD, pedidos: food._count._all, receita: money(food._sum.totalCents) };
    byStore.set("FOOD", row);
    byOrigin.set("FOOD", { ...row });
  }
  const stores = [...byStore.values()].map((b) => ({ ...b, receita: round2(b.receita) })).sort((a, b) => b.receita - a.receita);
  const receita = round2(stores.reduce((s, b) => s + b.receita, 0));
  const pedidos = stores.reduce((s, b) => s + b.pedidos, 0);
  const investimento = round2(media.reduce((s, m) => s + Number(m._sum.investimento ?? 0), 0));
  return {
    receita,
    pedidos,
    ticketMedio: pedidos ? round2(receita / pedidos) : null,
    cancelados,
    investimentoMidia: investimento,
    porLoja: stores,
    porOrigem: [...byOrigin.values()].map((b) => ({ ...b, receita: round2(b.receita) })).sort((a, b) => b.receita - a.receita),
    midia: media.map((m) => {
      const investimentoCanal = round2(Number(m._sum.investimento ?? 0));
      const valorReportado = round2(Number(m._sum.websitePurchasesConversionValue ?? 0));
      return {
        canal: PROVIDER_LABELS[m.canal] ?? m.canal,
        investimento: investimentoCanal,
        comprasReportadas: m._sum.purchases ?? 0,
        valorReportado,
        roas: investimentoCanal > 0 ? round2(valorReportado / investimentoCanal) : null,
      };
    }),
  };
}

const MARKETPLACE_PROVIDERS = ["MERCADO_LIVRE", "SHOPEE", "TIKTOK_SHOP"] as const;

function marketplaceProviders(raw: unknown): string[] {
  const value = typeof raw === "string" ? raw.trim().toLowerCase().replace(/[\s-]+/g, "") : "";
  if (value === "mercadolivre" || value === "ml") return ["MERCADO_LIVRE"];
  if (value === "shopee") return ["SHOPEE"];
  if (value === "tiktok" || value === "tiktokshop") return ["TIKTOK_SHOP"];
  return [...MARKETPLACE_PROVIDERS];
}

function plainTitle(value: string) {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** Recorte da aba Marketplaces: frete, lugar, líquido e produtos. Não inclui a loja própria. */
async function marketplaceSnapshot(clienteId: string, r: { gte: Date; lte: Date }, providers: string[]) {
  const where = { clienteId, provider: { in: providers }, occurredAt: r };
  const [orders, items] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where,
      select: {
        id: true,
        provider: true,
        externalId: true,
        status: true,
        totalCents: true,
        saleFeeCents: true,
        shippingCostCents: true,
        netCents: true,
        shippingMode: true,
        logisticType: true,
        stateUf: true,
        cityName: true,
        cityRaw: true,
        buyerName: true,
        occurredAt: true,
      },
    }),
    prisma.marketplaceOrderItem.findMany({
      where: { order: where },
      select: {
        title: true,
        quantity: true,
        lineTotalCents: true,
        orderId: true,
        order: { select: { status: true } },
      },
    }),
  ]);

  const paidIds = new Set<string>();
  let receitaCents = 0;
  let taxasCents = 0;
  let freteCents = 0;
  let liquidoCents = 0;
  let semCidade = 0;
  const frete = new Map<string, { tipo: string; pedidos: number; receita: number; custoFrete: number }>();
  const estados = new Map<string, { estado: string; pedidos: number; receita: number; cidades: Map<string, { cidade: string; pedidos: number; receita: number }> }>();

  for (const order of orders) {
    if (!isRevenueOrder(order.status)) continue;
    paidIds.add(order.id);
    const cents = order.totalCents ?? 0;
    const taxa = order.saleFeeCents ?? 0;
    const fretePedido = order.shippingCostCents ?? 0;
    receitaCents += cents;
    taxasCents += taxa;
    freteCents += fretePedido;
    liquidoCents += order.netCents ?? cents - taxa - fretePedido;

    const tipo = shippingLabel(order.shippingMode, order.logisticType);
    const freteKey = shippingFacetKey(order.shippingMode, order.logisticType);
    const freteLabel = tipo === "—" ? "Envio" : tipo;
    const freteRow = frete.get(freteKey) ?? { tipo: freteLabel, pedidos: 0, receita: 0, custoFrete: 0 };
    freteRow.pedidos += 1;
    freteRow.receita += money(cents);
    freteRow.custoFrete += money(fretePedido);
    frete.set(freteKey, freteRow);

    const cidade = order.cityName || order.cityRaw;
    if (!cidade) semCidade += 1;
    const uf = order.stateUf || "_";
    const estado = estados.get(uf) ?? { estado: stateName(order.stateUf), pedidos: 0, receita: 0, cidades: new Map() };
    estado.pedidos += 1;
    estado.receita += money(cents);
    if (cidade) {
      const city = estado.cidades.get(cidade) ?? { cidade, pedidos: 0, receita: 0 };
      city.pedidos += 1;
      city.receita += money(cents);
      estado.cidades.set(cidade, city);
    }
    estados.set(uf, estado);
  }

  const produtos = new Map<string, { nome: string; unidades: number; pedidos: Set<string>; receita: number }>();
  for (const item of items) {
    if (!paidIds.has(item.orderId) || !isRevenueOrder(item.order.status)) continue;
    const nome = plainTitle(item.title) || "Produto";
    const row = produtos.get(nome) ?? { nome, unidades: 0, pedidos: new Set<string>(), receita: 0 };
    row.unidades += item.quantity;
    row.pedidos.add(item.orderId);
    row.receita += money(item.lineTotalCents);
    produtos.set(nome, row);
  }

  const pedidos = paidIds.size;
  const recentes = [...orders]
    .sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0))
    .slice(0, 5)
    .map((order) => ({
      numero: order.externalId,
      canal: PROVIDER_LABELS[order.provider] ?? order.provider,
      comprador: order.buyerName,
      cidade: order.cityName || order.cityRaw || null,
      estado: order.stateUf ? stateName(order.stateUf) : null,
      status: orderStatusLabel(order.status),
      total: reais(order.totalCents),
      frete: (() => {
        const label = shippingLabel(order.shippingMode, order.logisticType);
        return label === "—" ? null : label;
      })(),
    }));

  return {
    receita: round2(money(receitaCents)),
    pedidos,
    ticketMedio: pedidos ? round2(money(receitaCents) / pedidos) : null,
    taxas: round2(money(taxasCents)),
    freteVendedor: round2(money(freteCents)),
    liquido: round2(money(liquidoCents)),
    pedidosSemCidade: semCidade,
    porFrete: [...frete.values()]
      .map((row) => ({ ...row, receita: round2(row.receita), custoFrete: round2(row.custoFrete) }))
      .sort((a, b) => b.receita - a.receita),
    porEstado: [...estados.values()]
      .map((row) => ({
        estado: row.estado,
        pedidos: row.pedidos,
        receita: round2(row.receita),
        cidades: [...row.cidades.values()]
          .map((city) => ({ ...city, receita: round2(city.receita) }))
          .sort((a, b) => b.receita - a.receita)
          .slice(0, 5),
      }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 8),
    produtos: [...produtos.values()]
      .map((row) => ({ nome: row.nome, unidades: row.unidades, pedidos: row.pedidos.size, receita: round2(row.receita) }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 8),
    pedidosRecentes: recentes,
  };
}

// ── catálogo ──

export const READ_TOOLS: AtrakoTool[] = [
  {
    name: "visao_geral_negocio",
    step: "Montando a visão geral",
    description:
      "Panorama do negócio no período: vendas, leads, mídia, carrinhos, agendamentos e conversas. Só use quando a pessoa pedir como está o negócio, um resumo ou um período. Não use em saudação nem em pergunta sobre um registro (carrinho, lead, pessoa).",
    parameters: periodSchema(),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const id = rt.ctx.clienteId;
      const [cur, prev, leads, prevLeads, carts, recovery, bookings, conversas] = await Promise.all([
        salesSnapshot(id, range(p)),
        salesSnapshot(id, prevRange(p)),
        prisma.nativeLead.count({ where: { clienteId: id, createdAt: range(p) } }),
        prisma.nativeLead.count({ where: { clienteId: id, createdAt: prevRange(p) } }),
        getAbandonedCartSummary(id).catch(() => null),
        getCartRecoveryMetrics(id, range(p)).catch(() => null),
        prisma.agendaBooking.count({ where: { clienteId: id, startAt: range(p) } }),
        prisma.waConversation.count({ where: { clienteId: id, createdAt: range(p) } }),
      ]);
      return {
        data: {
          vendas: {
            receita: cur.receita,
            pedidos: cur.pedidos,
            ticketMedio: cur.ticketMedio,
            variacaoReceitaPct: delta(cur.receita, prev.receita),
            receitaPeriodoAnterior: prev.receita,
          },
          midia: {
            investimento: cur.investimentoMidia,
            porCanal: cur.midia,
            variacaoInvestimentoPct: delta(cur.investimentoMidia, prev.investimentoMidia),
            nota: "ROAS é o de cada canal (valor reportado pela plataforma ÷ investimento). Receita da loja inclui orgânico e não é ROAS.",
          },
          leadsNovos: { atual: leads, anterior: prevLeads, variacaoPct: delta(leads, prevLeads) },
          carrinhosNoPeriodo: recovery?.abandoned
            ? { quantidade: recovery.abandoned.count, valor: money(recovery.abandoned.cents), recuperados: recovery.recovered.count }
            : { quantidade: 0, valor: 0, recuperados: 0 },
          estoqueAberto: carts
            ? {
                quantidade: carts.openCount,
                valor: money(carts.openValueCents),
                nota: "Saldo atual do funil, de qualquer data. Não é o período perguntado.",
              }
            : null,
          agendamentos: bookings,
          conversasWhatsApp: conversas,
          fontesComDados: Object.entries(rt.ctx.coverage).filter(([, v]) => v).map(([k]) => k),
        },
        coverage: "available",
        source: { tool: "visao_geral_negocio", label: "Visão geral do negócio", period: periodSource(p) },
      };
    },
  },
  {
    name: "midia_visao_geral",
    step: "Consultando a mídia paga",
    description:
      "Investimento, impressões, cliques, CTR, CPC e resultados de Meta Ads e Google Ads, com comparação ao período anterior. Meta (compras/receita atribuída) e Google (conversões/valor) nunca são somados.",
    parameters: periodSchema({
      canal: nullableString("Plataforma: geral (ambas), meta ou google.", ["geral", "meta", "google"]),
      granularidade: nullableString("period = total; month = mês a mês; day = últimos 14 dias.", ["period", "month", "day"]),
    }),
    risk: "READ",
    run: (args, rt) =>
      analyst("midia_visao_geral", "Visão geral de mídia", "get_media_overview", args, rt, ["metaAds", "googleAds"], {
        channel: args.canal ?? "geral",
        granularity: args.granularidade ?? "period",
      }),
  },
  {
    name: "campanhas_desempenho",
    step: "Analisando campanhas",
    description:
      "Ranking de campanhas de uma plataforma (META ou GOOGLE) por métrica, melhores ou piores, com comparação ao período anterior.",
    parameters: periodSchema({
      plataforma: { type: "string", enum: ["META", "GOOGLE"], description: "Plataforma de anúncios." },
      metrica: nullableString("Métrica do ranking (null = valor/resultado principal).", ["VALUE", "ROAS", "CPA", "CPC", "CPL", "LEADS", "COST", "RESULTS"]),
      direcao: nullableString("BEST = melhores; WORST = piores.", ["BEST", "WORST"]),
      limite: nullableInt("Quantas campanhas (1-20)."),
    }),
    risk: "READ",
    run: (args, rt) =>
      analyst(
        "campanhas_desempenho",
        "Desempenho de campanhas",
        "get_campaign_performance",
        args,
        rt,
        args.plataforma === "GOOGLE" ? ["googleAds"] : ["metaAds"],
        {
          platform: args.plataforma === "GOOGLE" ? "GOOGLE" : "META",
          metric: args.metrica ?? undefined,
          direction: args.direcao ?? "BEST",
          limit: Math.min(20, Math.max(1, Number(args.limite) || 5)),
        },
      ),
  },
  {
    name: "criativos_desempenho",
    step: "Avaliando criativos",
    description: "Ranking de criativos/anúncios da Meta por métrica (melhores ou piores) no período.",
    parameters: periodSchema({
      metrica: nullableString("Métrica do ranking.", ["VALUE", "ROAS", "CPA", "CPC", "CPL", "LEADS", "COST", "RESULTS"]),
      direcao: nullableString("BEST ou WORST.", ["BEST", "WORST"]),
      limite: nullableInt("Quantos criativos (1-10)."),
    }),
    risk: "READ",
    run: (args, rt) =>
      analyst("criativos_desempenho", "Desempenho de criativos", "get_creative_performance", args, rt, ["metaAds"], {
        metric: args.metrica ?? undefined,
        direction: args.direcao ?? "BEST",
        limit: Math.min(10, Math.max(1, Number(args.limite) || 5)),
      }),
  },
  {
    name: "site_analytics",
    step: "Olhando o tráfego do site",
    description: "Google Analytics: sessões, usuários, engajamento e canais de tráfego do site, com comparação.",
    parameters: periodSchema(),
    risk: "READ",
    run: (args, rt) => analyst("site_analytics", "Google Analytics", "get_analytics_overview", args, rt, ["analytics"]),
  },
  {
    name: "funil_crm_externo",
    step: "Olhando o funil do CRM externo",
    description: "Funil agregado do CRM externo integrado (RD Station, Kommo etc.): entradas por etapa, ganhos, valor.",
    parameters: periodSchema(),
    risk: "READ",
    run: (args, rt) => analyst("funil_crm_externo", "CRM externo", "get_crm_funnel", args, rt, ["crmExternal"]),
  },
  {
    name: "metas_e_orcamento",
    step: "Conferindo metas e orçamento",
    description: "Metas cadastradas, orçamento mensal de mídia, saldo das contas de anúncio e contexto comercial do negócio.",
    parameters: periodSchema(),
    risk: "READ",
    run: (args, rt) => analyst("metas_e_orcamento", "Metas e orçamento", "get_business_context", args, rt, []),
  },
  {
    name: "crm_pipeline",
    step: "Olhando o funil de leads",
    description:
      "Funil do CRM do Atrako: leads e valor por etapa, origens/canais de aquisição e os leads mais quentes de cada etapa (nome e valor; sem contato).",
    parameters: periodSchema({
      busca: nullableString("Filtra por nome/e-mail/telefone de lead (opcional)."),
      apenas_carrinho_aberto: { type: ["boolean", "null"], description: "Só leads com carrinho aberto." },
    }),
    risk: "READ",
    module: "crm",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const explicit = args.periodo != null || args.inicio != null;
      const board = await getPipelineBoard(rt.ctx.clienteId, {
        q: typeof args.busca === "string" ? revealToken(args.busca, rt.vault) : undefined,
        openCart: args.apenas_carrinho_aberto === true,
        ...(explicit ? { from: p.startLabel, to: p.endLabel } : {}),
      });
      return {
        data: {
          filtroPeriodo: explicit ? `${p.startLabel} a ${p.endLabel} (entrada no funil)` : "todo o funil",
          totalLeads: board.totalCount,
          valorTotal: round2(board.totalValue),
          etapas: board.stages.map((s) => ({
            etapa: s.name,
            papel: s.role,
            leads: s.totalCount,
            valor: round2(s.totalValue),
            maisQuentes: s.leads.slice(0, 3).map((l) => ({
              nome: l.name,
              valor: l.dealValue,
              canal: l.channelLabel,
              carrinhoAberto: l.openCartCents != null ? money(l.openCartCents) : null,
            })),
          })),
          canais: board.channels.slice(0, 10),
          origens: board.sources.slice(0, 10),
        },
        coverage: coverageFor(rt, ["crmNative"], board.totalCount > 0),
        source: { tool: "crm_pipeline", label: "CRM do Atrako", period: explicit ? periodSource(p) : undefined },
      };
    },
  },
  {
    name: "leads_lista",
    step: "Abrindo os leads",
    description:
      "Leads individuais do CRM do Atrako (os mais recentes, os de maior valor, os parados há mais tempo, de uma etapa ou origem): nome, etapa, origem, valor e última movimentação. Os primeiros aparecem na conversa como cartão do cliente.",
    parameters: periodSchema({
      etapa: nullableString("Nome (ou parte) da etapa do funil, ex.: 'Proposta'."),
      origem: nullableString("Origem do lead, ex.: 'whatsapp', 'form', 'shopify'."),
      ordem: { type: ["string", "null"], enum: ["recentes", "maior_valor", "parados", null], description: "Padrão: recentes." },
      limite: { type: ["integer", "null"], description: "1 a 10 (padrão 5)." },
    }),
    risk: "READ",
    module: "crm",
    async run(args, rt) {
      const explicit = args.periodo != null || args.inicio != null;
      const p = periodOf(args, rt);
      const { rows, data } = await listLeads(rt.ctx.clienteId, {
        stage: typeof args.etapa === "string" && args.etapa.trim() ? args.etapa.trim().slice(0, 60) : null,
        source: typeof args.origem === "string" && args.origem.trim() ? args.origem.trim().slice(0, 40) : null,
        from: explicit ? p.start : null,
        to: explicit ? p.end : null,
        order: args.ordem === "maior_valor" || args.ordem === "parados" ? args.ordem : "recentes",
        limit: Number(args.limite) > 0 ? Number(args.limite) : 5,
      });
      const cards = await Promise.all(
        rows.slice(0, MAX_CARDS).map((l) => contactCard(rt.ctx.clienteId, { contactId: l.contactId, leadId: l.id })),
      );
      return {
        data: {
          leads: data,
          total: data.length,
          filtroPeriodo: explicit ? `${p.startLabel} a ${p.endLabel} (entrada)` : "todo o funil",
          ...(rows.length ? { como_responder: CARD_GUIDANCE } : {}),
        },
        coverage: coverageFor(rt, ["crmNative"], rows.length > 0),
        source: { tool: "leads_lista", label: "CRM do Atrako", period: explicit ? periodSource(p) : undefined },
        artifacts: cards.filter((c): c is ContactCardArtifact => Boolean(c)),
      };
    },
  },
  {
    name: "vendas_visao_geral",
    step: "Somando as vendas",
    description:
      "Vendas consolidadas de lojas (Shopify, Nuvemshop, Tray, Woo), marketplaces (Mercado Livre, Shopee, TikTok Shop) e checkout Atrako: receita, pedidos, ticket médio, por loja e por origem de tráfego, investimento em mídia e ROAS geral. Não traz frete, estado nem líquido do marketplace — para isso use marketplaces_visao.",
    parameters: periodSchema(),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const [cur, prev] = await Promise.all([salesSnapshot(rt.ctx.clienteId, range(p)), salesSnapshot(rt.ctx.clienteId, prevRange(p))]);
      return {
        data: {
          atual: cur,
          anterior: { receita: prev.receita, pedidos: prev.pedidos, ticketMedio: prev.ticketMedio, investimentoMidia: prev.investimentoMidia },
          variacao: {
            receitaPct: delta(cur.receita, prev.receita),
            pedidosPct: delta(cur.pedidos, prev.pedidos),
          },
        },
        coverage: coverageFor(rt, ["commerce", "marketplace"], cur.pedidos > 0 || prev.pedidos > 0),
        source: {
          tool: "vendas_visao_geral",
          label: "Vendas consolidadas",
          period: periodSource(p),
          note: "Receita = pedidos pagos (cancelados fora). Compras reportadas pela Meta são referência, não somam à receita das lojas.",
        },
      };
    },
  },
  {
    name: "marketplaces_visao",
    step: "Lendo os marketplaces",
    description:
      "Aba Marketplaces do Dashboard: Mercado Livre, Shopee ou TikTok Shop. Receita, taxas, frete do vendedor, líquido, modos de envio (Full, Flex, Mercado Envios), estados e cidades, produtos mais vendidos e os pedidos recentes. Não inclui a loja própria (Woo, Shopify, Tray, Nuvemshop). Cidade ausente significa que o marketplace não liberou o endereço.",
    parameters: periodSchema({
      canal: nullableString("Marketplace: mercadolivre, shopee, tiktok ou null para todos.", ["mercadolivre", "shopee", "tiktok"]),
    }),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const providers = marketplaceProviders(args.canal);
      const data = await marketplaceSnapshot(rt.ctx.clienteId, range(p), providers);
      const canal = providers.length === 1 ? (PROVIDER_LABELS[providers[0]] ?? providers[0]) : "Marketplaces";
      return {
        data: { canal, ...data },
        coverage: coverageFor(rt, ["marketplace"], data.pedidos > 0),
        source: {
          tool: "marketplaces_visao",
          label: canal,
          period: periodSource(p),
          note: "Líquido = receita − taxas − frete do vendedor. Full, Flex e Mercado Envios são o envio, não anúncio. pedidosSemCidade não têm endereço liberado.",
        },
      };
    },
  },
  {
    name: "clientes_recompra",
    step: "Analisando recompra",
    description:
      "Base de clientes: novos vs recorrentes no período, participação da recompra na receita, intervalo médio entre compras e ciclo de vida da base (ativos, em risco, perdidos…). Para gênero, horário, cidade, produtos e quem mais compra, use comportamento_compra.",
    parameters: periodSchema(),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const [metrics, lifecycle] = await Promise.all([
        getRepurchaseMetrics(rt.ctx.clienteId, range(p)).catch(() => null),
        prisma.customerProfile.groupBy({ by: ["lifecycle"], where: { clienteId: rt.ctx.clienteId }, _count: { _all: true } }),
      ]);
      return {
        data: {
          recompra: metrics
            ? {
                pedidosPagos: metrics.paid.count,
                receita: money(metrics.paid.cents),
                primeirosPedidos: { quantidade: metrics.firstOrders.count, receita: money(metrics.firstOrders.cents) },
                pedidosDeRecompra: { quantidade: metrics.repeatOrders.count, receita: money(metrics.repeatOrders.cents) },
                participacaoRecompraPct: metrics.repeatShare == null ? null : round2(metrics.repeatShare * 100),
                compradores: metrics.buyers,
                novos: metrics.newBuyers,
                recorrentes: metrics.returningBuyers,
                intervaloMedioDias: metrics.avgGapDays,
                pedidosSemIdentificacao: metrics.unidentified.count,
              }
            : null,
          cicloDeVida: lifecycle.map((l) => ({ estagio: l.lifecycle, clientes: l._count._all })),
        },
        coverage: coverageFor(rt, ["marketplace", "commerce"], Boolean(metrics?.paid.count) || lifecycle.length > 0),
        source: { tool: "clientes_recompra", label: "Clientes e recompra", period: periodSource(p) },
      };
    },
  },
  {
    name: "comportamento_compra",
    step: "Lendo o comportamento de compra",
    description:
      "Quem compra neste período: receita nova e de recompra, ticket do pedido e ticket por cliente, LTV, gênero estimado pelo nome, origem, produtos, o que compram depois, maiores compradores, estado e cidade, e os horários com mais pedidos. Use em pergunta sobre clientes, recompra, gênero, horário, lugar ou produto. Não use em saudação.",
    parameters: periodSchema(),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const view = await getComportamento(rt.ctx.clienteId, {
        start: p.start,
        end: p.end,
        previousStart: p.previousStart,
        previousEnd: p.previousEnd,
      });
      const data = comportamentoParaAgente(view);
      return {
        data,
        coverage: coverageFor(rt, ["marketplace", "commerce"], data.recompra.pedidosNovos + data.recompra.pedidosRecompra + data.recompra.pedidosSemComprador > 0),
        source: {
          tool: "comportamento_compra",
          label: "Comportamento de compra",
          period: periodSource(p),
          note: "Gênero é estimativa pelo primeiro nome. Pedido sem comprador identificado não entra em receita nova nem em recompra. Ticket do pedido divide pela quantidade de pedidos; ticket por cliente, pelos compradores identificados.",
        },
      };
    },
  },
  {
    name: "carrinhos_abandonados",
    step: "Checando carrinhos abandonados",
    description:
      "Carrinhos do período pedido (abandonados e recuperados naquelas datas) e, separado, o saldo aberto agora. Pergunta com período usa só `periodo`. `estoqueAberto` ignora a data. Para um carrinho específico use carrinhos_lista.",
    parameters: periodSchema(),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const [summary, recovery] = await Promise.all([
        getAbandonedCartSummary(rt.ctx.clienteId).catch(() => null),
        getCartRecoveryMetrics(rt.ctx.clienteId, range(p)).catch(() => null),
      ]);
      return {
        data: {
          como_responder: "Pergunta de período: cite só `periodo`. `estoqueAberto` é o funil inteiro, com carrinhos de meses anteriores.",
          periodo: recovery
            ? {
                abandonados: recovery.abandoned ? { quantidade: recovery.abandoned.count, valor: money(recovery.abandoned.cents) } : null,
                recuperados: { quantidade: recovery.recovered.count, valor: money(recovery.recovered.cents) },
                taxaCoortePct: recovery.cohortRate == null ? null : round2(recovery.cohortRate * 100),
                porMensagem: { quantidade: recovery.byMessage.count, valor: money(recovery.byMessage.cents) },
                semMensagem: { quantidade: recovery.alone.count, valor: money(recovery.alone.cents) },
                deClientesAntigos: recovery.fromCustomers.count,
                deNovosClientes: recovery.fromNew.count,
                porIdade: recovery.byAge.map((b) => ({ faixa: b.label, quantidade: b.count, valor: money(b.cents) })),
              }
            : null,
          estoqueAberto: summary
            ? {
                quantidade: summary.openCount,
                valor: money(summary.openValueCents),
                nota: "Saldo aberto agora, fora do período.",
              }
            : null,
        },
        coverage: coverageFor(rt, ["abandonedCarts"], Boolean(summary || recovery)),
        source: { tool: "carrinhos_abandonados", label: "Carrinhos abandonados", period: periodSource(p) },
      };
    },
  },
  {
    name: "carrinhos_lista",
    step: "Abrindo os carrinhos",
    description:
      "Carrinhos abandonados individuais (o último, os maiores, os recuperados): cliente, loja, itens, valor, quando abandonou e se recebeu mensagem de recuperação. Os primeiros aparecem na conversa como cartão do cliente (mesmo card do CRM).",
    parameters: objectSchema({
      status: { type: ["string", "null"], enum: ["abertos", "recuperados", "todos", null], description: "Padrão: abertos." },
      ordem: { type: ["string", "null"], enum: ["recentes", "maior_valor", null], description: "Padrão: recentes." },
      limite: { type: ["integer", "null"], description: "1 a 10 (padrão 5). 'O último' = 1." },
    }),
    risk: "READ",
    async run(args, rt) {
      const status = args.status === "recuperados" || args.status === "todos" ? args.status : "abertos";
      const limit = Number(args.limite) > 0 ? Number(args.limite) : 5;
      const { rows, data } = await listCarts(rt.ctx.clienteId, {
        status,
        limit,
        order: args.ordem === "maior_valor" ? "maior_valor" : "recentes",
      });
      const cards = await Promise.all(rows.slice(0, MAX_CARDS).map((cart) => contactCard(rt.ctx.clienteId, { cart })));
      return {
        data: { carrinhos: data, total: data.length, ...(rows.length ? { como_responder: CARD_GUIDANCE } : {}) },
        coverage: coverageFor(rt, ["abandonedCarts"], rows.length > 0),
        source: { tool: "carrinhos_lista", label: "Carrinhos abandonados" },
        artifacts: cards.filter((c): c is ContactCardArtifact => Boolean(c)),
      };
    },
  },
  {
    name: "relacionamento_desempenho",
    step: "Avaliando e-mail e WhatsApp",
    description:
      "Relacionamento (e-mail e WhatsApp): enviados, entregues, aberturas, cliques, receita atribuída/influenciada, ranking de fluxos automáticos e campanhas programadas.",
    parameters: periodSchema(),
    risk: "READ",
    module: "relacionamento",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const ws = rt.ctx.clienteId;
      const base = { clienteId: ws, isTest: false, createdAt: range(p) };
      const [byChannel, conv, prevConv, flows, flowRank, campaigns] = await Promise.all([
        prisma.messageDelivery.groupBy({
          by: ["channel"],
          where: base,
          _count: { _all: true, sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, bouncedAt: true, failedAt: true },
          _sum: { costMicros: true },
        }),
        prisma.messageDelivery.groupBy({
          by: ["conversionKind"],
          where: { clienteId: ws, isTest: false, convertedAt: range(p) },
          _count: { _all: true },
          _sum: { convertedCents: true },
        }),
        prisma.messageDelivery.aggregate({
          where: { clienteId: ws, isTest: false, convertedAt: prevRange(p), conversionKind: "ATTRIBUTED" },
          _sum: { convertedCents: true },
        }),
        prisma.messageFlow.findMany({ where: { clienteId: ws }, select: { id: true, name: true, status: true, trigger: true } }),
        prisma.messageDelivery.groupBy({
          by: ["flowId"],
          where: { ...base, flowId: { not: null } },
          _count: { _all: true, openedAt: true, clickedAt: true, convertedAt: true },
          _sum: { convertedCents: true },
        }),
        prisma.messageCampaign.findMany({
          where: { clienteId: ws, status: { notIn: ["ENVIADA", "PERDIDA"] } },
          select: { name: true, status: true, channel: true, eventDate: true, scheduledAt: true },
          orderBy: { eventDate: "asc" },
          take: 10,
        }),
      ]);
      const flowName = new Map(flows.map((f) => [f.id, f]));
      const attributed = conv.find((c) => c.conversionKind === "ATTRIBUTED");
      const influenced = conv.find((c) => c.conversionKind === "INFLUENCED");
      const sentTotal = byChannel.reduce((s, c) => s + c._count.sentAt, 0);
      return {
        data: {
          canais: byChannel.map((c) => ({
            canal: c.channel,
            enviados: c._count.sentAt,
            entregues: c._count.deliveredAt,
            abertos: c._count.openedAt,
            cliques: c._count.clickedAt,
            taxaAberturaPct: pct(c._count.openedAt, c._count.deliveredAt || c._count.sentAt),
            taxaCliquePct: pct(c._count.clickedAt, c._count.deliveredAt || c._count.sentAt),
            falhas: c._count.failedAt + c._count.bouncedAt,
            custo: round2((c._sum.costMicros ?? 0) / 1_000_000),
          })),
          receitaAtribuida: money(attributed?._sum.convertedCents),
          pedidosAtribuidos: attributed?._count._all ?? 0,
          receitaInfluenciada: money(influenced?._sum.convertedCents),
          variacaoReceitaAtribuidaPct: delta(money(attributed?._sum.convertedCents), money(prevConv._sum.convertedCents)),
          fluxos: {
            ativos: flows.filter((f) => f.status === "ACTIVE").length,
            total: flows.length,
            ranking: flowRank
              .map((f) => ({
                fluxo: flowName.get(f.flowId ?? "")?.name ?? "Fluxo",
                status: flowName.get(f.flowId ?? "")?.status ?? null,
                enviados: f._count._all,
                cliques: f._count.clickedAt,
                conversoes: f._count.convertedAt,
                receita: money(f._sum.convertedCents),
              }))
              .sort((a, b) => b.receita - a.receita)
              .slice(0, 8),
          },
          campanhasEmAndamento: campaigns.map((c) => ({
            nome: c.name,
            status: c.status,
            canal: c.channel,
            data: (c.scheduledAt ?? c.eventDate)?.toISOString().slice(0, 10) ?? null,
          })),
        },
        coverage: coverageFor(rt, ["messaging", "whatsapp"], sentTotal > 0 || flows.length > 0),
        source: { tool: "relacionamento_desempenho", label: "Relacionamento", period: periodSource(p) },
      };
    },
  },
  {
    name: "financeiro_resumo",
    step: "Fechando o financeiro",
    description: "Financeiro do workspace: entradas, saídas, reembolsos e resultado líquido no período, com comparação.",
    parameters: periodSchema(),
    risk: "READ",
    module: "finance",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const [cur, prev] = await Promise.all([
        summarizeLedger(rt.ctx.clienteId, p.start, p.end),
        summarizeLedger(rt.ctx.clienteId, p.previousStart, p.previousEnd),
      ]);
      return {
        data: {
          atual: { entradas: round2(cur.income), saidas: round2(cur.expense), reembolsos: round2(cur.refund), liquido: round2(cur.net), lancamentos: cur.count },
          anterior: { entradas: round2(prev.income), saidas: round2(prev.expense), liquido: round2(prev.net) },
          variacaoLiquidoPct: delta(cur.net, prev.net),
        },
        coverage: coverageFor(rt, ["finance"], cur.count > 0 || prev.count > 0),
        source: { tool: "financeiro_resumo", label: "Financeiro", period: periodSource(p), note: "Só lançamentos confirmados entram nos totais." },
      };
    },
  },
  {
    name: "agenda_resumo",
    step: "Olhando a agenda",
    description: "Agenda: agendamentos por status, receita agendada, serviços mais procurados e próximos compromissos (quantidade).",
    parameters: periodSchema(),
    risk: "READ",
    module: "agenda",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const ws = rt.ctx.clienteId;
      const [byStatus, byService, upcoming] = await Promise.all([
        prisma.agendaBooking.groupBy({ by: ["status"], where: { clienteId: ws, startAt: range(p) }, _count: { _all: true }, _sum: { amountCents: true } }),
        prisma.agendaBooking.groupBy({
          by: ["serviceId"],
          where: { clienteId: ws, startAt: range(p) },
          _count: { _all: true },
          orderBy: { _count: { serviceId: "desc" } },
          take: 5,
        }),
        prisma.agendaBooking.count({ where: { clienteId: ws, startAt: { gte: new Date() }, cancelledAt: null } }),
      ]);
      const services = byService.length
        ? await prisma.agendaService.findMany({ where: { id: { in: byService.map((s) => s.serviceId) }, clienteId: ws }, select: { id: true, title: true } })
        : [];
      const title = new Map(services.map((s) => [s.id, s.title]));
      const total = byStatus.reduce((s, r) => s + r._count._all, 0);
      return {
        data: {
          total,
          porStatus: byStatus.map((s) => ({ status: s.status, quantidade: s._count._all, valor: money(s._sum.amountCents) })),
          servicosMaisAgendados: byService.map((s) => ({ servico: title.get(s.serviceId) ?? "Serviço", quantidade: s._count._all })),
          proximosAgendamentos: upcoming,
        },
        coverage: coverageFor(rt, ["agenda"], total > 0 || upcoming > 0),
        source: { tool: "agenda_resumo", label: "Agenda", period: periodSource(p) },
      };
    },
  },
  {
    name: "whatsapp_atendimento",
    step: "Checando o WhatsApp",
    description: "Atendimento no WhatsApp: conversas novas no período, por status, janelas de 24h abertas e conversas transferidas para humano.",
    parameters: periodSchema(),
    risk: "READ",
    module: "whatsapp",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const ws = rt.ctx.clienteId;
      const [novas, byStatus, janelasAbertas, transferidas] = await Promise.all([
        prisma.waConversation.count({ where: { clienteId: ws, createdAt: range(p) } }),
        prisma.waConversation.groupBy({ by: ["status"], where: { clienteId: ws, lastMessageAt: range(p) }, _count: { _all: true } }),
        prisma.waConversation.count({ where: { clienteId: ws, windowExpiresAt: { gt: new Date() } } }),
        prisma.waConversation.count({ where: { clienteId: ws, handedOffAt: range(p) } }),
      ]);
      return {
        data: {
          conversasNovas: novas,
          ativasPorStatus: byStatus.map((s) => ({ status: s.status, conversas: s._count._all })),
          janelas24hAbertas: janelasAbertas,
          transferidasParaHumano: transferidas,
        },
        coverage: coverageFor(rt, ["whatsapp"], novas > 0 || byStatus.length > 0),
        source: { tool: "whatsapp_atendimento", label: "WhatsApp", period: periodSource(p) },
      };
    },
  },
  {
    name: "instagram_resumo",
    step: "Olhando o Instagram",
    description: "Instagram: alcance, impressões, engajamento, novos seguidores e total de seguidores, com comparação.",
    parameters: periodSchema(),
    risk: "READ",
    async run(args, rt) {
      const p = periodOf(args, rt);
      const ws = rt.ctx.clienteId;
      const sum = { alcance: true, impressoes: true, engajamento: true, novosSeguidores: true } as const;
      const [cur, prev, last] = await Promise.all([
        prisma.instagramInsightDiario.aggregate({ where: { clienteId: ws, data: range(p) }, _sum: sum, _count: { _all: true } }),
        prisma.instagramInsightDiario.aggregate({ where: { clienteId: ws, data: prevRange(p) }, _sum: sum }),
        prisma.instagramInsightDiario.findFirst({ where: { clienteId: ws, data: { lte: p.end } }, orderBy: { data: "desc" }, select: { followersTotal: true, data: true } }),
      ]);
      const c = cur._sum;
      const pv = prev._sum;
      return {
        data: {
          alcance: c.alcance ?? 0,
          impressoes: c.impressoes ?? 0,
          engajamento: c.engajamento ?? 0,
          novosSeguidores: c.novosSeguidores ?? 0,
          seguidoresTotal: last?.followersTotal ?? null,
          variacao: {
            alcancePct: delta(c.alcance ?? 0, pv.alcance ?? 0),
            engajamentoPct: delta(c.engajamento ?? 0, pv.engajamento ?? 0),
            novosSeguidoresPct: delta(c.novosSeguidores ?? 0, pv.novosSeguidores ?? 0),
          },
        },
        coverage: coverageFor(rt, ["instagram"], cur._count._all > 0),
        source: { tool: "instagram_resumo", label: "Instagram", period: periodSource(p) },
      };
    },
  },
  {
    name: "buscar_pessoa",
    step: "Procurando a pessoa",
    description:
      "Encontra um contato/cliente pelo nome, e-mail ou telefone (aceita tokens [contato#N]). Retorna até 5 resultados com contactId para usar em jornada_pessoa. Contatos vêm mascarados.",
    parameters: objectSchema({
      busca: { type: "string", description: "Nome, e-mail, telefone ou token [contato#N]." },
    }),
    risk: "READ",
    async run(args, rt) {
      const raw = revealToken(String(args.busca ?? ""), rt.vault).trim();
      if (raw.length < 2) {
        return { data: [], coverage: "empty", source: { tool: "buscar_pessoa", label: "Busca de pessoa", note: "Busca muito curta." } };
      }
      const digits = raw.replace(/\D/g, "");
      const rows = await prisma.nativeContact.findMany({
        where: {
          clienteId: rt.ctx.clienteId,
          OR: [
            { name: { contains: raw, mode: "insensitive" } },
            { email: { contains: raw, mode: "insensitive" } },
            ...(digits.length >= 8 ? [{ phone: { contains: digits.slice(-8) } }] : []),
          ],
        },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      return {
        data: rows.map((r) => ({
          contactId: r.id,
          nome: r.name,
          email: maskEmail(r.email),
          telefone: maskPhone(r.phone),
          desde: r.createdAt.toISOString().slice(0, 10),
        })),
        coverage: coverageFor(rt, ["contacts"], rows.length > 0),
        source: { tool: "buscar_pessoa", label: "Busca de pessoa" },
      };
    },
  },
  {
    name: "jornada_pessoa",
    step: "Montando a jornada",
    description:
      "Linha do tempo de um contato: leads, conversas, pedidos, agendamentos, mensagens recebidas e carrinhos. Use o contactId de buscar_pessoa.",
    parameters: objectSchema({
      contactId: { type: "string", description: "contactId retornado por buscar_pessoa." },
    }),
    risk: "READ",
    async run(args, rt) {
      const contactId = String(args.contactId ?? "").trim();
      try {
        const [j, card] = await Promise.all([
          getPersonJourney(rt.ctx.clienteId, contactId),
          contactCard(rt.ctx.clienteId, { contactId }).catch(() => null),
        ]);
        return {
          ...(card ? { artifacts: [card] } : {}),
          data: {
            contato: {
              nome: j.contact.name,
              email: maskEmail(j.contact.email),
              telefone: maskPhone(j.contact.phone),
              desde: j.contact.createdAt.toISOString().slice(0, 10),
            },
            eventos: j.items.slice(-40).map((i) => ({ quando: i.at, tipo: i.type, titulo: i.title, detalhe: i.detail?.slice(0, 200) })),
            totalEventos: j.items.length,
          },
          coverage: j.items.length ? "available" : "empty",
          source: { tool: "jornada_pessoa", label: "Jornada da pessoa" },
        };
      } catch {
        return { data: null, coverage: "empty", source: { tool: "jornada_pessoa", label: "Jornada da pessoa", note: "Contato não encontrado neste workspace." } };
      }
    },
  },
  {
    name: "paginas_e_formularios",
    step: "Listando páginas e formulários",
    description: "O que o negócio já publicou: páginas de venda/produtos e formulários de captura, com status e link.",
    parameters: objectSchema({}),
    risk: "READ",
    async run(_args, rt) {
      const ws = rt.ctx.clienteId;
      const [products, forms] = await Promise.all([
        prisma.commerceProduct.findMany({
          where: { clienteId: ws },
          select: { name: true, slug: true, status: true, type: true, priceCents: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
        prisma.captureForm.findMany({
          where: { clienteId: ws },
          select: { name: true, slug: true, status: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        }),
      ]);
      return {
        data: {
          paginas: products.map((p) => ({ nome: p.name, slug: p.slug, status: p.status, tipo: p.type, preco: money(p.priceCents), atualizado: p.updatedAt.toISOString().slice(0, 10) })),
          formularios: forms.map((f) => ({ nome: f.name, slug: f.slug, status: f.status, atualizado: f.updatedAt.toISOString().slice(0, 10) })),
        },
        coverage: products.length || forms.length ? "available" : "empty",
        source: { tool: "paginas_e_formularios", label: "Páginas e formulários" },
      };
    },
  },
];

/** Ferramentas disponíveis para o workspace (respeita módulos desligados). */
export function toolsForWorkspace(ctx: AtrakoWorkspaceContext, extra: AtrakoTool[] = []): AtrakoTool[] {
  const enabled = new Set(ctx.modules);
  const gate = (t: AtrakoTool) => !t.module || enabled.size === 0 || enabled.has(t.module);
  return [...READ_TOOLS, ...extra].filter(gate);
}

function acceptsNull(schema: unknown): boolean {
  const s = schema as { type?: unknown; enum?: unknown } | null;
  return (Array.isArray(s?.type) && s.type.includes("null")) || (Array.isArray(s?.enum) && s.enum.includes(null));
}

/**
 * Fora do strict da OpenAI, campos nullable viram opcionais: provedores que validam o
 * schema no servidor (Groq) recusam chamadas que omitem um campo "required".
 */
export function relaxSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const props = schema.properties as Record<string, unknown> | undefined;
  if (!props || typeof props !== "object") return schema;
  const properties = Object.fromEntries(
    Object.entries(props).map(([k, v]) => [
      k,
      v && typeof v === "object" && (v as { properties?: unknown }).properties
        ? relaxSchema(v as Record<string, unknown>)
        : v,
    ]),
  );
  const required = Array.isArray(schema.required)
    ? (schema.required as string[]).filter((k) => !acceptsNull(props[k]))
    : schema.required;
  return { ...schema, properties, ...(required !== undefined ? { required } : {}) };
}

export function toOpenAITools(tools: AtrakoTool[], strict: boolean) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: strict ? t.parameters : relaxSchema(t.parameters as Record<string, unknown>),
      ...(strict ? { strict: true } : {}),
    },
  }));
}

/** Modelos abertos às vezes mandam "None", "null" ou "" no lugar de null. */
export function sanitizeToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) =>
      typeof v === "string" && /^(none|null|undefined)?$/i.test(v.trim()) ? [k, null] : [k, v],
    ),
  );
}

export async function runTool(
  tool: AtrakoTool,
  rawArgs: string | Record<string, unknown> | null | undefined,
  rt: ToolRuntime,
): Promise<ToolResult> {
  let args: Record<string, unknown> = {};
  if (typeof rawArgs === "string") {
    try {
      const parsed = JSON.parse(rawArgs || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      args = {};
    }
  } else if (rawArgs && typeof rawArgs === "object") {
    args = rawArgs;
  }
  args = sanitizeToolArgs(args);
  // Nunca aceitar escopo de tenant vindo do modelo.
  delete args.clienteId;
  delete args.workspaceId;
  const result = await tool.run(args, rt);
  if (tool.risk === "READ" && result.coverage === "available") {
    const charts = chartsFor(tool.name, result.data);
    if (charts.length) result.artifacts = [...charts, ...(result.artifacts ?? [])];
  }
  return result;
}
