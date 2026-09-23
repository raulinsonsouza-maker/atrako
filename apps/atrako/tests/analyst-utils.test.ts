import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYST_TOOL_DEFINITIONS,
  analystLocalDate,
  campaignMetricValue,
  currentObjectiveResultValues,
  rankCampaignsByMetric,
  rankingWinnerEvidence,
  resolveAccountAnalysisObjective,
  resolveCampaignObjective,
  objectiveResultMetadata,
  mediaTotalsComparison,
  type CampaignMetricValues,
} from "../lib/analyst/dataTools";
import {
  buildConversationSummary,
  buildAnalystToolPlan,
  ANALYST_OPERATING_CONTEXT,
  analystPlannerUsage,
  analystPlannerValidationError,
  parseAnalystIntent,
  prepareAnalystQuestion,
  protectConversationTitle,
  redactQuestionPII,
  renderAnalystIntent,
  renderAnalystPrompt,
  renderAnalystCommercialContext,
  sanitizeQuestion,
  serializeAnalystIntent,
} from "../lib/analyst/openaiAgent";
import { relativeAnalystPeriod, saoPauloCalendarDate } from "../lib/hotelAnalysis";
import { validateCommercialContext } from "../lib/admin/clientContext";

const salesContext = {
  clienteId: "client",
  nome: "Conta",
  segmento: "Hotel",
  objetivoMidia: "ecommerce",
  analysisObjective: "sales" as const,
  analysisObjectiveBasis: "configured" as const,
  orcamentoMidiaGoogleMensal: null,
  orcamentoMidiaMetaMensal: null,
  start: new Date(2026, 8, 1),
  end: new Date(2026, 8, 9),
  previousStart: new Date(2026, 7, 1),
  previousEnd: new Date(2026, 7, 9),
  startLabel: "2026-09-01",
  endLabel: "2026-09-09",
  previousStartLabel: "2026-08-01",
  previousEndLabel: "2026-08-09",
  channel: "geral" as const,
};

test("commercial context is bounded, normalized and renders missing fields explicitly", () => {
  assert.throws(() => validateCommercialContext({
    produtoServico: " Hotel\u0000 com  experiências ",
    modeloNegocio: "reservas",
    objetivoProjeto: "x".repeat(1001),
  }), /objetivoProjeto.*1000/);
  const valid = validateCommercialContext({
    produtoServico: " Hotel\u0000 com  experiências ",
    objetivoProjeto: null,
  });
  const rendered = renderAnalystCommercialContext(valid);
  assert.match(rendered, /Hotel com experiências/);
  assert.match(rendered, /Modelo de negócio/);
  assert.match(rendered, /não informado/);
  assert.doesNotMatch(rendered, /<script|<\/commercial_context>/i);
});

test("planner validation errors retain billable usage without exposing model output", () => {
  const error = analystPlannerValidationError("A IA retornou um plano analítico inválido", {
    prompt: 37,
    completion: 19,
    total: 56,
  });
  assert.deepEqual(analystPlannerUsage(error), { prompt: 37, completion: 19, total: 56 });
  assert.doesNotMatch(error.message, /model|raw|segredo/i);
});

test("agent operating context explains its role, data catalog and hard limitations", () => {
  assert.match(ANALYST_OPERATING_CONTEXT, /InPilot, analista de contas interno/);
  assert.match(ANALYST_OPERATING_CONTEXT, /Meta Ads/);
  assert.match(ANALYST_OPERATING_CONTEXT, /Google Ads/);
  assert.match(ANALYST_OPERATING_CONTEXT, /CRM/);
  assert.match(ANALYST_OPERATING_CONTEXT, /Google Analytics/);
  assert.match(ANALYST_OPERATING_CONTEXT, /Contexto comercial/);
  assert.match(ANALYST_OPERATING_CONTEXT, /não prova causalidade/i);
  assert.match(ANALYST_OPERATING_CONTEXT, /Não existem receita financeira conciliada/);
});

test("broad account analysis uses overview, CRM, Analytics and business context", () => {
  const intent = parseAnalystIntent({
    version: 1,
    topics: [
      "mídia e campanhas da Meta",
      "mídia e campanhas do Google Ads",
      "funil agregado do CRM",
      "Analytics agregado",
      "resultados e valor atribuído",
      "metas, orçamento e saldo",
    ],
    metrics: [],
    actions: ["analise fatos, interpretação e próximos passos"],
    references: [],
    constraints: [],
    continuity: false,
    ranking: null,
  });
  assert.ok(intent);
  assert.deepEqual(buildAnalystToolPlan(intent, salesContext).map((item) => item.name), [
    "get_media_overview",
    "get_crm_funnel",
    "get_analytics_overview",
    "get_business_context",
  ]);
});

test("literal account-wide scope overrides a prior single-channel context", () => {
  const intent = prepareAnalystQuestion("Como a conta está indo esse mês?").intent;
  assert.deepEqual(buildAnalystToolPlan(intent, {
    ...salesContext,
    accountWide: true,
    hasGoogleCampaigns: true,
    hasCrmData: true,
    hasAnalyticsData: true,
  }).map((item) => [item.name, item.args.channel ?? null]), [
    ["get_media_overview", "geral"],
    ["get_crm_funnel", null],
    ["get_analytics_overview", null],
    ["get_business_context", null],
  ]);
});

test("absent Google and CRM sources are excluded from every tool context", () => {
  const intent = prepareAnalystQuestion("Como estamos com as campanhas?").intent;
  const tools = buildAnalystToolPlan(intent, {
    ...salesContext,
    hasGoogleCampaigns: false,
    hasCrmData: false,
  });
  assert.deepEqual(tools.map((item) => [item.name, item.args.channel ?? item.args.platform ?? null]), [
    ["get_campaign_performance", "META"],
    ["get_media_overview", "meta"],
  ]);
});

test("specific Meta questions do not receive unrelated available sources", () => {
  const intent = prepareAnalystQuestion("Qual campanha da Meta vendeu mais?").intent;
  const tools = buildAnalystToolPlan(intent, {
    ...salesContext,
    hasGoogleCampaigns: true,
    hasCrmData: true,
  });
  assert.deepEqual(tools.map((item) => [item.name, item.args.channel ?? item.args.platform ?? null]), [
    ["get_campaign_performance", "META"],
  ]);
});

test("complete account analysis can use all six closed data sources", () => {
  const intent = parseAnalystIntent({
    version: 1,
    topics: [
      "mídia e campanhas da Meta",
      "mídia e campanhas do Google Ads",
      "funil agregado do CRM",
      "Analytics agregado",
      "resultados e valor atribuído",
      "metas, orçamento e saldo",
      "performance de campanhas",
    ],
    metrics: ["ROAS", "compras", "conversões"],
    actions: ["analise fatos, interpretação e próximos passos"],
    references: [],
    constraints: [],
    continuity: false,
    ranking: null,
  });
  assert.ok(intent);
  assert.deepEqual(buildAnalystToolPlan(intent, salesContext).map((item) => item.name), [
    "get_campaign_performance",
    "get_campaign_performance",
    "get_media_overview",
    "get_crm_funnel",
    "get_analytics_overview",
    "get_business_context",
  ]);
});

test("plural sales question fetches enough campaigns and stays objective", () => {
  const intent = parseAnalystIntent({
    version: 1,
    topics: ["performance de campanhas", "mídia e campanhas da Meta"],
    metrics: ["compras"],
    actions: ["responda objetivamente à pergunta", "liste todas as campanhas com resultado"],
    references: [],
    constraints: [],
    continuity: false,
    ranking: null,
  });
  assert.ok(intent);
  assert.deepEqual(buildAnalystToolPlan(intent, salesContext), [{
    name: "get_campaign_performance",
    args: { platform: "META", limit: 100, metric: "RESULTS", direction: "BEST", onlyPositive: true },
  }]);
});

test("sanitizeQuestion removes control characters and limits prompt size", () => {
  const raw = `  pergunta\u0000com\u0007controle ${"x".repeat(1_100)}  `;
  const result = sanitizeQuestion(raw);

  assert.equal(result.includes("\u0000"), false);
  assert.equal(result.includes("\u0007"), false);
  assert.equal(result.length, 1_000);
});

test("buildConversationSummary uses only the twelve most recent messages", () => {
  const messages = Array.from({ length: 14 }, (_, index) => ({
    role: index % 2 === 0 ? "USER" as const : "ASSISTANT" as const,
    content: `mensagem-${index}`,
  }));
  const summary = buildConversationSummary(messages, "contexto anterior");

  assert.match(summary, /contexto anterior/);
  assert.doesNotMatch(summary, /mensagem-0(?:\n|$)/);
  assert.doesNotMatch(summary, /mensagem-1(?:\n|$)/);
  assert.match(summary, /mensagem-2(?:\n|$)/);
  assert.match(summary, /mensagem-9(?:\n|$)/);
  assert.match(summary, /mensagem-13(?:\n|$)/);
  assert.ok(summary.length <= 7_000);
});

test("buildConversationSummary keeps the latest assistant recommendations intact", () => {
  const answer = `Fatos observados\\n${"contexto ".repeat(80)}\\nRecomendações priorizadas\\n1. primeira ação\\n2. SEGUNDA_RECOMENDACAO_COMPLETA`;
  const summary = buildConversationSummary([
    { role: "USER", content: redactQuestionPII("Compare o ROAS").text },
    { role: "ASSISTANT", content: answer },
  ]);

  assert.match(summary, /SEGUNDA_RECOMENDACAO_COMPLETA/);
  assert.equal(summary.includes(answer), true);
});

test("redactQuestionPII converts free text into a controlled analytical request", () => {
  const result = redactQuestionPII("De 2026-09-01 a 2026-09-09, veja test@example.com, CPF 123.456.789-01 e telefone (11) 99999-8888.");

  assert.equal(result.redacted, true);
  assert.equal(result.unsafe, true);
  assert.doesNotMatch(result.text, /test@example\.com/);
  assert.doesNotMatch(result.text, /123\.456\.789-01/);
  assert.doesNotMatch(result.text, /99999-8888/);
  assert.doesNotMatch(result.text, /fontes estruturadas/);
  assert.match(renderAnalystPrompt(result.intent), /fontes estruturadas/);
});

test("redactQuestionPII flags free-form names and addresses for rejection", () => {
  assert.equal(redactQuestionPII("Analise as reservas de João da Silva").unsafe, true);
  assert.equal(redactQuestionPII("analise as reservas de joão da silva").unsafe, true);
  assert.equal(redactQuestionPII("joão da silva").unsafe, true);
  assert.equal(redactQuestionPII("Veja o hóspede chamado Roberto").unsafe, true);
  assert.equal(redactQuestionPII("Compare o endereço Rua das Flores, 100").unsafe, true);
  assert.equal(redactQuestionPII("compare o endereço av. paulista, 100").unsafe, true);
  assert.equal(redactQuestionPII("Compare Meta Ads e Google Ads para a Conta Hotel").unsafe, false);
});

test("controlled request never carries unknown free-form names", () => {
  const result = redactQuestionPII("Compare a eficiência e depois avalie maria silva na campanha XPTO");

  assert.doesNotMatch(result.text, /maria|silva|XPTO/i);
  assert.match(result.text, /eficiência de investimento/);
});

test("structured intent survives retry without losing metrics or direction", () => {
  const increase = redactQuestionPII("Aumente o orçamento em 15% e priorize ROAS e receita");
  const decrease = redactQuestionPII("Reduza o orçamento em 15% e priorize ROAS e receita");
  const retry = prepareAnalystQuestion(increase.retryToken);

  assert.deepEqual(retry.intent, increase.intent);
  assert.equal(renderAnalystIntent(retry.intent), increase.text);
  assert.match(retry.text, /ROAS/);
  assert.match(retry.text, /receita/);
  assert.match(retry.text, /aumentar o investimento/);
  assert.match(decrease.text, /reduzir o investimento/);
  assert.notEqual(increase.text, decrease.text);
  assert.match(increase.text, /15%/);
});

test("structured request displays a concise user-facing question", () => {
  const result = redactQuestionPII("Como está o ROAS das campanhas Meta?");

  assert.equal(result.originalText, "Como está o ROAS das campanhas Meta?");
  assert.match(result.text, /ROAS/);
  assert.match(result.text, /Meta/);
  assert.doesNotMatch(result.text, /dados pessoais|fontes estruturadas/);
  assert.match(renderAnalystPrompt(result.intent), /dados pessoais|fontes estruturadas/);
});

test("yesterday question preserves its meaning and overrides the selected period", () => {
  const result = redactQuestionPII("como foi o dia de ontem");
  const period = relativeAnalystPeriod(result.intent.constraints, new Date("2026-09-10T11:34:00Z"));

  assert.equal(result.text, "Como foi o desempenho de ontem?");
  assert.deepEqual(result.intent.constraints, ["limite o período a ontem"]);
  assert.equal(period?.start.getFullYear(), 2026);
  assert.equal(period?.start.getMonth(), 8);
  assert.equal(period?.start.getDate(), 9);
  assert.equal(period?.end.getDate(), 9);
  assert.equal(result.intent.actions.includes("compare com o período anterior"), true);
  assert.equal(result.intent.actions.includes("identifique os principais destaques"), true);
});

test("daily media comparison exposes decision-relevant changes", () => {
  const comparison = mediaTotalsComparison(
    {
      impressoes: 0, cliques: 0, investimento: 1704.49, leads: 38, results: 0,
      attributedValue: 0, cpl: 44.86, costPerResult: null, returnOnAdSpend: null,
    },
    {
      impressoes: 0, cliques: 0, investimento: 1312.55, leads: 41, results: 4,
      attributedValue: 14401.49, cpl: 32.01, costPerResult: 328.14, returnOnAdSpend: 10.97,
    },
  );

  assert.ok(comparison.investmentPct != null && comparison.investmentPct > 29);
  assert.ok(comparison.leadsPct != null && comparison.leadsPct < -7);
  assert.equal(comparison.resultsDelta, -4);
  assert.equal(comparison.attributedValueDelta, -14401.49);
  assert.ok(comparison.cplPct != null && comparison.cplPct > 40);
});

test("chat calendar uses Sao Paulo instead of the page date filter", () => {
  const date = saoPauloCalendarDate(new Date("2026-09-11T01:30:00Z"));
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 8);
  assert.equal(date.getDate(), 10);
});

test("common temporal questions define their own analysis period", () => {
  const now = new Date("2026-09-10T14:00:00Z");
  const todayIntent = redactQuestionPII("como foi hoje").intent;
  const weekIntent = redactQuestionPII("como foi esta semana").intent;
  const monthIntent = redactQuestionPII("analise este mês").intent;
  const rollingIntent = redactQuestionPII("compare os últimos 30 dias").intent;
  const conversationalWeekIntent = redactQuestionPII("e essa semana como foi o desempenho ?").intent;

  assert.deepEqual(relativeAnalystPeriod(todayIntent.constraints, now), {
    start: new Date(2026, 8, 10), end: new Date(2026, 8, 10),
  });
  assert.deepEqual(relativeAnalystPeriod(weekIntent.constraints, now), {
    start: new Date(2026, 8, 7), end: new Date(2026, 8, 10),
  });
  assert.deepEqual(relativeAnalystPeriod(monthIntent.constraints, now), {
    start: new Date(2026, 8, 1), end: new Date(2026, 8, 10),
  });
  assert.deepEqual(relativeAnalystPeriod(rollingIntent.constraints, now), {
    start: new Date(2026, 7, 12), end: new Date(2026, 8, 10),
  });
  assert.deepEqual(relativeAnalystPeriod(conversationalWeekIntent.constraints, now), {
    start: new Date(2026, 8, 7), end: new Date(2026, 8, 10),
  });
});

test("analyst source dates preserve the selected local calendar day", () => {
  assert.equal(analystLocalDate(new Date(2026, 8, 1, 0, 0, 0)), "2026-09-01");
});

test("structured intent preserves an ordinal follow-up reference", () => {
  const result = redactQuestionPII("Aprofunde a segunda recomendação e compare o CPA");

  assert.equal(result.intent.continuity, true);
  assert.match(result.text, /segunda recomendação anterior/);
  assert.match(result.text, /CPA/);
});

test("best and worst campaign questions remain opposite structured intents", () => {
  const best = redactQuestionPII("Qual campanha tem o melhor ROAS?");
  const worst = redactQuestionPII("Qual campanha tem o pior ROAS?");

  assert.equal(best.intent.ranking, "best");
  assert.equal(worst.intent.ranking, "worst");
  assert.notEqual(best.text, worst.text);
});

test("intent parser rejects and serializer strips no extra properties", () => {
  const valid = redactQuestionPII("Compare o ROAS das campanhas Meta").intent;
  const withExtra = { ...valid, marker: "NAO_PERSISTIR" };
  const forgedToken = `analyst-intent-v1:${Buffer.from(JSON.stringify(withExtra)).toString("base64url")}`;

  assert.equal(parseAnalystIntent(withExtra), null);
  assert.equal(parseAnalystIntent(forgedToken), null);
  assert.throws(() => serializeAnalystIntent(withExtra as typeof valid), /inválida/);
});

test("safe conversation titles can be renamed without persisting arbitrary text", () => {
  assert.deepEqual(protectConversationTitle("Performance Meta"), { text: "Análise · Meta", unsafe: false });
  assert.equal(protectConversationTitle("joão da silva").unsafe, true);
});

test("analyst exposes only closed, strict data tools", () => {
  const names = ANALYST_TOOL_DEFINITIONS.map((tool) => tool.function.name);

  assert.deepEqual(names, [
    "get_media_overview",
    "get_campaign_performance",
    "get_creative_performance",
    "get_crm_funnel",
    "get_analytics_overview",
    "get_business_context",
  ]);
  for (const tool of ANALYST_TOOL_DEFINITIONS) {
    assert.equal(tool.function.strict, true);
    assert.equal(tool.function.parameters.additionalProperties, false);
  }
});

test("creative sales question uses creative data instead of campaign data", () => {
  const intent = parseAnalystIntent({
    version: 1,
    topics: ["performance de criativos"],
    metrics: ["compras"],
    actions: ["responda objetivamente à pergunta"],
    references: [],
    constraints: [],
    continuity: false,
    ranking: "best",
  });
  assert.ok(intent);
  assert.deepEqual(buildAnalystToolPlan(intent, salesContext), [{
    name: "get_creative_performance",
    args: { limit: 1, metric: "RESULTS", direction: "BEST" },
  }]);
});

test("zero-return campaigns keep ROAS zero and rank as worst on both platforms", () => {
  const zero: CampaignMetricValues = { campaignId: "zero", cost: 100, clicks: 10, leads: 2, actions: 1, results: 1, attributedValue: 0 };
  const positive: CampaignMetricValues = { campaignId: "positive", cost: 100, clicks: 10, leads: 2, actions: 1, results: 1, attributedValue: 200 };
  const noSpend: CampaignMetricValues = { campaignId: "no-spend", cost: 0, clicks: 0, leads: 0, actions: 0, results: 0, attributedValue: 0 };

  for (const platform of ["META", "GOOGLE"] as const) {
    assert.equal(campaignMetricValue(zero, "ROAS", platform), 0);
    assert.equal(campaignMetricValue(noSpend, "ROAS", platform), null);
    assert.equal(rankCampaignsByMetric([positive, zero, noSpend], "ROAS", "WORST", platform, (item) => item)[0].campaignId, "zero");
    assert.equal(rankCampaignsByMetric([positive, zero, noSpend], "ROAS", "BEST", platform, (item) => item)[0].campaignId, "positive");
  }
});

test("CPC, CPL and CPA use distinct denominators and rankings", () => {
  const rows: CampaignMetricValues[] = [
    { campaignId: "best-cpc", cost: 100, clicks: 100, leads: 5, actions: 1, results: 5, attributedValue: 0 },
    { campaignId: "best-cpl", cost: 100, clicks: 10, leads: 20, actions: 5, results: 20, attributedValue: 0 },
    { campaignId: "best-cpa", cost: 100, clicks: 20, leads: 10, actions: 20, results: 20, attributedValue: 0 },
  ];

  assert.equal(rankCampaignsByMetric(rows, "CPC", "BEST", "META", (item) => item)[0].campaignId, "best-cpc");
  assert.equal(rankCampaignsByMetric(rows, "CPL", "BEST", "META", (item) => item)[0].campaignId, "best-cpl");
  assert.equal(rankCampaignsByMetric(rows, "CPA", "BEST", "META", (item) => item)[0].campaignId, "best-cpa");
  assert.equal(campaignMetricValue(rows[0], "CPL", "GOOGLE"), null);
});

test("zero-spend attributed activity is not treated as free CPA, CPC or CPL", () => {
  const values: CampaignMetricValues = {
    campaignId: "attributed-later",
    cost: 0,
    clicks: 10,
    leads: 4,
    actions: 2,
    results: 2,
    attributedValue: 500,
  };

  assert.equal(campaignMetricValue(values, "CPA", "META"), null);
  assert.equal(campaignMetricValue(values, "CPC", "META"), null);
  assert.equal(campaignMetricValue(values, "CPL", "META"), null);
});

test("sales objectives recognize commerce vocabulary beyond ecommerce", () => {
  for (const objective of ["ecommerce", "e-commerce", "vendas", "compras", "receita", "ROAS"]) {
    assert.deepEqual(resolveAccountAnalysisObjective(objective), {
      objective: "sales",
      basis: "configured",
    });
  }
});

test("observed purchases and attributed revenue override a stale leads objective", () => {
  assert.deepEqual(resolveAccountAnalysisObjective("leads", {
    purchases: 22,
    attributedValue: 113_231.36,
  }), {
    objective: "sales",
    basis: "observed-commerce",
  });
  assert.deepEqual(resolveAccountAnalysisObjective("leads", {
    purchases: 1,
    attributedValue: 4_000,
  }), {
    objective: "leads",
    basis: "configured",
  });
});

test("sales questions preserve the requested campaign metric", () => {
  const mostSales = redactQuestionPII("Qual campanha vendeu mais?");
  const mostRevenue = redactQuestionPII("Qual campanha teve a maior receita?");

  assert.deepEqual(mostSales.intent.metrics, ["compras"]);
  assert.equal(mostSales.intent.ranking, "best");
  assert.deepEqual(mostRevenue.intent.metrics, ["receita"]);
  assert.equal(mostRevenue.intent.ranking, "best");
  assert.equal(mostSales.text, "Qual campanha teve o maior número de compras?");
  assert.equal(mostRevenue.text, "Qual campanha teve a maior receita?");
});

test("lower acquisition cost means best performance, not worst", () => {
  const lowestCpa = redactQuestionPII("Qual campanha teve o menor CPA?");
  const highestCpa = redactQuestionPII("Qual campanha teve o maior CPA?");

  assert.equal(lowestCpa.intent.ranking, "best");
  assert.equal(highestCpa.intent.ranking, "worst");
  assert.equal(lowestCpa.text, "Qual campanha teve o menor CPA?");
  assert.equal(highestCpa.text, "Qual campanha teve o maior CPA?");
});

test("campaign lead questions do not automatically become CRM questions", () => {
  const result = redactQuestionPII("Qual campanha Meta gerou mais leads?");

  assert.deepEqual(result.intent.metrics, ["leads"]);
  assert.equal(result.intent.topics.includes("funil agregado do CRM"), false);
  assert.equal(result.intent.topics.includes("mídia e campanhas da Meta"), true);
});

test("WhatsApp campaigns use conversations as the result even when leads are zero", () => {
  const objective = resolveCampaignObjective({
    campaignObjective: "OUTCOME_MESSAGES",
    accountObjective: "leads",
    observed: { conversations: 17, leads: 0 },
  });
  assert.deepEqual(objective, {
    objective: "messaging",
    source: "campaign-configured",
    resultKey: "conversations",
    resultLabel: "conversas iniciadas",
    supported: true,
  });
  const metadata = objectiveResultMetadata(objective, { conversations: 17, leads: 0 });
  assert.equal(metadata.primaryResult, "conversations");
  assert.equal(metadata.primaryResultValue, 17);
  assert.equal(metadata.primaryResultState, "available");
});

test("objective resolution keeps zero distinct from an unavailable result", () => {
  const objective = resolveCampaignObjective({ campaignObjective: "mensagens" });
  assert.equal(objective.resultKey, "conversations");
  assert.equal(objectiveResultMetadata(objective, { conversations: 0 }).primaryResultState, "zero");
  assert.equal(objectiveResultMetadata(objective, {}).primaryResultState, "unavailable");
});

test("clicks do not silently reclassify a lead account as traffic", () => {
  assert.deepEqual(resolveCampaignObjective({
    accountObjective: "leads",
    observed: { clicks: 62, impressions: 20_000, leads: 0 },
  }), {
    objective: "leads",
    source: "account-configured",
    resultKey: "leads",
    resultLabel: "leads",
    supported: true,
  });
});

test("zero business outcomes do not produce a best item", () => {
  const rows: CampaignMetricValues[] = [
    { campaignId: "cheap-click", cost: 40, clicks: 20, leads: 0, actions: 0, results: 0, attributedValue: 0 },
    { campaignId: "expensive-click", cost: 60, clicks: 10, leads: 0, actions: 0, results: 0, attributedValue: 0 },
  ];

  assert.deepEqual(rankingWinnerEvidence(rows, "CPL", "META"), {
    winnerStatus: "no_positive_business_outcome",
    eligibleWinnerCount: 0,
    rankingEligible: false,
    decisionSignal: {
      code: "INSUFFICIENT_BUSINESS_OUTCOME",
      confidence: "high",
      message: "Não há resultado de negócio positivo suficiente para declarar um melhor item nesta métrica.",
    },
  });
  assert.equal(rankingWinnerEvidence(rows, "CPC", "META").winnerStatus, "eligible");
});

test("messaging results are eligible even when lead count is zero", () => {
  const messaging: CampaignMetricValues = {
    campaignId: "whatsapp",
    cost: 100,
    clicks: 25,
    leads: 0,
    actions: 17,
    results: 17,
    attributedValue: 0,
  };
  assert.equal(rankingWinnerEvidence([messaging], "RESULTS", "META").winnerStatus, "eligible");
});

test("a stopped creative cannot reuse previous-period results as current evidence", () => {
  const current = currentObjectiveResultValues(undefined);
  const objective = resolveCampaignObjective({
    campaignObjective: "OUTCOME_MESSAGES",
    accountObjective: "leads",
    observed: current,
  });
  const metadata = objectiveResultMetadata(objective, current);
  const values: CampaignMetricValues = {
    campaignId: "stopped-whatsapp",
    cost: 0,
    clicks: 0,
    leads: 0,
    actions: metadata.primaryResultValue ?? 0,
    results: metadata.primaryResultValue ?? 0,
    attributedValue: 0,
  };

  assert.equal(metadata.primaryResult, "conversations");
  assert.equal(metadata.primaryResultValue, 0);
  assert.equal(rankingWinnerEvidence([values], "RESULTS", "META").winnerStatus, "no_positive_business_outcome");
});

test("purchase campaign questions query only Meta purchases", () => {
  const intent = redactQuestionPII("Qual campanha teve o maior número de compras?").intent;
  const plan = buildAnalystToolPlan(intent, salesContext);

  assert.deepEqual(plan, [{
    name: "get_campaign_performance",
    args: { platform: "META", limit: 1, metric: "RESULTS", direction: "BEST", onlyPositive: false },
  }]);
});

test("broad sales campaign analysis uses one Meta ranking and one overview", () => {
  const intent = redactQuestionPII("Analise a performance das campanhas e recomende onde investir.").intent;
  const plan = buildAnalystToolPlan(intent, salesContext);

  assert.equal(intent.actions.includes("recomende alocação de investimento"), true);
  assert.deepEqual(plan, [
    { name: "get_campaign_performance", args: { platform: "META", limit: 3, metric: "ROAS", direction: "BEST", onlyPositive: false } },
    { name: "get_media_overview", args: { channel: "geral", granularity: "period" } },
  ]);
});