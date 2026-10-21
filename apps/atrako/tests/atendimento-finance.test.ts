import assert from "node:assert/strict";
import test from "node:test";
import { financeDaily, financeRows, financeTotals, type LedgerLike } from "../lib/atendimento/finance-view";
import { parsePeriod, previousPeriod } from "../lib/atendimento/period";

const entry = (over: Partial<LedgerLike>): LedgerLike => ({
  id: Math.random().toString(36).slice(2),
  type: "INCOME",
  status: "CONFIRMED",
  amount: 0,
  occurredAt: new Date("2026-10-10T15:00:00Z"),
  source: "crm",
  description: null,
  provider: null,
  leadId: null,
  contact: null,
  ...over,
});

test("período em datas de Brasília e período anterior do mesmo tamanho", () => {
  const p = parsePeriod(new URLSearchParams("dataInicio=2026-10-01&dataFim=2026-10-10"));
  assert.equal(p.days, 10);
  assert.equal(p.gte.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(p.lte.toISOString(), "2026-10-11T02:59:59.999Z");
  const prev = previousPeriod(p);
  assert.equal(prev.from, "2026-09-21");
  assert.equal(prev.to, "2026-09-30");

  const last7 = parsePeriod(new URLSearchParams("periodo=7"), 30, new Date("2026-10-21T02:00:00Z"));
  assert.equal(last7.to, "2026-10-20");
  assert.equal(last7.from, "2026-10-14");
});

test("financeiro: entradas do caixa contra mídia e saídas", () => {
  const ledger = [
    entry({ amount: 4900, leadId: "l1" }),
    entry({ amount: 1000, source: "manual" }),
    entry({ type: "REFUND", amount: 400 }),
    entry({ type: "EXPENSE", amount: 300, source: "manual" }),
    entry({ amount: 999, status: "CANCELED" }),
  ];
  const spend = [
    { date: "2026-10-10", canal: "META", amount: 120.5 },
    { date: "2026-10-10", canal: "META", amount: 79.5 },
    { date: "2026-10-11", canal: "META", amount: 100 },
  ];
  const t = financeTotals(ledger, spend);
  assert.equal(t.income, 5900);
  assert.equal(t.refund, 400);
  assert.equal(t.adSpend, 300);
  assert.equal(t.costs, 600);
  assert.equal(t.net, 4900);
  assert.equal(t.sales, 1);
  assert.equal(t.roas, 18.33);
  assert.equal(t.costPerSale, 300);

  const daily = financeDaily({ from: "2026-10-09", to: "2026-10-11" }, ledger, spend);
  assert.deepEqual(daily, [
    { date: "2026-10-09", income: 0, costs: 0 },
    { date: "2026-10-10", income: 5500, costs: 500 },
    { date: "2026-10-11", income: 0, costs: 100 },
  ]);

  const rows = financeRows(ledger, spend);
  const ads = rows.filter((r) => r.kind === "ads");
  assert.equal(ads.length, 2);
  assert.equal(ads.find((r) => r.date === "2026-10-10")?.amount, 200);
  assert.equal(rows.some((r) => r.amount === 999), false);
});

test("sem mídia não inventa ROAS nem custo por venda", () => {
  const t = financeTotals([entry({ amount: 100 })], []);
  assert.equal(t.roas, null);
  assert.equal(t.costPerSale, null);
});
