import assert from "node:assert/strict";
import test from "node:test";
import { cicloStatus, formatCicloLabel, listCiclos, todayBRT } from "../lib/relatorios/ciclos";
import { aggregateVendasMetaReport, comissaoDe, vendasMetaCsv, type OrderInput } from "../lib/relatorios/vendas-meta-core";

test("ciclos de 24 a 23 desde 24/08/2026", () => {
  const ciclos = listCiclos({ inicio: "2026-08-24", diaCorte: 24, hoje: "2026-10-22" });
  assert.deepEqual(ciclos, [
    { dataInicio: "2026-08-24", dataFim: "2026-09-23" },
    { dataInicio: "2026-09-24", dataFim: "2026-10-23" },
  ]);
  const depois = listCiclos({ inicio: "2026-08-24", diaCorte: 24, hoje: "2026-10-24" });
  assert.deepEqual(depois.at(-1), { dataInicio: "2026-10-24", dataFim: "2026-11-23" });
});

test("virada de ano", () => {
  const ciclos = listCiclos({ inicio: "2026-12-24", diaCorte: 24, hoje: "2027-01-30" });
  assert.deepEqual(ciclos, [
    { dataInicio: "2026-12-24", dataFim: "2027-01-23" },
    { dataInicio: "2027-01-24", dataFim: "2027-02-23" },
  ]);
  assert.equal(formatCicloLabel(ciclos[0]), "24/12/2026 a 23/01/2027");
  assert.equal(formatCicloLabel(ciclos[1]), "24/01 a 23/02/2027");
});

test("dia de corte 31 usa o último dia em meses curtos", () => {
  const ciclos = listCiclos({ inicio: "2027-01-31", diaCorte: 31, hoje: "2027-04-01" });
  assert.deepEqual(ciclos, [
    { dataInicio: "2027-01-31", dataFim: "2027-02-27" },
    { dataInicio: "2027-02-28", dataFim: "2027-03-30" },
    { dataInicio: "2027-03-31", dataFim: "2027-04-29" },
  ]);
});

test("início fora do dia de corte: primeiro ciclo vai até o próximo corte", () => {
  const ciclos = listCiclos({ inicio: "2026-08-10", diaCorte: 24, hoje: "2026-08-30" });
  assert.deepEqual(ciclos, [
    { dataInicio: "2026-08-10", dataFim: "2026-08-23" },
    { dataInicio: "2026-08-24", dataFim: "2026-09-23" },
  ]);
});

test("status: andamento → apuração (7 dias) → fechado", () => {
  assert.equal(cicloStatus("2026-10-23", "2026-10-23"), "EM_ANDAMENTO");
  assert.equal(cicloStatus("2026-10-23", "2026-10-24"), "EM_APURACAO");
  assert.equal(cicloStatus("2026-10-23", "2026-10-30"), "EM_APURACAO");
  assert.equal(cicloStatus("2026-10-23", "2026-10-31"), "FECHADO");
});

test("hoje em BRT: 01h UTC ainda é o dia anterior", () => {
  assert.equal(todayBRT(new Date("2026-10-24T01:00:00Z")), "2026-10-23");
  assert.equal(todayBRT(new Date("2026-10-24T03:00:00Z")), "2026-10-24");
});

const order = (o: Partial<OrderInput> & { id: string; adMethod: string | null; totalCents: number; status: string }): OrderInput => ({
  externalId: o.id,
  provider: "WOOCOMMERCE",
  buyerName: "Cliente",
  cityName: null,
  cityRaw: null,
  stateUf: null,
  occurredAt: new Date("2026-09-01T15:00:00Z"),
  createdAt: new Date("2026-09-01T15:00:00Z"),
  rawPayload: { order: { shipping_total: "20.00", discount_total: "0.00", number: `N${o.id}` } },
  items: [{ title: "Sérum", sku: "SER-1", quantity: 1, unitPriceCents: o.totalCents - 2000, lineTotalCents: o.totalCents - 2000 }],
  source: {
    adMethod: o.adMethod,
    adWindow: "click",
    metaCampaignId: "c1",
    metaCampaignName: "Vendas",
    metaAdsetId: "s1",
    metaAdsetName: "Conjunto",
    metaAdId: "a1",
    metaAdName: "Anúncio 1",
  },
  ...o,
});

test("só pedidos pagos entram, com subtotal por nível e comissão", () => {
  const report = aggregateVendasMetaReport({
    periodo: { dataInicio: "2026-08-24", dataFim: "2026-09-23" },
    comissaoPercent: 10,
    orders: [
      order({ id: "1", adMethod: "both", totalCents: 15000, status: "completed" }),
      order({ id: "2", adMethod: "utm", totalCents: 10050, status: "processing" }),
      order({ id: "3", adMethod: "meta_match", totalCents: 9999, status: "completed" }),
      order({ id: "4", adMethod: "utm", totalCents: 50000, status: "on-hold" }),
      order({ id: "5", adMethod: "both", totalCents: 30000, status: "refunded" }),
      order({ id: "6", adMethod: null, totalCents: 70000, status: "completed" }),
    ],
    metaPurchases: [{ clickPurchases: 3, clickValueCents: 35000, viewPurchases: 1, viewValueCents: 5000 }],
  });

  assert.equal(report.resumo.pedidos, 3);
  assert.equal(report.resumo.faturamentoCents, 35049);
  assert.equal(report.resumo.comissaoCents, 3505);
  assert.equal(report.resumo.freteCents, 6000);
  assert.equal(report.resumo.comissaoSemFreteCents, comissaoDe(35049 - 6000, 10));
  assert.deepEqual(
    report.porNivel.map((n) => [n.nivel, n.pedidos, n.faturamentoCents]),
    [
      ["confirmada", 1, 15000],
      ["utm", 1, 10050],
      ["provavel", 1, 9999],
    ],
  );
  assert.deepEqual(report.naoConcretizados, { pedidos: 2, valorCents: 80000 });
  assert.deepEqual(report.meta, { compras: 4, valorCents: 40000 });
  assert.equal(report.porCampanha.length, 1);
  assert.equal(report.porProduto[0].quantidade, 3);
  assert.equal(report.pedidos[0].numero, "N1");
});

test("CSV: BOM, separador ; e decimal com vírgula", () => {
  const report = aggregateVendasMetaReport({
    periodo: { dataInicio: "2026-08-24", dataFim: "2026-09-23" },
    comissaoPercent: 10,
    orders: [order({ id: "1", adMethod: "both", totalCents: 15000, status: "completed", buyerName: 'Ana "Lu"; Silva' })],
    metaPurchases: [],
  });
  const csv = vendasMetaCsv(report);
  assert.ok(csv.startsWith("\uFEFFPedido;Data;"));
  assert.ok(csv.includes('"Ana ""Lu""; Silva"'));
  assert.ok(csv.includes(";150,00;15,00;"));
  const itens = vendasMetaCsv(report, "itens").split("\r\n");
  assert.equal(itens.length, 3);
});
