import assert from "node:assert/strict";
import test from "node:test";
import {
  analystClarificationForQuestion,
  buildAnalystToolPlan,
  buildConversationSummary,
  redactQuestionPII,
  serializeAnalystToolResultForModel,
  shouldUseAnalystComparisonTable,
} from "../lib/analyst/openaiAgent";
import { splitMarkdownTableRow } from "../lib/analyst/markdown";
import type { AnalystPeriodContext } from "../lib/analyst/dataTools";

const context: AnalystPeriodContext = {
  clienteId: "hotel",
  nome: "Conta Hotel",
  segmento: "Hotelaria",
  objetivoMidia: "Vendas",
  analysisObjective: "sales",
  analysisObjectiveBasis: "configured",
  orcamentoMidiaGoogleMensal: null,
  orcamentoMidiaMetaMensal: null,
  start: new Date("2026-09-01T00:00:00-03:00"),
  end: new Date("2026-09-30T23:59:59-03:00"),
  previousStart: new Date("2026-08-01T00:00:00-03:00"),
  previousEnd: new Date("2026-08-31T23:59:59-03:00"),
  startLabel: "2026-09-01",
  endLabel: "2026-09-30",
  previousStartLabel: "2026-08-01",
  previousEndLabel: "2026-08-31",
  channel: "geral",
};

const toolsFor = (question: string) => {
  const parsed = redactQuestionPII(question);
  assert.equal(parsed.unsafe, false);
  return buildAnalystToolPlan(parsed.intent, context).map((item) => item.name);
};

test("golden conversation: sales status stays focused on paid media", () => {
  assert.deepEqual(toolsFor("Como estamos de vendas este mês?"), ["get_media_overview"]);
  assert.deepEqual(toolsFor("E quais campanhas da Meta venderam?"), ["get_campaign_performance"]);
  assert.deepEqual(toolsFor("Qual criativo vendeu mais?"), ["get_creative_performance"]);
});

test("golden conversation: channel follow-up preserves continuity", () => {
  const turns = [
    { role: "USER" as const, content: "Compare as vendas da Meta em setembro." },
    { role: "ASSISTANT" as const, content: "A Meta registrou 24 compras atribuídas." },
    { role: "USER" as const, content: "Quais campanhas venderam?" },
    { role: "ASSISTANT" as const, content: "Hotel Setembro liderou em compras." },
    { role: "USER" as const, content: "E no Google?" },
  ];
  const summary = buildConversationSummary(turns);
  const followUp = redactQuestionPII(turns[4].content);
  assert.match(summary, /Hotel Setembro/);
  assert.equal(followUp.intent.continuity, true);
  assert.ok(followUp.intent.references.includes("mude a análise para Google Ads"));
  assert.ok(toolsFor(turns[4].content).includes("get_media_overview"));
});

test("golden conversation: recommendations require an explicit request", () => {
  const factual = redactQuestionPII("Qual campanha da Meta teve mais compras?").intent;
  const advisory = redactQuestionPII("Onde devemos investir mais e por quê?").intent;
  assert.equal(factual.actions.some((action) => action.includes("recomende")), false);
  assert.equal(advisory.actions.some((action) => action.includes("investimento")), true);
});

test("response format uses tables for broad analysis but not a single metric", () => {
  assert.equal(shouldUseAnalystComparisonTable(redactQuestionPII("Como a conta está indo este mês?").intent), true);
  assert.equal(shouldUseAnalystComparisonTable(redactQuestionPII("Compare apenas o CPL com o período anterior.").intent), false);
});

test("markdown table rows preserve escaped pipes inside campaign names", () => {
  assert.deepEqual(
    splitMarkdownTableRow("| Campanha | Compras | ROAS |"),
    ["Campanha", "Compras", "ROAS"],
  );
  assert.deepEqual(
    splitMarkdownTableRow("| Aquisição \\| Setembro | 12 | 4,2 |"),
    ["Aquisição | Setembro", "12", "4,2"],
  );
});

test("golden conversation: ambiguous cross-platform result asks before querying", () => {
  const question = "Qual campanha teve o melhor resultado?";
  const intent = redactQuestionPII(question).intent;
  assert.equal(
    analystClarificationForQuestion(question, intent),
    "Você quer comparar compras da Meta, conversões do Google Ads ou outra métrica?",
  );
});

test("golden conversation: creative and campaign granularity never collapse", () => {
  assert.deepEqual(toolsFor("Qual criativo teve a maior receita atribuída?"), ["get_creative_performance"]);
  assert.deepEqual(toolsFor("Qual campanha teve a maior receita atribuída?"), ["get_campaign_performance"]);
});

test("month-by-month request preserves monthly granularity through the tool plan", () => {
  const intent = redactQuestionPII("Me dê um detalhamento mês a mês desse ano").intent;
  const plan = buildAnalystToolPlan(intent, context);

  assert.equal(intent.granularity, "month");
  assert.deepEqual(plan, [{
    name: "get_media_overview",
    args: { channel: "geral", granularity: "month" },
  }]);
});

test("period totals remain the default when no time series is requested", () => {
  const intent = redactQuestionPII("Como foi o resultado da conta este ano?").intent;
  assert.equal(intent.granularity, "period");
});

test("large monthly overview payload preserves every requested month", () => {
  const monthly = Array.from({ length: 12 }, (_, index) => ({
    month: `2026-${String(index + 1).padStart(2, "0")}`,
    meta: {
      investimento: 100 + index,
      impressoes: 1_000 + index,
      cliques: 100 + index,
      leads: 10 + index,
      results: index,
      attributedValue: 500 + index,
      ctr: 10,
      cpc: 1,
      cpl: 10,
      costPerResult: index ? (100 + index) / index : null,
      returnOnAdSpend: 5,
    },
    google: {
      investimento: 200 + index,
      impressoes: 2_000 + index,
      cliques: 200 + index,
      leads: 0,
      results: 20 + index,
      attributedValue: 800 + index,
      ctr: 10,
      cpc: 1,
      cpl: null,
      costPerResult: 10,
      returnOnAdSpend: 4,
    },
  }));
  const serialized = serializeAnalystToolResultForModel("get_media_overview", {
    source: { tool: "get_media_overview", label: "Visão geral", period: { start: "2026-01-01", end: "2026-12-31" } },
    data: {
      channel: "geral",
      granularity: "month",
      resultTerminology: "métricas separadas por plataforma",
      metricCoverage: {},
      current: { monthly, daily: Array.from({ length: 100 }, () => ({ detail: "x".repeat(500) })) },
      previous: { monthly, daily: [] },
    },
  });

  assert.ok(Buffer.byteLength(serialized, "utf8") <= 12_000);
  const payload = JSON.parse(serialized);
  assert.equal(payload.data.current.monthly.length, 12);
  assert.equal(payload.data.current.monthly[0].month, "2026-01");
  assert.equal(payload.data.current.monthly[11].month, "2026-12");
});

test("campaign payload remains valid and declares byte-budget truncation", () => {
  const campaigns = Array.from({ length: 140 }, (_, index) => ({
    campaignId: `campaign-${index}`,
    campaignName: `Campanha ${index} ${"nome longo ".repeat(18)}`,
    purchases: 140 - index,
    cost: 100 + index,
    revenue: 500 + index,
  }));
  const serialized = serializeAnalystToolResultForModel("get_campaign_performance", {
    source: { tool: "get_campaign_performance", label: "Campanhas Meta" },
    data: {
      platform: "META",
      metric: "RESULTS",
      direction: "BEST",
      totalMatchingCount: campaigns.length,
      returnedCount: 100,
      truncated: true,
      campaigns: campaigns.slice(0, 100),
      omitted: { count: 40 },
    },
  });
  assert.ok(Buffer.byteLength(serialized, "utf8") <= 12_000);
  const payload = JSON.parse(serialized);
  assert.equal(payload.data.totalMatchingCount, 140);
  assert.equal(payload.data.truncated, true);
  assert.equal(payload.data.omittedCount, 140 - payload.data.returnedCount);
  assert.ok(payload.data.returnedCount > 0);
});

test("small campaign payload preserves evidence needed for recommendations", () => {
  const result = {
    source: { tool: "get_campaign_performance", label: "Campanhas Meta" },
    data: {
      platform: "META",
      metric: "ROAS",
      direction: "BEST",
      campaigns: [{
        campaignId: "campaign-1",
        campaignName: "Hotel Setembro",
        cost: 1200,
        purchases: 24,
        revenue: 9600,
        roas: 8,
        state: "continuing",
        campaignRole: "prospecting",
        comparison: { costPct: 10, purchasesPct: 20, revenuePct: 30 },
      }],
      oppositeCampaigns: [],
      omitted: { count: 0 },
    },
  };
  const payload = JSON.parse(serializeAnalystToolResultForModel("get_campaign_performance", result));
  assert.equal(payload.data.campaigns[0].cost, 1200);
  assert.equal(payload.data.campaigns[0].comparison.revenuePct, 30);
  assert.equal(payload.data.campaigns[0].state, "continuing");
  assert.equal(payload.data.campaigns[0].campaignRole, "prospecting");
});