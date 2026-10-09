import { prisma } from "@/lib/db";
import {
  resolveAccountAnalysisObjective,
  resolveCampaignObjective,
  type AnalystPeriodContext,
} from "@/lib/analyst/dataTools";
import { formatLocalDate, parseLocalDate, previousPeriod } from "@/lib/hotelAnalysis";
import type { ModulesMap } from "@/lib/modules/registry";

/**
 * Contexto do Atrako para um workspace: quem é o negócio, onde há dado e qual
 * período está em análise. `clienteId` vem sempre da sessão — nunca do modelo.
 */

export type AtrakoActor = {
  kind: "platform" | "member";
  /** Chave estável para separar conversas por pessoa no workspace. */
  key: string;
  name: string | null;
  role: string;
  canManage: boolean;
};

export type AtrakoCoverage = {
  metaAds: boolean;
  googleAds: boolean;
  analytics: boolean;
  crmExternal: boolean;
  crmNative: boolean;
  contacts: boolean;
  commerce: boolean;
  marketplace: boolean;
  abandonedCarts: boolean;
  agenda: boolean;
  whatsapp: boolean;
  messaging: boolean;
  finance: boolean;
  instagram: boolean;
  forms: boolean;
  pages: boolean;
};

export type AtrakoWorkspaceContext = {
  clienteId: string;
  nome: string;
  segmento: string | null;
  objetivoMidia: string;
  orcamentoMidiaGoogleMensal: number | null;
  orcamentoMidiaMetaMensal: number | null;
  timezone: string;
  currency: string;
  locale: string;
  /** Data de hoje no fuso do workspace (meia-noite local). */
  today: Date;
  commercial: NonNullable<AnalystPeriodContext["commercialContext"]>;
  coverage: AtrakoCoverage;
  /** Módulos ligados (chaves). */
  modules: string[];
  actor: AtrakoActor;
};

export const PERIOD_PRESETS = [
  "hoje",
  "ontem",
  "ultimos_7_dias",
  "ultimos_30_dias",
  "ultimos_90_dias",
  "mes_atual",
  "mes_anterior",
  "ano_atual",
  "personalizado",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const DEFAULT_PERIOD: PeriodPreset = "ultimos_30_dias";

export type AtrakoPeriod = {
  preset: PeriodPreset;
  start: Date;
  /** Fim inclusivo do último dia no fuso do workspace. */
  end: Date;
  endDay: Date;
  previousStart: Date;
  previousEnd: Date;
  startLabel: string;
  endLabel: string;
  previousStartLabel: string;
  previousEndLabel: string;
};

export function calendarDateIn(timezone: string, now = new Date()): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  }
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return new Date(Number(v.year), Number(v.month) - 1, Number(v.day));
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Deslocamento (local − UTC) do fuso naquele instante, em ms. */
function tzOffsetMs(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour) % 24,
    Number(v.minute),
    Number(v.second),
  );
  return asUtc - instant;
}

/** Meia-noite ou fim do dia civil de `date` no fuso do workspace, como instante UTC. */
function zonedBoundary(date: Date, timeZone: string, end: boolean): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const h = end ? 23 : 0;
  const min = end ? 59 : 0;
  const sec = end ? 59 : 0;
  const probe = Date.UTC(y, m, d, h, min, sec);
  let utc = probe;
  for (let i = 0; i < 2; i++) utc = probe - tzOffsetMs(timeZone, utc);
  return new Date(utc + (end ? 999 : 0));
}

/** Normaliza texto livre pt-BR ("últimos 7 dias", "mês passado") para um preset. */
export function periodPresetFromText(value: unknown): PeriodPreset | null {
  if (typeof value !== "string") return null;
  const t = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!t) return null;
  const direct = PERIOD_PRESETS.find((p) => p === t.replace(/ /g, "_"));
  if (direct) return direct;
  if (/\bhoje\b/.test(t)) return "hoje";
  if (/\bontem\b/.test(t)) return "ontem";
  if (/\b(mes|mês) (passado|anterior)\b|\bultimo mes\b/.test(t)) return "mes_anterior";
  if (/\b(este|esse|neste|nesse) mes\b|\bmes atual\b/.test(t)) return "mes_atual";
  if (/\b(este|esse|neste) ano\b|\bano atual\b/.test(t)) return "ano_atual";
  if (/\b7 dias\b|\bsemana\b/.test(t)) return "ultimos_7_dias";
  if (/\b90 dias\b|\btrimestre\b|\b3 meses\b/.test(t)) return "ultimos_90_dias";
  if (/\b30 dias\b/.test(t)) return "ultimos_30_dias";
  return null;
}

/**
 * Período de análise no fuso do workspace. Datas explícitas (YYYY-MM-DD) têm
 * prioridade; sem nada, usa os últimos 30 dias.
 */
export function resolvePeriod(
  input: { periodo?: unknown; inicio?: unknown; fim?: unknown } | null | undefined,
  today: Date,
  timeZone = "America/Sao_Paulo",
): AtrakoPeriod {
  const explicitStart = parseLocalDate(input?.inicio);
  const explicitEnd = parseLocalDate(input?.fim);
  let preset: PeriodPreset = periodPresetFromText(input?.periodo) ?? DEFAULT_PERIOD;
  let start: Date;
  let endDay: Date = today;

  if (explicitStart) {
    preset = "personalizado";
    start = explicitStart;
    endDay = explicitEnd && explicitEnd >= explicitStart ? explicitEnd : today;
    if (endDay > today) endDay = today;
    if (start > endDay) start = endDay;
  } else {
    switch (preset) {
      case "hoje":
        start = today;
        break;
      case "ontem":
        start = addDays(today, -1);
        endDay = start;
        break;
      case "ultimos_7_dias":
        start = addDays(today, -6);
        break;
      case "ultimos_90_dias":
        start = addDays(today, -89);
        break;
      case "mes_atual":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "mes_anterior":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDay = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "ano_atual":
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case "personalizado":
      case "ultimos_30_dias":
      default:
        preset = "ultimos_30_dias";
        start = addDays(today, -29);
        break;
    }
  }

  const comparisonPreset =
    preset === "mes_atual" ? "mesAtual" : preset === "mes_anterior" ? "mesAnterior" : null;
  const comparison = previousPeriod(start, endDay, comparisonPreset);
  return {
    preset,
    start: zonedBoundary(start, timeZone, false),
    end: zonedBoundary(endDay, timeZone, true),
    endDay,
    previousStart: zonedBoundary(comparison.start, timeZone, false),
    previousEnd: zonedBoundary(comparison.end, timeZone, true),
    startLabel: formatLocalDate(start),
    endLabel: formatLocalDate(endDay),
    previousStartLabel: formatLocalDate(comparison.start),
    previousEndLabel: formatLocalDate(comparison.end),
  };
}

async function exists(query: Promise<unknown>): Promise<boolean> {
  try {
    return Boolean(await query);
  } catch {
    return false;
  }
}

export async function detectCoverage(clienteId: string): Promise<AtrakoCoverage> {
  const where = { clienteId };
  const select = { id: true } as const;
  const [
    metaAds,
    googleAds,
    analytics,
    crmExternal,
    crmNative,
    contacts,
    commerce,
    marketplace,
    abandonedCarts,
    agenda,
    whatsapp,
    messaging,
    finance,
    instagram,
    forms,
    pages,
  ] = await Promise.all([
    exists(prisma.fatoMidiaDiario.findFirst({ where: { clienteId, canal: "META" }, select })),
    exists(prisma.googleAdsCampanha.findFirst({ where, select })),
    exists(prisma.fatoAnalyticsDiario.findFirst({ where, select })),
    exists(prisma.leadCrm.findFirst({ where, select })),
    exists(prisma.nativeLead.findFirst({ where, select })),
    exists(prisma.nativeContact.findFirst({ where, select })),
    exists(prisma.commerceOrder.findFirst({ where, select })),
    exists(prisma.marketplaceOrder.findFirst({ where, select })),
    exists(prisma.abandonedCart.findFirst({ where, select })),
    exists(prisma.agendaBooking.findFirst({ where, select })),
    exists(prisma.waConversation.findFirst({ where, select })),
    exists(prisma.messageCampaign.findFirst({ where, select })),
    exists(prisma.workspaceLedgerEntry.findFirst({ where, select })),
    exists(prisma.instagramInsightDiario.findFirst({ where, select })),
    exists(prisma.captureForm.findFirst({ where, select })),
    exists(prisma.commerceProduct.findFirst({ where, select })),
  ]);
  return {
    metaAds,
    googleAds,
    analytics,
    crmExternal,
    crmNative,
    contacts,
    commerce,
    marketplace,
    abandonedCarts,
    agenda,
    whatsapp,
    messaging,
    finance,
    instagram,
    forms,
    pages,
  };
}

export async function loadWorkspaceContext(input: {
  clienteId: string;
  actor: AtrakoActor;
  modules?: ModulesMap | null;
  now?: Date;
}): Promise<AtrakoWorkspaceContext | null> {
  const [cliente, settings, coverage] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: input.clienteId },
      select: {
        id: true,
        nome: true,
        segmento: true,
        objetivoMidia: true,
        orcamentoMidiaGoogleMensal: true,
        orcamentoMidiaMetaMensal: true,
        produtoServico: true,
        modeloNegocio: true,
        publicoAlvo: true,
        objetivoProjeto: true,
        diferenciais: true,
        observacoesAnaliticas: true,
      },
    }),
    prisma.workspaceSettings.findUnique({
      where: { clienteId: input.clienteId },
      select: { timezone: true, currency: true, locale: true },
    }),
    detectCoverage(input.clienteId),
  ]);
  if (!cliente) return null;
  const timezone = settings?.timezone || "America/Sao_Paulo";
  const modules = input.modules
    ? Object.entries(input.modules)
        .filter(([, m]) => m.enabled)
        .map(([k]) => k)
    : [];
  return {
    clienteId: cliente.id,
    nome: cliente.nome,
    segmento: cliente.segmento,
    objetivoMidia: cliente.objetivoMidia,
    orcamentoMidiaGoogleMensal:
      cliente.orcamentoMidiaGoogleMensal == null ? null : Number(cliente.orcamentoMidiaGoogleMensal),
    orcamentoMidiaMetaMensal:
      cliente.orcamentoMidiaMetaMensal == null ? null : Number(cliente.orcamentoMidiaMetaMensal),
    timezone,
    currency: settings?.currency || "BRL",
    locale: settings?.locale || "pt-BR",
    today: calendarDateIn(timezone, input.now),
    commercial: {
      produtoServico: cliente.produtoServico,
      modeloNegocio: cliente.modeloNegocio,
      publicoAlvo: cliente.publicoAlvo,
      objetivoProjeto: cliente.objetivoProjeto,
      diferenciais: cliente.diferenciais,
      observacoesAnaliticas: cliente.observacoesAnaliticas,
    },
    coverage,
    modules,
    actor: input.actor,
  };
}

/**
 * Monta o `AnalystPeriodContext` do InPilot para delegar às ferramentas de
 * mídia/funil (`executeAnalystTool`) — mesma resolução de objetivo do analista.
 */
export async function toAnalystPeriodContext(
  ctx: AtrakoWorkspaceContext,
  period: AtrakoPeriod,
  channel: AnalystPeriodContext["channel"] = "geral",
): Promise<AnalystPeriodContext> {
  const signals = await prisma.fatoMidiaDiario
    .aggregate({
      where: { clienteId: ctx.clienteId, canal: "META", data: { gte: period.start, lte: period.end } },
      _sum: {
        purchases: true,
        websitePurchasesConversionValue: true,
        messagingConversationsStarted: true,
      },
    })
    .catch(() => null);
  const purchases = signals?._sum.purchases ?? null;
  const revenue = Number(signals?._sum.websitePurchasesConversionValue ?? 0);
  const objective = resolveAccountAnalysisObjective(ctx.objetivoMidia, {
    purchases,
    attributedValue: revenue,
  });
  const taxonomy = resolveCampaignObjective({
    accountObjective: ctx.objetivoMidia,
    observed: {
      conversations: signals?._sum.messagingConversationsStarted ?? null,
      purchases,
      revenue,
    },
  });
  return {
    clienteId: ctx.clienteId,
    nome: ctx.nome,
    segmento: ctx.segmento,
    objetivoMidia: ctx.objetivoMidia,
    analysisObjective: objective.objective,
    analysisObjectiveBasis: objective.basis,
    objectiveTaxonomy: taxonomy.objective,
    objectiveTaxonomyBasis: taxonomy.source,
    orcamentoMidiaGoogleMensal: ctx.orcamentoMidiaGoogleMensal,
    orcamentoMidiaMetaMensal: ctx.orcamentoMidiaMetaMensal,
    start: period.start,
    end: period.end,
    previousStart: period.previousStart,
    previousEnd: period.previousEnd,
    startLabel: period.startLabel,
    endLabel: period.endLabel,
    previousStartLabel: period.previousStartLabel,
    previousEndLabel: period.previousEndLabel,
    channel,
    accountWide: channel === "geral",
    hasMetaData: ctx.coverage.metaAds,
    hasGoogleCampaigns: ctx.coverage.googleAds,
    hasCrmData: ctx.coverage.crmExternal,
    hasAnalyticsData: ctx.coverage.analytics,
    commercialContext: ctx.commercial,
  };
}

const COVERAGE_LABELS: Record<keyof AtrakoCoverage, string> = {
  metaAds: "Meta Ads",
  googleAds: "Google Ads",
  analytics: "Google Analytics",
  crmExternal: "CRM externo (RD/Kommo etc.)",
  crmNative: "CRM do Atrako (leads)",
  contacts: "Contatos",
  commerce: "Checkout Atrako (pedidos)",
  marketplace: "Lojas e marketplaces (pedidos de Shopify, Nuvemshop, Tray, Woo, Mercado Livre, Shopee…)",
  abandonedCarts: "Carrinhos abandonados",
  agenda: "Agenda (agendamentos)",
  whatsapp: "WhatsApp",
  messaging: "Campanhas de mensagem",
  finance: "Financeiro",
  instagram: "Instagram",
  forms: "Formulários",
  pages: "Páginas/produtos",
};

/** Bloco textual para o system prompt. */
export function describeWorkspaceContext(ctx: AtrakoWorkspaceContext): string {
  const withData = (Object.keys(COVERAGE_LABELS) as Array<keyof AtrakoCoverage>)
    .filter((k) => ctx.coverage[k])
    .map((k) => COVERAGE_LABELS[k]);
  const withoutData = (Object.keys(COVERAGE_LABELS) as Array<keyof AtrakoCoverage>)
    .filter((k) => !ctx.coverage[k])
    .map((k) => COVERAGE_LABELS[k]);
  const commercial = Object.entries({
    "Produto/serviço": ctx.commercial.produtoServico,
    "Modelo de negócio": ctx.commercial.modeloNegocio,
    "Público-alvo": ctx.commercial.publicoAlvo,
    "Objetivo": ctx.commercial.objetivoProjeto,
    "Diferenciais": ctx.commercial.diferenciais,
    "Observações": ctx.commercial.observacoesAnaliticas,
  })
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `- ${k}: ${String(v).trim().slice(0, 400)}`);
  return [
    `Negócio: ${ctx.nome}${ctx.segmento ? ` (${ctx.segmento})` : ""}`,
    `Hoje: ${formatLocalDate(ctx.today)} · fuso ${ctx.timezone} · moeda ${ctx.currency}`,
    `Objetivo de mídia configurado: ${ctx.objetivoMidia}`,
    commercial.length ? `Contexto comercial:\n${commercial.join("\n")}` : "Contexto comercial: não preenchido.",
    `Fontes com dados: ${withData.length ? withData.join(", ") : "nenhuma ainda"}`,
    `Fontes ainda sem dados: ${withoutData.length ? withoutData.join(", ") : "—"}`,
    "Vendas = soma de lojas, marketplaces e checkout Atrako: se qualquer um deles tem pedidos, o negócio tem dados de venda.",
    ctx.modules.length ? `Módulos ligados: ${ctx.modules.join(", ")}` : "",
    `Quem pergunta: ${ctx.actor.name ?? "usuário"} (${ctx.actor.role})`,
  ]
    .filter(Boolean)
    .join("\n");
}
