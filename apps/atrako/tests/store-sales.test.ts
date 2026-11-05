import assert from "node:assert/strict";
import test from "node:test";
import { applySeriesSales, overlayCampaignSales, salesForCanal, sumSales, type StoreSale } from "../lib/commerce-attribution/store-sales";

const sale = (partial: Partial<StoreSale> & Pick<StoreSale, "day" | "totalCents">): StoreSale => ({
  channel: "meta_ads",
  campaignName: "Vendas",
  adsetId: "s1",
  adId: "a1",
  ...partial,
});

test("só a origem do canal entra na soma", () => {
  const sales = [
    sale({ day: "2026-10-02", totalCents: 14392 }),
    sale({ day: "2026-10-06", totalCents: 10000, channel: "google_ads", campaignName: "Search" }),
    sale({ day: "2026-10-17", totalCents: 47685, channel: "direct", campaignName: null }),
  ];
  const meta = salesForCanal(sales, "meta");
  assert.equal(meta.length, 1);
  assert.deepEqual(sumSales(meta), { pedidos: 1, receitaCents: 14392, receita: 143.92 });
  assert.equal(salesForCanal(sales, "geral").length, 3);
});

test("série semanal soma os mesmos pedidos do KPI", () => {
  const sales = [
    sale({ day: "2026-10-02", totalCents: 10000 }),
    sale({ day: "2026-10-09", totalCents: 25050 }),
  ];
  const week = (day: number) => new Date(2026, 8, day);
  const series = [
    { inicio: week(28), purchases: 99, valorConversao: 999 },
    { inicio: week(5), purchases: 99, valorConversao: 999 },
  ];
  applySeriesSales(series, sales, "semanal");
  assert.equal(series[0].purchases + series[1].purchases, sumSales(sales).pedidos);
  assert.equal(
    Math.round((series[0].valorConversao + series[1].valorConversao) * 100),
    sumSales(sales).receitaCents,
  );
});

test("campanha usa o pedido pago, não o valor que veio no objeto", () => {
  const rows = [
    {
      nome: "Vendas",
      purchases: 12,
      faturamento: 3904.64,
      investimento: 3026.66,
      resultType: "vendas",
      resultados: 12,
      custoResultado: 1,
      cpa: 1,
      ticketMedio: 1,
      roas: 1,
    },
  ];
  overlayCampaignSales(rows, [sale({ day: "2026-10-02", totalCents: 14392, campaignName: "Vendas" })]);
  assert.equal(rows[0].purchases, 1);
  assert.equal(rows[0].faturamento, 143.92);
  assert.equal(rows[0].resultados, 1);
});
