import assert from "node:assert/strict";
import test from "node:test";
import { agrupamentoPorDias, bucketYmd, rotuloEixo, rotuloTooltip } from "../lib/chart-bucket";

test("ano vai para mês e 90 dias continua na semana", () => {
  assert.equal(agrupamentoPorDias(280), "mes");
  assert.equal(agrupamentoPorDias(90), "semana");
  assert.equal(agrupamentoPorDias(30), "dia");
});

test("mês agrupa no dia 1 e o eixo usa o nome curto", () => {
  assert.equal(bucketYmd("2026-10-08", "mes"), "2026-10-01");
  assert.equal(rotuloEixo("2026-10-01", "mes", false), "out");
  assert.equal(rotuloEixo("2026-10-01", "mes", true), "out/26");
  assert.equal(rotuloTooltip("2026-10-01", "mes"), "Outubro 2026");
});
