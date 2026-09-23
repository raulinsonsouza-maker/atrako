import assert from "node:assert/strict";
import test from "node:test";
import { campaignMetricValue, coverage, mediaTotalsComparison, notRequestedCoverage, unavailableCoverage } from "../lib/analyst/dataTools";

test("coverage distinguishes an unavailable source from a source with rows", () => {
  assert.deepEqual(unavailableCoverage("sincronização ausente"), {
    state: "unavailable", records: 0, lastDate: null, reason: "sincronização ausente",
  });
  assert.equal(coverage(3, "2026-09-09").state, "available");
  assert.equal(notRequestedCoverage().state, "not_requested");
});

test("platform-specific metric semantics never expose Google CPL or combined efficiency", () => {
  const values = {
    campaignId: "g1", cost: 100, clicks: 10, leads: null,
    actions: 4, results: 4, attributedValue: 250,
  };
  assert.equal(campaignMetricValue(values, "CPL", "GOOGLE"), null);
  assert.equal(campaignMetricValue(values, "CPA", "GOOGLE"), 25);
  assert.equal(campaignMetricValue(values, "ROAS", "GOOGLE"), 2.5);
  const comparison = mediaTotalsComparison(
    { impressoes: 1, cliques: 1, leads: 1, results: 1, investimento: 10, attributedValue: 10, cpl: 10 },
    { impressoes: 1, cliques: 1, leads: 1, results: 1, investimento: 10, attributedValue: 10, cpl: 10 },
  );
  assert.equal(comparison.roasPct, null);
  assert.equal(comparison.costPerResultPct, null);
});