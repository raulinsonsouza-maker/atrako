import { prisma } from "@/lib/db";
import { fetchAdsWithCreatives, type MetaAd } from "@/lib/meta/metaClient";

export type AnalystPeriodContext = {
  clienteId: string;
  nome: string;
  segmento: string | null;
  objetivoMidia: string;
  analysisObjective: "leads" | "sales";
  analysisObjectiveBasis: "configured" | "observed-commerce";
  /** Objective family used to choose the primary result for a campaign. */
  objectiveTaxonomy?: AnalystObjective;
  objectiveTaxonomyBasis?: ObjectiveResolution["source"];
  orcamentoMidiaGoogleMensal: number | null;
  orcamentoMidiaMetaMensal: number | null;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  startLabel: string;
  endLabel: string;
  previousStartLabel: string;
  previousEndLabel: string;
  channel: "geral" | "meta" | "google";
  accountWide?: boolean;
  hasMetaData?: boolean;
  hasGoogleCampaigns?: boolean;
  hasCrmData?: boolean;
  hasAnalyticsData?: boolean;
  commercialContext?: {
    produtoServico: string | null;
    modeloNegocio: string | null;
    publicoAlvo: string | null;
    objetivoProjeto: string | null;
    diferenciais: string | null;
    observacoesAnaliticas: string | null;
  };
};

/**
 * Deliberately bounded objective vocabulary.  These are result families, not
 * every value that an ad platform may expose.  In particular, Google
 * conversions must not be silently described as sales.
 */
export type AnalystObjective =
  | "messaging"
  | "leads"
  | "purchases"
  | "traffic"
  | "awareness"
  | "engagement"
  | "app";

export type ObjectiveResultKey =
  | "conversations"
  | "leads"
  | "purchases"
  | "revenue"
  | "clicks"
  | "impressions"
  | "views"
  | "engagement"
  | "app"
  | "conversions";

export type ObjectiveResolution = {
  objective: AnalystObjective;
  source: "campaign-configured" | "observed-result" | "account-configured";
  resultKey: ObjectiveResultKey | null;
  resultLabel: string;
  supported: boolean;
};

const normalizeObjectiveText = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const objectiveFromText = (value: unknown): AnalystObjective | null => {
  const normalized = normalizeObjectiveText(value);
  if (!normalized) return null;
  if (/\b(app|aplicativo|instalacao|instalacoes|app install)\b/.test(normalized)) return "app";
  if (/\b(message|messages|mensagem|mensagens|messaging|conversa|conversas|whatsapp|click to whatsapp)\b/.test(normalized)) return "messaging";
  if (/\b(engagement|engajamento|video|visualizacao de video|interacao)\b/.test(normalized)) return "engagement";
  if (/\b(reach|alcance|awareness|reconhecimento|brand|impressoes|visualizacoes)\b/.test(normalized)) return "awareness";
  if (/\b(traffic|trafego|clique|cliques|visita|visitas|website)\b/.test(normalized)) return "traffic";
  if (/\b(purchase|purchases|compra|compras|sale|sales|venda|vendas|ecommerce|e commerce|revenue|receita|roas)\b/.test(normalized)) return "purchases";
  if (/\b(lead|leads|cadastro|cadastros|contato|contatos|conversao|conversoes)\b/.test(normalized)) return "leads";
  return null;
};

const resultForObjective = (objective: AnalystObjective): Pick<ObjectiveResolution, "resultKey" | "resultLabel" | "supported"> => {
  switch (objective) {
    case "messaging": return { resultKey: "conversations", resultLabel: "conversas iniciadas", supported: true };
    case "leads": return { resultKey: "leads", resultLabel: "leads", supported: true };
    case "purchases": return { resultKey: "purchases", resultLabel: "compras e receita atribuída", supported: true };
    case "traffic": return { resultKey: "clicks", resultLabel: "cliques", supported: true };
    case "awareness": return { resultKey: "impressions", resultLabel: "impressões/alcance", supported: true };
    case "engagement": return { resultKey: "engagement", resultLabel: "engajamento ou visualizações", supported: false };
    case "app": return { resultKey: "app", resultLabel: "resultados de aplicativo", supported: false };
  }
};

const objectiveResolution = (
  objective: AnalystObjective,
  source: ObjectiveResolution["source"],
): ObjectiveResolution => ({ objective, source, ...resultForObjective(objective) });

/**
 * Resolves an objective without treating a zero as missing.  A result field is
 * only considered observed when it is present and positive; a present zero is
 * still returned as a valid zero result by the caller's metadata.
 */
export function resolveCampaignObjective(input: {
  campaignObjective?: unknown;
  accountObjective?: unknown;
  observed?: {
    conversations?: number | null;
    leads?: number | null;
    purchases?: number | null;
    revenue?: number | null;
    clicks?: number | null;
    impressions?: number | null;
    conversions?: number | null;
  };
}): ObjectiveResolution {
  const configured = objectiveFromText(input.campaignObjective);
  const observed = input.observed ?? {};
  // Meta can report click-to-message campaigns under the broad engagement
  // objective. A persisted conversation result is more specific than that
  // umbrella label, while explicit configured objectives still take priority.
  if (configured && configured !== "engagement" && configured !== "app") {
    return objectiveResolution(configured, "campaign-configured");
  }
  if (Number(observed.conversations ?? 0) > 0) return objectiveResolution("messaging", "observed-result");
  if (configured) return objectiveResolution(configured, "campaign-configured");
  if (Number(observed.purchases ?? 0) > 0 || Number(observed.revenue ?? 0) > 0) return objectiveResolution("purchases", "observed-result");
  if (Number(observed.leads ?? 0) > 0) return objectiveResolution("leads", "observed-result");
  if (Number(observed.conversions ?? 0) > 0) {
    return { ...objectiveResolution("leads", "observed-result"), resultKey: "conversions", resultLabel: "conversões", supported: true };
  }
  const accountConfigured = objectiveFromText(input.accountObjective);
  if (accountConfigured) return objectiveResolution(accountConfigured, "account-configured");
  if (Number(observed.clicks ?? 0) > 0) return objectiveResolution("traffic", "observed-result");
  if (Number(observed.impressions ?? 0) > 0) return objectiveResolution("awareness", "observed-result");
  return objectiveResolution("leads", "account-configured");
}

export function objectiveResultMetadata(resolution: ObjectiveResolution, values: {
  conversations?: number | null;
  leads?: number | null;
  purchases?: number | null;
  revenue?: number | null;
  clicks?: number | null;
  impressions?: number | null;
  conversions?: number | null;
}) {
  const raw = values[resolution.resultKey as keyof typeof values];
  const value = raw == null ? null : Number(raw);
  return {
    objective: resolution.objective,
    objectiveSource: resolution.source,
    primaryResult: resolution.resultKey,
    primaryResultLabel: resolution.resultLabel,
    primaryResultValue: Number.isFinite(value) ? value : null,
    primaryResultState: value == null ? "unavailable" as const : value === 0 ? "zero" as const : "available" as const,
    supported: resolution.supported,
  };
}

export function currentObjectiveResultValues(values?: {
  conversations?: number | null;
  leads?: number | null;
  purchases?: number | null;
  revenue?: number | null;
  clicks?: number | null;
  impressions?: number | null;
  conversions?: number | null;
} | null) {
  return {
    conversations: values?.conversations ?? 0,
    leads: values?.leads ?? 0,
    purchases: values?.purchases ?? 0,
    revenue: values?.revenue ?? 0,
    clicks: values?.clicks ?? 0,
    impressions: values?.impressions ?? 0,
    conversions: values?.conversions ?? 0,
  };
}

export function resolveAccountAnalysisObjective(
  configuredObjective: string,
  signals: { purchases?: number | null; attributedValue?: number | null } = {},
) {
  const normalized = configuredObjective
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const configuredForSales = /\b(ecommerce|e commerce|venda|vendas|sales|compra|compras|receita|roas)\b/.test(normalized);
  if (configuredForSales) return { objective: "sales" as const, basis: "configured" as const };

  const purchases = Number(signals.purchases ?? 0);
  const attributedValue = Number(signals.attributedValue ?? 0);
  if (purchases >= 3 && attributedValue > 0) {
    return { objective: "sales" as const, basis: "observed-commerce" as const };
  }
  return { objective: "leads" as const, basis: "configured" as const };
}

type Source = { tool: string; label: string; period: { start: string; end: string }; coverage?: string; limitations?: string };
/** States are deliberately explicit: an absent source is not a zero result. */
export type DataCoverageState = "available" | "zero" | "unavailable" | "partial" | "truncated" | "not_requested" | "not_comparable";
export type DataCoverage = {
  state: DataCoverageState;
  records: number;
  lastDate?: string | null;
  reason?: string;
};
export const coverage = (records: number, lastDate?: string | null, reason?: string): DataCoverage => ({
  state: records === 0 ? "unavailable" : "available",
  records,
  lastDate: lastDate ?? null,
  ...(reason ? { reason } : {}),
});
export const unavailableCoverage = (reason: string): DataCoverage => ({
  state: "unavailable", records: 0, lastDate: null, reason,
});
export const notRequestedCoverage = (): DataCoverage => ({
  state: "not_requested", records: 0, lastDate: null, reason: "A plataforma não foi solicitada.",
});
export type CampaignRankingMetric = "VALUE" | "ROAS" | "CPA" | "CPC" | "CPL" | "LEADS" | "COST" | "RESULTS";
export type CampaignRankingDirection = "BEST" | "WORST";
export type CampaignMetricValues = {
  campaignId: string;
  cost: number;
  clicks: number;
  leads: number | null;
  actions: number;
  results: number;
  attributedValue: number;
};
export function campaignMetricValue(values: CampaignMetricValues, metric: CampaignRankingMetric, platform: "META" | "GOOGLE") {
  if (metric === "ROAS") return values.cost > 0 ? values.attributedValue / values.cost : null;
  if (metric === "CPA") return values.cost > 0 && values.actions > 0 ? values.cost / values.actions : null;
  if (metric === "CPC") return values.cost > 0 && values.clicks > 0 ? values.cost / values.clicks : null;
  if (metric === "CPL") return platform === "META" && values.cost > 0 && values.leads != null && values.leads > 0 ? values.cost / values.leads : null;
  if (metric === "LEADS") return platform === "META" ? values.leads : null;
  if (metric === "COST") return values.cost;
  if (metric === "RESULTS") return values.results;
  return values.attributedValue;
}
export function rankCampaignsByMetric<T>(
  items: T[],
  metric: CampaignRankingMetric,
  direction: CampaignRankingDirection,
  platform: "META" | "GOOGLE",
  values: (item: T) => CampaignMetricValues,
) {
  return [...items].sort((leftItem, rightItem) => {
    const leftValues = values(leftItem), rightValues = values(rightItem);
    const left = campaignMetricValue(leftValues, metric, platform);
    const right = campaignMetricValue(rightValues, metric, platform);
    if (left == null) return right == null ? leftValues.campaignId.localeCompare(rightValues.campaignId) : 1;
    if (right == null) return -1;
    const lowerIsBetter = metric === "CPA" || metric === "CPC" || metric === "CPL";
    const delta = lowerIsBetter
      ? direction === "BEST" ? left - right : right - left
      : direction === "BEST" ? right - left : left - right;
    return delta || leftValues.campaignId.localeCompare(rightValues.campaignId);
  });
}
export function rankingWinnerEvidence(
  rows: CampaignMetricValues[],
  metric: CampaignRankingMetric,
  platform: "META" | "GOOGLE",
) {
  const eligible = rows.filter((row) => {
    if (campaignMetricValue(row, metric, platform) == null) return false;
    if (metric === "CPC" || metric === "COST") return true;
    if (metric === "LEADS" || metric === "CPL") return Number(row.leads ?? 0) > 0;
    if (metric === "VALUE" || metric === "ROAS") return row.attributedValue > 0;
    return row.results > 0;
  });
  return {
    winnerStatus: eligible.length > 0 ? "eligible" as const : "no_positive_business_outcome" as const,
    eligibleWinnerCount: eligible.length,
    rankingEligible: eligible.length > 0,
    decisionSignal: eligible.length > 0
      ? null
      : {
          code: "INSUFFICIENT_BUSINESS_OUTCOME",
          confidence: "high",
          message: "Não há resultado de negócio positivo suficiente para declarar um melhor item nesta métrica.",
        },
  };
}
export const analystLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const source = (tool: string, label: string, c: AnalystPeriodContext, previous = false): Source => ({
  tool, label, period: { start: analystLocalDate(previous ? c.previousStart : c.start), end: analystLocalDate(previous ? c.previousEnd : c.end) },
});
const calendarDaysInclusive = (start: Date, end: Date) => {
  const startDate = new Date(`${analystLocalDate(start)}T00:00:00Z`);
  const endDate = new Date(`${analystLocalDate(end)}T00:00:00Z`);
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
};
const comparisonWindow = (c: AnalystPeriodContext) => {
  const currentDays = calendarDaysInclusive(c.start, c.end);
  const previousDays = calendarDaysInclusive(c.previousStart, c.previousEnd);
  return {
    current: { start: c.startLabel, end: c.endLabel, days: currentDays },
    previous: { start: c.previousStartLabel, end: c.previousEndLabel, days: previousDays },
    equivalent: currentDays === previousDays,
    reason: currentDays === previousDays ? null : "As janelas têm quantidades diferentes de dias e não devem ser tratadas como comparação equivalente.",
  };
};
const n = (v: unknown): number => v == null ? 0 : typeof v === "bigint" ? Number(v) : Number(v);
const finite = (v: number | null) => v != null && Number.isFinite(v) ? v : null;
const change = (current: number, previous: number) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;
export function mediaTotalsComparison(
  current: ReturnType<typeof emptyMediaTotals> & {
    cpl?: number | null;
    costPerResult?: number | null;
    returnOnAdSpend?: number | null;
  },
  previous: ReturnType<typeof emptyMediaTotals> & {
    cpl?: number | null;
    costPerResult?: number | null;
    returnOnAdSpend?: number | null;
  },
) {
  return {
    investmentPct: change(current.investimento, previous.investimento),
    leadsPct: change(current.leads, previous.leads),
    resultsDelta: current.results - previous.results,
    resultsPct: change(current.results, previous.results),
    attributedValueDelta: current.attributedValue - previous.attributedValue,
    attributedValuePct: change(current.attributedValue, previous.attributedValue),
    cplPct: current.cpl != null && previous.cpl != null ? change(current.cpl, previous.cpl) : null,
    costPerResultPct: current.costPerResult != null && previous.costPerResult != null
      ? change(current.costPerResult, previous.costPerResult)
      : null,
    roasPct: current.returnOnAdSpend != null && previous.returnOnAdSpend != null
      ? change(current.returnOnAdSpend, previous.returnOnAdSpend)
      : null,
  };
}
const periodWhere = (c: AnalystPeriodContext, previous = false) => ({
  gte: previous ? c.previousStart : c.start, lte: previous ? c.previousEnd : c.end,
});
const channelWhere = (channel: AnalystPeriodContext["channel"]) =>
  channel === "geral" ? undefined : { equals: channel.toUpperCase() };
const campaignRole = (name: string) =>
  /\b(rmkt|remarketing|retargeting)\b/i.test(name) ? "remarketing" as const : "unspecified" as const;
const safeProviderError = (message: string) =>
  message.replace(/access_token=[^&\s]+/gi, "access_token=[oculto]").replace(/\s+/g, " ").slice(0, 240);
type CreativeInput = {
  id: string;
  adId: string;
  adName: string;
  adsetId?: string | null;
  adsetName?: string | null;
  campaignId?: string | null;
  campaignName: string | null;
  campaignObjective?: string | null;
  mediaType: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations?: number;
  purchases: number;
  websitePurchasesConversionValue: number;
};
const metaActionTotal = (
  rows: NonNullable<MetaAd["insights"]>["data"],
  field: "actions" | "action_values",
  types: string[],
) => {
  for (const type of types) {
    const total = rows.reduce((sum, row) => sum + (row[field] ?? [])
      .filter((item) => item.action_type === type)
      .reduce((subtotal, item) => subtotal + n(item.value), 0), 0);
    if (total > 0) return total;
  }
  return 0;
};
async function fetchLiveCreativeInputs(c: AnalystPeriodContext): Promise<CreativeInput[]> {
  const { resolveMetaCredentials } = await import("@/lib/config/resolveIntegracao");
  const resolved = await resolveMetaCredentials(c.clienteId);
  // Credentials and account ID are always client-scoped via resolveMetaCredentials.
  const token = resolved?.token ?? null;
  const accountId = resolved?.accountId ?? null;
  if (!token || !accountId) return [];
  const ads = await fetchAdsWithCreatives(accountId, token, {
    dateFrom: c.startLabel,
    dateTo: c.endLabel,
  });
  return ads.map((ad) => {
    const insightRows = ad.insights?.data ?? [];
    const spend = insightRows.reduce((sum, row) => sum + n(row.spend), 0);
    const impressions = insightRows.reduce((sum, row) => sum + n(row.impressions), 0);
    const inlineClicks = insightRows.reduce((sum, row) => sum + n(row.inline_link_clicks), 0);
    const allClicks = insightRows.reduce((sum, row) => sum + n(row.clicks), 0);
    const creative = ad.adcreatives?.data?.[0];
    return {
      id: `live:${ad.id}`,
      adId: ad.id,
      adName: ad.name,
      adsetId: ad.adset?.id ?? null,
      adsetName: ad.adset?.name ?? null,
      campaignId: ad.adset?.campaign?.id ?? null,
      campaignName: ad.adset?.campaign?.name ?? null,
      campaignObjective: ad.adset?.campaign?.objective ?? null,
      mediaType: creative?.video_id || creative?.video_source_url || creative?.video_embed_html ? "video" : "image",
      spend,
      impressions,
      clicks: inlineClicks || allClicks,
      leads: metaActionTotal(insightRows, "actions", ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "website_lead"]),
      conversations: metaActionTotal(insightRows, "actions", [
        "onsite_conversion.messaging_conversation_started_7d",
        "messaging_conversation_started_7d",
        "onsite_conversion.messaging_first_reply",
      ]),
      purchases: metaActionTotal(insightRows, "actions", ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase", "website_purchase"]),
      websitePurchasesConversionValue: metaActionTotal(insightRows, "action_values", ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase", "website_purchase"]),
    };
  });
}
const PAGE_SIZE = 2_000;
const MAX_SAFE_ROWS = 100_000;
async function fetchAll<T>(fetchPage: (skip: number, take: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await fetchPage(skip, PAGE_SIZE);
    all.push(...page);
    if (page.length < PAGE_SIZE) return all;
    if (all.length >= MAX_SAFE_ROWS) {
      throw new Error("O período excede o limite seguro de 100.000 registros; reduza o intervalo para uma análise completa.");
    }
  }
}

export const ANALYST_TOOL_DEFINITIONS = [
  { type: "function", function: { name: "get_media_overview", description: "Resumo de mídia paga no período, com série mensal ou diária quando solicitada, e comparação equivalente.", strict: true, parameters: { type: "object", properties: { channel: { type: ["string", "null"], enum: ["geral", "meta", "google", null] }, granularity: { type: "string", enum: ["period", "month", "day"] } }, required: ["channel", "granularity"], additionalProperties: false } } },
  { type: "function", function: { name: "get_campaign_performance", description: "Campanhas ordenadas pela métrica e direção solicitadas; CPL e leads só estão disponíveis para Meta.", strict: true, parameters: { type: "object", properties: { platform: { type: "string", enum: ["META", "GOOGLE"] }, limit: { type: "integer", minimum: 1, maximum: 100 }, metric: { type: "string", enum: ["VALUE", "ROAS", "CPA", "CPC", "CPL", "LEADS", "COST", "RESULTS"] }, direction: { type: "string", enum: ["BEST", "WORST"] }, onlyPositive: { type: "boolean" } }, required: ["platform", "limit", "metric", "direction", "onlyPositive"], additionalProperties: false } } },
  { type: "function", function: { name: "get_creative_performance", description: "Criativos/anúncios da Meta ordenados pela métrica pedida. Quando a API fornecer IDs e nomes, a hierarquia é Campaign -> Conjunto -> Criativo; não invente níveis ausentes.", strict: true, parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 }, metric: { type: "string", enum: ["VALUE", "ROAS", "CPA", "CPC", "CPL", "LEADS", "COST", "RESULTS"] }, direction: { type: "string", enum: ["BEST", "WORST"] } }, required: ["limit", "metric", "direction"], additionalProperties: false } } },
  { type: "function", function: { name: "get_crm_funnel", description: "Funil agregado do CRM, sem dados pessoais.", strict: true, parameters: { type: "object", properties: {}, required: [], additionalProperties: false } } },
  { type: "function", function: { name: "get_analytics_overview", description: "Fatos agregados de analytics e totais por canal.", strict: true, parameters: { type: "object", properties: {}, required: [], additionalProperties: false } } },
  { type: "function", function: { name: "get_business_context", description: "Perfil, metas numéricas e saldos de contas.", strict: true, parameters: { type: "object", properties: {}, required: [], additionalProperties: false } } },
] as const;

const emptyMediaTotals = () => ({ impressoes: 0, cliques: 0, leads: 0, results: 0, investimento: 0, attributedValue: 0 });

const mediaEfficiency = (totals: ReturnType<typeof emptyMediaTotals>, platform: "META" | "GOOGLE" | "GERAL") => ({
  ctr: totals.impressoes > 0 ? (totals.cliques / totals.impressoes) * 100 : null,
  cpc: totals.cliques > 0 ? totals.investimento / totals.cliques : null,
  // Leads are a Meta event and conversions are a Google event. Neither is
  // meaningful as a denominator for a combined account total.
  cpl: platform === "META" && totals.leads > 0 ? totals.investimento / totals.leads : null,
  costPerResult: platform === "GERAL" ? null : totals.results > 0 ? totals.investimento / totals.results : null,
  returnOnAdSpend: platform === "GERAL" ? null : totals.investimento > 0 && totals.attributedValue > 0
    ? totals.attributedValue / totals.investimento : null,
});

async function media(c: AnalystPeriodContext, previous = false, channel = c.channel) {
  const requestsMeta = channel !== "google";
  const requestsGoogle = channel !== "meta";
  const [rows, googleRows] = await Promise.all([
    !requestsMeta ? Promise.resolve([]) : fetchAll((skip, take) => prisma.fatoMidiaDiario.findMany({
      where: { clienteId: c.clienteId, data: periodWhere(c, previous), canal: "META" },
      select: { id: true, data: true, canal: true, impressoes: true, cliques: true, leads: true, conversoes: true, investimento: true, purchases: true, websitePurchasesConversionValue: true },
      orderBy: [{ data: "asc" }, { id: "asc" }], skip, take,
    })),
    !requestsGoogle ? Promise.resolve([]) : fetchAll((skip, take) => prisma.googleAdsCampanha.findMany({
      where: { clienteId: c.clienteId, data: periodWhere(c, previous) },
      select: { id: true, data: true, impressoes: true, cliques: true, custoMicros: true, conversoes: true, conversaoValorMicros: true },
      orderBy: [{ data: "asc" }, { id: "asc" }], skip, take,
    })),
  ]);
  const totals = emptyMediaTotals();
  const metaTotals = emptyMediaTotals();
  const googleTotals = emptyMediaTotals();
  const buckets = new Map<string, ReturnType<typeof emptyMediaTotals>>();
  const metaMonthly = new Map<string, ReturnType<typeof emptyMediaTotals>>();
  const googleMonthly = new Map<string, ReturnType<typeof emptyMediaTotals>>();
  const addToBucket = (
    bucket: Map<string, ReturnType<typeof emptyMediaTotals>>,
    key: string,
    values: Partial<ReturnType<typeof emptyMediaTotals>>,
  ) => {
    const current = bucket.get(key) ?? emptyMediaTotals();
    current.impressoes += values.impressoes ?? 0;
    current.cliques += values.cliques ?? 0;
    current.leads += values.leads ?? 0;
    current.results += values.results ?? 0;
    current.investimento += values.investimento ?? 0;
    current.attributedValue += values.attributedValue ?? 0;
    bucket.set(key, current);
  };
  for (const r of rows) {
    const day = analystLocalDate(r.data);
    const rowValues = {
      impressoes: r.impressoes,
      cliques: r.cliques,
      leads: r.leads,
      results: r.purchases,
      investimento: n(r.investimento),
      attributedValue: n(r.websitePurchasesConversionValue),
    };
    addToBucket(buckets, day, rowValues);
    addToBucket(metaMonthly, day.slice(0, 7), rowValues);
    metaTotals.impressoes += r.impressoes;
    metaTotals.cliques += r.cliques;
    metaTotals.leads += r.leads;
    metaTotals.results += r.purchases;
    metaTotals.investimento += n(r.investimento);
    metaTotals.attributedValue += n(r.websitePurchasesConversionValue);
  }
  for (const r of googleRows) {
    const day = analystLocalDate(r.data);
    const rowValues = {
      impressoes: r.impressoes,
      cliques: r.cliques,
      results: r.conversoes,
      investimento: n(r.custoMicros) / 1e6,
      attributedValue: n(r.conversaoValorMicros) / 1e6,
    };
    addToBucket(buckets, day, rowValues);
    addToBucket(googleMonthly, day.slice(0, 7), rowValues);
    googleTotals.impressoes += r.impressoes;
    googleTotals.cliques += r.cliques;
    googleTotals.results += r.conversoes;
    googleTotals.investimento += n(r.custoMicros) / 1e6;
    googleTotals.attributedValue += n(r.conversaoValorMicros) / 1e6;
  }
  for (const values of buckets.values()) {
    totals.impressoes += values.impressoes;
    totals.cliques += values.cliques;
    totals.leads += values.leads;
    totals.results += values.results;
    totals.investimento += values.investimento;
    totals.attributedValue += values.attributedValue;
  }
  const platformTotals = {
    meta: { ...metaTotals, ...mediaEfficiency(metaTotals, "META") },
    google: { ...googleTotals, ...mediaEfficiency(googleTotals, "GOOGLE") },
  };
  const monthlyRows = (bucket: Map<string, ReturnType<typeof emptyMediaTotals>>, platform: "META" | "GOOGLE") =>
    [...bucket]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({ month, ...values, ...mediaEfficiency(values, platform) }));
  const monthly = channel === "meta"
    ? monthlyRows(metaMonthly, "META")
    : channel === "google"
      ? monthlyRows(googleMonthly, "GOOGLE")
      : [...new Set([...metaMonthly.keys(), ...googleMonthly.keys()])]
          .sort((a, b) => a.localeCompare(b))
          .map((month) => ({
            month,
            meta: metaMonthly.has(month)
              ? { ...metaMonthly.get(month)!, ...mediaEfficiency(metaMonthly.get(month)!, "META") }
              : null,
            google: googleMonthly.has(month)
              ? { ...googleMonthly.get(month)!, ...mediaEfficiency(googleMonthly.get(month)!, "GOOGLE") }
              : null,
          }));
  return {
    // Keep totals for existing consumers, but never expose a combined ratio.
    totals: { ...totals, ...mediaEfficiency(totals, "GERAL") },
    platforms: platformTotals,
    coverage: {
      meta: requestsMeta
        ? coverage(rows.length, rows.length ? analystLocalDate(rows[rows.length - 1].data) : null)
        : notRequestedCoverage(),
      google: requestsGoogle
        ? coverage(googleRows.length, googleRows.length ? analystLocalDate(googleRows[googleRows.length - 1].data) : null)
        : notRequestedCoverage(),
    },
    daily: [...buckets].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, values]) => ({ day, ...values })),
    monthly,
    rowCount: rows.length + googleRows.length,
  };
}

export async function executeAnalystTool(name: string, args: unknown, c: AnalystPeriodContext): Promise<{ source: Source; data: unknown }> {
  const a = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  if (name === "get_media_overview") {
    const requestedChannel = a.channel === "meta" || a.channel === "google" || a.channel === "geral" ? a.channel : c.channel;
    const channel = c.channel === "geral" ? requestedChannel : c.channel;
    const granularity = a.granularity === "month" || a.granularity === "day" ? a.granularity : "period";
    const [current, previous] = await Promise.all([media(c, false, channel), media(c, true, channel)]);
    const isComparable = (currentCoverage: DataCoverage, previousCoverage: DataCoverage) =>
      currentCoverage.state === "available" && previousCoverage.state === "available";
    const comparison = channel === "meta" && isComparable(current.coverage.meta, previous.coverage.meta)
      ? mediaTotalsComparison(current.totals, previous.totals)
      : channel === "google" && isComparable(current.coverage.google, previous.coverage.google)
        ? mediaTotalsComparison(current.totals, previous.totals)
        : null;
    const platformComparisons = {
      meta: isComparable(current.coverage.meta, previous.coverage.meta)
        ? mediaTotalsComparison(current.platforms.meta, previous.platforms.meta)
        : null,
      google: isComparable(current.coverage.google, previous.coverage.google)
        ? mediaTotalsComparison(current.platforms.google, previous.platforms.google)
        : null,
    };
    const exposeSnapshot = (snapshot: typeof current) => {
      const requestedCoverage = channel === "meta" ? snapshot.coverage.meta : snapshot.coverage.google;
      if (channel !== "geral" && requestedCoverage.state !== "available") {
        return { ...snapshot, totals: null, daily: [], monthly: [] };
      }
      if (channel === "geral") return {
          ...snapshot,
          platforms: {
            meta: snapshot.coverage.meta.state === "available" ? snapshot.platforms.meta : null,
            google: snapshot.coverage.google.state === "available" ? snapshot.platforms.google : null,
          },
          totals: {
            ...snapshot.totals,
            leads: null,
            results: null,
            attributedValue: null,
            cpl: null,
            costPerResult: null,
            returnOnAdSpend: null,
          },
          daily: snapshot.daily.map((day) => ({
            ...day,
            leads: null,
            results: null,
            attributedValue: null,
          })),
          monthly: snapshot.monthly,
        };
      return snapshot;
    };
    return {
      source: {
        ...source(name, "Visão geral de mídia", c),
        coverage: `${current.rowCount} registros agregados`,
         limitations: `Totais e eficiência são separados por plataforma: compras/receita atribuída da Meta não são combinadas com conversões/valor de conversão do Google.${granularity === "day" ? " A série diária traz somente os 14 dias mais recentes." : ""}`,
      },
      data: {
        channel,
         granularity,
        comparisonWindow: comparisonWindow(c),
         resultTerminology: channel === "google" ? "conversões e valor de conversão do Google Ads" : channel === "meta" ? "compras e receita atribuída da Meta" : "métricas separadas por plataforma; não há resultado, CPA ou ROAS combinado",
         metricCoverage: current.coverage,
         current: exposeSnapshot(current),
         previous: exposeSnapshot(previous),
         comparison,
         platformComparisons,
      },
    };
  }
  if (name === "get_campaign_performance") {
    const requestedPlatform = a.platform === "GOOGLE" ? "GOOGLE" : "META";
    const platform = c.channel === "meta" ? "META" : c.channel === "google" ? "GOOGLE" : requestedPlatform;
    const limit = Math.min(100, Math.max(1, Number(a.limit) || 5));
    const metric: CampaignRankingMetric = a.metric === "ROAS" || a.metric === "CPA" || a.metric === "CPC" || a.metric === "CPL" || a.metric === "LEADS" || a.metric === "COST" || a.metric === "RESULTS" ? a.metric : "VALUE";
    const direction = a.direction === "WORST" ? "WORST" : "BEST";
    if (platform === "GOOGLE" && (metric === "CPL" || metric === "LEADS")) {
      return {
        source: {
          ...source(name, "Performance de campanhas Google", c),
          coverage: `${metric} indisponível`,
          limitations: `O conjunto agregado de campanhas do Google Ads não possui leads. ${metric} não foi substituído por outra métrica.`,
        },
        data: {
          platform,
          metric,
          direction,
          unsupported: true,
          campaigns: [],
          oppositeCampaigns: [],
          omitted: { count: 0, cost: 0, conversions: 0, conversionValue: 0 },
        },
      };
    }
    if (platform === "GOOGLE") {
      const [rows, previousRows] = await Promise.all([
        fetchAll((skip, take) => prisma.googleAdsCampanha.findMany({ where: { clienteId: c.clienteId, data: periodWhere(c) }, select: { id: true, campaignId: true, campaignName: true, impressoes: true, cliques: true, custoMicros: true, conversoes: true, conversaoValorMicros: true }, orderBy: [{ data: "asc" }, { id: "asc" }], skip, take })),
        fetchAll((skip, take) => prisma.googleAdsCampanha.findMany({ where: { clienteId: c.clienteId, data: periodWhere(c, true) }, select: { id: true, campaignId: true, campaignName: true, impressoes: true, cliques: true, custoMicros: true, conversoes: true, conversaoValorMicros: true }, orderBy: [{ data: "asc" }, { id: "asc" }], skip, take })),
      ]);
      type GoogleCampaign = { campaignId: string; campaignName: string; impressions: number; clicks: number; cost: number; conversions: number; conversionValue: number };
      const aggregate = (input: typeof rows) => {
        const map = new Map<string, GoogleCampaign>();
        for (const r of input) {
          const x = map.get(r.campaignId) ?? { campaignId: r.campaignId, campaignName: r.campaignName, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 };
          x.impressions += r.impressoes; x.clicks += r.cliques; x.cost += n(r.custoMicros) / 1e6; x.conversions += r.conversoes; x.conversionValue += n(r.conversaoValorMicros) / 1e6; map.set(r.campaignId, x);
        }
        return map;
      };
      const current = aggregate(rows);
      const previous = aggregate(previousRows);
      const campaignRows = [...new Set([...current.keys(), ...previous.keys()])].map((id) => {
        const now = current.get(id);
        const before = previous.get(id);
        const value = now ?? before!;
        const objective = resolveCampaignObjective({
          accountObjective: c.objetivoMidia,
          observed: now ?? value ? {
            clicks: (now ?? value).clicks,
            impressions: (now ?? value).impressions,
            conversions: (now ?? value).conversions,
          } : undefined,
        });
        const resultMetadata = objectiveResultMetadata(objective, {
          clicks: now?.clicks ?? 0,
          impressions: now?.impressions ?? 0,
          conversions: now?.conversions ?? 0,
        });
        return {
          ...(now ?? { ...value, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 }),
          ...resultMetadata,
          results: resultMetadata.primaryResultValue ?? 0,
          resultState: resultMetadata.primaryResultState,
          state: !before ? "new" : !now ? "stopped" : "continuing",
          comparison: {
            costPct: change(now?.cost ?? 0, before?.cost ?? 0),
            conversionsPct: change(now?.conversions ?? 0, before?.conversions ?? 0),
            conversionValuePct: change(now?.conversionValue ?? 0, before?.conversionValue ?? 0),
          },
          roas: now && now.cost > 0 ? now.conversionValue / now.cost : null,
          costPerConversion: now && now.conversions > 0 ? now.cost / now.conversions : null,
          cpc: now && now.clicks > 0 ? now.cost / now.clicks : null,
           terminology: "conversões e valor de conversão; não equivalem necessariamente a vendas e receita",
          campaignRole: campaignRole(value.campaignName),
        };
      });
      const campaigns = rankCampaignsByMetric(campaignRows, metric, direction, "GOOGLE", (item) => ({
        campaignId: item.campaignId,
        cost: item.cost,
        clicks: item.clicks,
        leads: null,
        actions: item.conversions,
        results: item.conversions,
        attributedValue: item.conversionValue,
      }));
      const selectedCampaigns = a.onlyPositive
        ? campaigns.filter((item) => (campaignMetricValue({
            campaignId: item.campaignId, cost: item.cost, clicks: item.clicks, leads: null,
            actions: item.conversions, results: item.conversions, attributedValue: item.conversionValue,
          }, metric, "GOOGLE") ?? 0) > 0)
        : campaigns;
      const winnerEvidence = rankingWinnerEvidence(selectedCampaigns.map((item) => ({
        campaignId: item.campaignId,
        cost: item.cost,
        clicks: item.clicks,
        leads: null,
        actions: item.conversions,
        results: item.primaryResultValue ?? item.conversions,
        attributedValue: item.conversionValue,
      })), metric, "GOOGLE");
      const omitted = selectedCampaigns.slice(limit);
      return {
        source: { ...source(name, "Performance de campanhas Google", c), coverage: `${rows.length} linhas atuais e ${previousRows.length} anteriores`, limitations: `${omitted.length ? `${omitted.length} campanhas ficaram fora do limite seguro de resposta. ` : ""}Valores representam conversões do Google Ads; todas as linhas do período foram agregadas antes do ranking.` },
        data: {
          platform,
          accountObjective: c.objetivoMidia,
          objectiveFallback: c.objectiveTaxonomy ?? resolveCampaignObjective({ accountObjective: c.objetivoMidia }).objective,
          resultTerminology: "No Google, o resultado é conversão; não é tratado como venda. Cada campanha informa objetivo, resultado primário e disponibilidade.",
          metric,
          direction,
          ...winnerEvidence,
          metricCoverage: campaigns.filter((item) => campaignMetricValue({
            campaignId: item.campaignId, cost: item.cost, clicks: item.clicks, leads: null,
            actions: item.conversions, results: item.conversions, attributedValue: item.conversionValue,
          }, metric, "GOOGLE") != null).length,
          totalMatchingCount: selectedCampaigns.length,
          returnedCount: Math.min(limit, selectedCampaigns.length),
          truncated: omitted.length > 0,
          campaigns: selectedCampaigns.slice(0, limit),
          oppositeCampaigns: a.onlyPositive ? [] : campaigns.slice(-limit).reverse(),
          omitted: {
            count: omitted.length,
            cost: omitted.reduce((sum, item) => sum + item.cost, 0),
            conversions: omitted.reduce((sum, item) => sum + item.conversions, 0),
            conversionValue: omitted.reduce((sum, item) => sum + item.conversionValue, 0),
          },
        },
      };
    }
    const [rows, previousRows, objectiveRows] = await Promise.all([
       fetchAll((skip, take) => prisma.fatoMidiaDiario.findMany({ where: { clienteId: c.clienteId, canal: "META", data: periodWhere(c), NOT: { campaignName: "" } }, select: { id: true, campaignId: true, campaignName: true, impressoes: true, cliques: true, investimento: true, leads: true, purchases: true, messagingConversationsStarted: true, websitePurchasesConversionValue: true }, orderBy: [{ data: "asc" }, { id: "asc" }], skip, take })),
       fetchAll((skip, take) => prisma.fatoMidiaDiario.findMany({ where: { clienteId: c.clienteId, canal: "META", data: periodWhere(c, true), NOT: { campaignName: "" } }, select: { id: true, campaignId: true, campaignName: true, impressoes: true, cliques: true, investimento: true, leads: true, purchases: true, messagingConversationsStarted: true, websitePurchasesConversionValue: true }, orderBy: [{ data: "asc" }, { id: "asc" }], skip, take })),
       prisma.metaAdsCriativo.findMany({
         where: { clienteId: c.clienteId, campaignId: { not: null } },
         select: { campaignId: true, campaignObjective: true },
         orderBy: { data: "desc" },
       }),
    ]);
    const campaignObjectives = new Map<string, string>();
    for (const row of objectiveRows) {
      if (row.campaignId && row.campaignObjective && !campaignObjectives.has(row.campaignId)) {
        campaignObjectives.set(row.campaignId, row.campaignObjective);
      }
    }
    type MetaCampaign = { campaignId: string; campaignName: string; impressions: number; clicks: number; cost: number; leads: number; purchases: number; conversations: number; revenue: number };
    const aggregate = (input: typeof rows) => {
      const map = new Map<string, MetaCampaign>();
      for (const r of input) {
        const id = r.campaignId || `name:${r.campaignName ?? "sem-nome"}`;
        const x = map.get(id) ?? { campaignId: id, campaignName: r.campaignName ?? "Campanha sem nome", impressions: 0, clicks: 0, cost: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0 };
        x.impressions += r.impressoes; x.clicks += r.cliques; x.cost += n(r.investimento); x.leads += r.leads; x.purchases += r.purchases; x.conversations += r.messagingConversationsStarted; x.revenue += n(r.websitePurchasesConversionValue); map.set(id, x);
      }
      return map;
    };
    const current = aggregate(rows);
    const previous = aggregate(previousRows);
    const campaignRows = [...new Set([...current.keys(), ...previous.keys()])].map((id) => {
      const now = current.get(id);
      const before = previous.get(id);
      const value = now ?? before!;
        const resultValues = now ?? { ...value, impressions: 0, clicks: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0 };
      return {
        ...(now ?? { ...value, impressions: 0, clicks: 0, cost: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0 }),
        ...(() => {
          const objective = resolveCampaignObjective({
            campaignObjective: campaignObjectives.get(id),
            accountObjective: c.objetivoMidia,
            observed: now ?? value,
          });
          const resultMetadata = objectiveResultMetadata(objective, resultValues);
          return {
            ...resultMetadata,
            results: resultMetadata.primaryResultValue ?? 0,
            resultState: resultMetadata.primaryResultState,
          };
        })(),
        state: !before ? "new" : !now ? "stopped" : "continuing",
        comparison: {
          costPct: change(now?.cost ?? 0, before?.cost ?? 0),
          leadsPct: change(now?.leads ?? 0, before?.leads ?? 0),
          purchasesPct: change(now?.purchases ?? 0, before?.purchases ?? 0),
          revenuePct: change(now?.revenue ?? 0, before?.revenue ?? 0),
          cplPct: before && before.leads > 0 && now && now.leads > 0
            ? change(now.cost / now.leads, before.cost / before.leads)
            : null,
        },
          roas: now && now.cost > 0 ? now.revenue / now.cost : null,
          cpa: now && now.purchases > 0 ? now.cost / now.purchases : null,
          cpl: now && now.leads > 0 ? now.cost / now.leads : null,
          cpc: now && now.clicks > 0 ? now.cost / now.clicks : null,
          campaignRole: campaignRole(value.campaignName),
      };
    });
    const campaignValues = (item: (typeof campaignRows)[number]): CampaignMetricValues => ({
      campaignId: item.campaignId,
      cost: item.cost,
      clicks: item.clicks,
      leads: item.leads,
      actions: item.results,
          results: item.results,
      attributedValue: item.revenue,
    });
    const campaigns = rankCampaignsByMetric(campaignRows, metric, direction, "META", campaignValues);
    const selectedCampaigns = a.onlyPositive
      ? campaigns.filter((item) => (campaignMetricValue(campaignValues(item), metric, "META") ?? 0) > 0)
      : campaigns;
    const winnerEvidence = rankingWinnerEvidence(selectedCampaigns.map(campaignValues), metric, "META");
    const omitted = selectedCampaigns.slice(limit);
    return {
      source: { ...source(name, "Performance de campanhas Meta", c), coverage: `${rows.length} linhas atuais e ${previousRows.length} anteriores`, limitations: `${omitted.length ? `${omitted.length} campanhas ficaram fora do limite seguro de resposta. ` : ""}O resultado primário segue o objetivo da campanha quando disponível; leads zerados não anulam conversas iniciadas. Receita e compras dependem da atribuição da Meta.` },
      data: {
        platform,
        accountObjective: c.objetivoMidia,
        objectiveFallback: c.objectiveTaxonomy ?? resolveCampaignObjective({ accountObjective: c.objetivoMidia }).objective,
        resultTerminology: "cada campanha expõe objetivo, resultado primário e estado do resultado; zero é diferente de indisponível",
        metric,
        direction,
        ...winnerEvidence,
        metricCoverage: campaigns.filter((item) => campaignMetricValue(campaignValues(item), metric, "META") != null).length,
        totalMatchingCount: selectedCampaigns.length,
        returnedCount: Math.min(limit, selectedCampaigns.length),
        truncated: omitted.length > 0,
        campaigns: selectedCampaigns.slice(0, limit),
        oppositeCampaigns: a.onlyPositive ? [] : campaigns.slice(-limit).reverse(),
        omitted: {
          count: omitted.length,
          cost: omitted.reduce((sum, item) => sum + item.cost, 0),
          purchases: omitted.reduce((sum, item) => sum + item.purchases, 0),
          revenue: omitted.reduce((sum, item) => sum + item.revenue, 0),
        },
      },
    };
  }
  if (name === "get_creative_performance") {
    const limit = Math.min(10, Math.max(1, Number(a.limit) || 5));
    const metric: CampaignRankingMetric = a.metric === "ROAS" || a.metric === "CPA" || a.metric === "CPC" || a.metric === "CPL" || a.metric === "LEADS" || a.metric === "COST" || a.metric === "RESULTS" ? a.metric : "VALUE";
    const direction = a.direction === "WORST" ? "WORST" : "BEST";
    const [persistedRows, persistedPreviousRows] = await Promise.all([
      fetchAll((skip, take) => prisma.metaAdsCriativo.findMany({
        where: { clienteId: c.clienteId, data: periodWhere(c) },
          select: { id: true, adId: true, adName: true, adsetId: true, adsetName: true, campaignId: true, campaignName: true, campaignObjective: true, mediaType: true, spend: true, impressions: true, clicks: true, leads: true, purchases: true, messagingConversationsStarted: true, websitePurchasesConversionValue: true },
        orderBy: [{ data: "asc" }, { id: "asc" }], skip, take,
      })),
      fetchAll((skip, take) => prisma.metaAdsCriativo.findMany({
        where: { clienteId: c.clienteId, data: periodWhere(c, true) },
          select: { id: true, adId: true, adName: true, adsetId: true, adsetName: true, campaignId: true, campaignName: true, campaignObjective: true, mediaType: true, spend: true, impressions: true, clicks: true, leads: true, purchases: true, messagingConversationsStarted: true, websitePurchasesConversionValue: true },
        orderBy: [{ data: "asc" }, { id: "asc" }], skip, take,
      })),
    ]);
    let rows: CreativeInput[] = persistedRows.map((row) => ({
      ...row,
      campaignObjective: row.campaignObjective,
      conversations: row.messagingConversationsStarted,
      spend: n(row.spend),
      websitePurchasesConversionValue: n(row.websitePurchasesConversionValue),
    }));
    const previousRows: CreativeInput[] = persistedPreviousRows.map((row) => ({
      ...row,
      campaignObjective: row.campaignObjective,
      conversations: row.messagingConversationsStarted,
      spend: n(row.spend),
      websitePurchasesConversionValue: n(row.websitePurchasesConversionValue),
    }));
    let liveFallback = false;
    let liveFallbackError: string | null = null;
    if (rows.length === 0) {
      try {
        rows = await fetchLiveCreativeInputs(c);
        liveFallback = rows.length > 0;
      } catch (error) {
        liveFallbackError = error instanceof Error ? error.message : "Falha ao consultar criativos ao vivo";
      }
    }
    type Creative = { adId: string; adName: string; adsetId?: string | null; adsetName?: string | null; campaignId?: string | null; campaignName: string | null; campaignObjective?: string | null; mediaType: string; cost: number; impressions: number; clicks: number; leads: number; purchases: number; conversations: number; revenue: number };
    const aggregate = (input: typeof rows) => {
      const map = new Map<string, Creative>();
      for (const row of input) {
        const item = map.get(row.adId) ?? {
          adId: row.adId, adName: row.adName, adsetId: row.adsetId, adsetName: row.adsetName, campaignId: row.campaignId, campaignName: row.campaignName, campaignObjective: row.campaignObjective, mediaType: row.mediaType,
          cost: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0,
        };
        item.cost += row.spend;
        item.impressions += row.impressions;
        item.clicks += row.clicks;
        item.leads += row.leads;
        item.purchases += row.purchases;
        item.conversations += row.conversations ?? 0;
        item.revenue += row.websitePurchasesConversionValue;
        map.set(row.adId, item);
      }
      return map;
    };
    const current = aggregate(rows);
    const previous = aggregate(previousRows);
    const creatives = [...new Set([...current.keys(), ...previous.keys()])].map((id) => {
      const now = current.get(id);
      const before = previous.get(id);
      const identity = now ?? before!;
      const currentResults = currentObjectiveResultValues(now);
      return {
        ...(now ?? { ...identity, cost: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0 }),
        ...objectiveResultMetadata(resolveCampaignObjective({
          campaignObjective: identity.campaignObjective,
          accountObjective: c.objetivoMidia,
          observed: currentResults,
        }), currentResults),
        hierarchy: {
          campaign: identity.campaignId || identity.campaignName ? { id: identity.campaignId ?? null, name: identity.campaignName ?? null } : null,
          adset: identity.adsetId || identity.adsetName ? { id: identity.adsetId ?? null, name: identity.adsetName ?? null } : null,
          creative: { id: identity.adId, name: identity.adName },
        },
        comparison: {
          costPct: change(now?.cost ?? 0, before?.cost ?? 0),
          purchasesPct: change(now?.purchases ?? 0, before?.purchases ?? 0),
          revenuePct: change(now?.revenue ?? 0, before?.revenue ?? 0),
        },
        cpa: now && now.purchases > 0 ? now.cost / now.purchases : null,
        cpl: now && now.leads > 0 ? now.cost / now.leads : null,
        cpc: now && now.clicks > 0 ? now.cost / now.clicks : null,
        roas: now && now.cost > 0 ? now.revenue / now.cost : null,
      };
    });
    const values = (item: (typeof creatives)[number]): CampaignMetricValues => ({
      campaignId: item.adId, cost: item.cost, clicks: item.clicks, leads: item.leads,
      actions: item.primaryResultValue ?? 0, results: item.primaryResultValue ?? 0, attributedValue: item.revenue,
    });
    const ranked = rankCampaignsByMetric(creatives, metric, direction, "META", values);
    const winnerEvidence = rankingWinnerEvidence(ranked.map(values), metric, "META");
    const unavailable = rows.length === 0;
    return {
      source: {
        ...source(name, "Performance de criativos Meta", c),
        coverage: `${rows.length} linhas atuais e ${previousRows.length} anteriores${liveFallback ? "; período atual consultado ao vivo na Meta" : ""}`,
        limitations: unavailable
          ? `Não há registros de criativos no período${liveFallbackError ? `; a consulta ao vivo falhou: ${safeProviderError(liveFallbackError)}` : ""}.`
          : `Compras e receita dependem da atribuição da Meta; todas as linhas do período foram agregadas antes do ranking.${liveFallback ? " O período atual veio da consulta ao vivo porque a sincronização local ainda não continha essas linhas." : ""}`,
      },
      data: {
        platform: "META", entity: "creative", metric, direction, unavailable,
        ...winnerEvidence,
        objectiveFallback: c.objectiveTaxonomy ?? resolveCampaignObjective({ accountObjective: c.objetivoMidia }).objective,
        resultTerminology: "Cada criativo informa seu objetivo e resultado primário; conversas iniciadas não são leads.",
        creatives: ranked.slice(0, limit),
        metricCoverage: ranked.filter((item) => campaignMetricValue(values(item), metric, "META") != null).length,
      },
    };
  }
  if (name === "get_crm_funnel") {
    const [leads, previousLeads] = await Promise.all([
      fetchAll((skip, take) => prisma.leadCrm.findMany({ where: { clienteId: c.clienteId, dataEntrada: periodWhere(c) }, select: { id: true, etapa: true, ordemEtapa: true, valor: true, dataEntrada: true, dataFechamento: true, status: true }, orderBy: [{ dataEntrada: "asc" }, { id: "asc" }], skip, take })),
      fetchAll((skip, take) => prisma.leadCrm.findMany({ where: { clienteId: c.clienteId, dataEntrada: periodWhere(c, true) }, select: { id: true, etapa: true, ordemEtapa: true, valor: true, dataEntrada: true, dataFechamento: true, status: true }, orderBy: [{ dataEntrada: "asc" }, { id: "asc" }], skip, take })),
    ]);
    const aggregate = (input: typeof leads) => {
      const groups = new Map<string, { etapa: string; ordemEtapa: number | null; count: number; valor: number; fechados: number; ganhos: number }>();
      for (const r of input) {
        const x = groups.get(r.etapa) ?? { etapa: r.etapa, ordemEtapa: r.ordemEtapa, count: 0, valor: 0, fechados: 0, ganhos: 0 };
        x.count++;
        x.valor += n(r.valor);
        x.fechados += r.dataFechamento ? 1 : 0;
        x.ganhos += r.status === "won" ? 1 : 0;
        groups.set(r.etapa, x);
      }
      const etapas = [...groups.values()].sort((x, y) => (x.ordemEtapa ?? 999) - (y.ordemEtapa ?? 999));
      return {
        totalLeads: input.length,
        totalValor: etapas.reduce((sum, item) => sum + item.valor, 0),
        fechados: etapas.reduce((sum, item) => sum + item.fechados, 0),
        ganhos: etapas.reduce((sum, item) => sum + item.ganhos, 0),
        etapas,
      };
    };
    const current = aggregate(leads);
    const previous = aggregate(previousLeads);
    return {
      source: { ...source(name, "Funil CRM", c), coverage: `${leads.length} negócios atuais e ${previousLeads.length} anteriores`, limitations: "Somente agregados por etapa; todos os negócios do período são agregados e nenhum dado pessoal é consultado ou enviado." },
      data: {
        current,
        previous,
        comparison: {
          leadsPct: change(current.totalLeads, previous.totalLeads),
          winsPct: change(current.ganhos, previous.ganhos),
          valuePct: change(current.totalValor, previous.totalValor),
        },
      },
    };
  }
  if (name === "get_analytics_overview") {
    const [daily, previousDaily, channels] = await Promise.all([
      prisma.fatoAnalyticsDiario.aggregate({ where: { clienteId: c.clienteId, data: periodWhere(c) }, _sum: { sessions: true, activeUsers: true, engagedSessions: true, newUsers: true, screenPageViews: true } }),
      prisma.fatoAnalyticsDiario.aggregate({ where: { clienteId: c.clienteId, data: periodWhere(c, true) }, _sum: { sessions: true, activeUsers: true, engagedSessions: true, newUsers: true, screenPageViews: true } }),
      prisma.fatoAnalyticsPorCanal.groupBy({ by: ["canal"], where: { clienteId: c.clienteId, data: periodWhere(c) }, _sum: { sessions: true, activeUsers: true } }),
    ]);
    const current = daily._sum;
    const previous = previousDaily._sum;
    return {
      source: { ...source(name, "Google Analytics", c), coverage: `${channels.length} canais de aquisição`, limitations: "Métricas agregadas; não há dados individuais de visitantes." },
      data: {
        current,
        previous,
        comparison: {
          sessionsPct: change(current.sessions ?? 0, previous.sessions ?? 0),
          activeUsersPct: change(current.activeUsers ?? 0, previous.activeUsers ?? 0),
          engagedSessionsPct: change(current.engagedSessions ?? 0, previous.engagedSessions ?? 0),
        },
        channels: channels.map(x => ({ channel: x.canal, ...x._sum })).sort((x, y) => (y.sessions ?? 0) - (x.sessions ?? 0)).slice(0, 10),
      },
    };
  }
  if (name === "get_business_context") {
    const [client, accounts, goals] = await Promise.all([
      prisma.cliente.findUnique({
        where: { id: c.clienteId },
        select: {
          nome: true,
          segmento: true,
          objetivoMidia: true,
          produtoServico: true,
          modeloNegocio: true,
          publicoAlvo: true,
          objetivoProjeto: true,
          diferenciais: true,
          observacoesAnaliticas: true,
        },
      }),
      prisma.conta.findMany({ where: { clienteId: c.clienteId }, select: { plataforma: true, saldoAtual: true, saldoAtualizadoAt: true } }),
      prisma.meta.findMany({ where: { clienteId: c.clienteId, ano: { in: [...new Set([c.start.getFullYear(), c.previousStart.getFullYear()])] } }, select: { tipoMeta: true, periodicidade: true, ano: true, mes: true, valorMeta: true }, take: 40 }),
    ]);
    return {
      source: { ...source(name, "Contexto comercial", c), coverage: `${goals.length} metas e ${accounts.length} contas`, limitations: "Inclui somente perfil, metas numéricas, orçamento e saldo; sem credenciais ou anotações livres." },
      data: {
        client: {
          ...client,
          analysisObjective: c.analysisObjective,
          analysisObjectiveBasis: c.analysisObjectiveBasis,
          commercialContext: c.commercialContext ?? null,
        },
        budgets: { google: c.orcamentoMidiaGoogleMensal, meta: c.orcamentoMidiaMetaMensal },
        goals: goals.map(g => ({ ...g, valorMeta: n(g.valorMeta) })),
        accountBalances: accounts.map(x => ({ ...x, saldoAtual: finite(x.saldoAtual) })),
      },
    };
  }
  throw new Error(`Ferramenta desconhecida: ${name}`);
}