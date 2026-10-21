import assert from "node:assert/strict";
import test from "node:test";
import {
  biggestDrop,
  buildFunnel,
  buildOrigins,
  leadFunnelLevel,
  periodResult,
  periodSentence,
  type InicioLead,
} from "../lib/atendimento/inicio-view";

const lead = (over: Partial<InicioLead & { originLabel: string }>): InicioLead & { originLabel: string } => ({
  status: "OPEN",
  stageRole: "ENTRY",
  source: "regicenter-lp",
  campaign: null,
  answered: false,
  priority: null,
  meeting: false,
  originLabel: "Landing page",
  ...over,
});

test("funil: alcançar uma etapa conta nas anteriores", () => {
  const leads = [
    lead({}),
    lead({ answered: true }),
    lead({ answered: true, priority: "C" }),
    lead({ answered: true, priority: "B" }),
    lead({ priority: "A", meeting: true }),
    lead({ status: "WON", stageRole: "WON" }),
  ];
  assert.deepEqual(leads.map(leadFunnelLevel), [0, 1, 1, 2, 3, 4]);
  const funnel = buildFunnel(leads);
  assert.deepEqual(
    funnel.map((s) => [s.count, s.rate]),
    [
      [6, null],
      [5, 83],
      [3, 60],
      [2, 67],
      [1, 50],
    ],
  );
  assert.deepEqual(biggestDrop(funnel), {
    from: "Responderam a qualificação",
    to: "Qualificados (quentes e interessados)",
    lost: 2,
    rate: 60,
  });
});

test("lead perdido não conta como em conversa", () => {
  assert.equal(leadFunnelLevel(lead({ stageRole: "LOST", answered: true })), 1);
  assert.equal(leadFunnelLevel(lead({ stageRole: "NEGOTIATION" })), 3);
});

test("origens cruzam campanha com investimento pelo nome", () => {
  const rows = buildOrigins(
    [
      lead({ campaign: "Franquia | LP", priority: "A" }),
      lead({ campaign: "franquia | lp", priority: "B", status: "WON" }),
      lead({ originLabel: "WhatsApp" }),
    ],
    new Map([
      ["Franquia | LP", 300],
      ["Campanha sem lead", 50],
    ]),
  );
  const camp = rows.find((r) => r.key === "franquia | lp")!;
  assert.equal(camp.leads, 2);
  assert.equal(camp.hot, 1);
  assert.equal(camp.qualified, 2);
  assert.equal(camp.won, 1);
  assert.equal(camp.spend, 300);
  assert.equal(camp.cpl, 150);
  assert.equal(rows.find((r) => r.key === "whatsapp")?.spend, null);
  assert.equal(rows.find((r) => r.key === "campanha sem lead")?.leads, 0);
});

test("resumo do período em uma frase", () => {
  const r = periodResult({
    leads: [lead({ priority: "A" }), lead({ priority: "B" }), lead({})],
    revenue: 4900,
    spend: 300,
    won: 1,
  });
  assert.equal(r.cpl, 100);
  assert.equal(r.costPerSale, 300);
  assert.equal(
    periodSentence(r).replace(/\u00a0/g, " "),
    "3 leads novos, 2 qualificados, 1 venda (R$ 4.900). Investimento de R$ 300, R$ 100 por lead.",
  );
  assert.equal(periodSentence(periodResult({ leads: [], revenue: 0, spend: 0, won: 0 })), "Nenhum lead novo no período.");
});
