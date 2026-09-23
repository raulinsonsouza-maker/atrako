import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAccountHealthStatus } from "../lib/account-health/status";

const now = new Date("2026-09-17T12:00:00.000Z");
const base = {
  now,
  hasMetaAccount: true,
  hasGoogleAccount: false,
  latestMetaDataAt: new Date("2026-09-17T00:00:00.000Z"),
  latestGoogleDataAt: null,
  metaPaymentMethod: "Cartão",
  metaBalance: null,
  metaBalanceUpdatedAt: null,
  monthlyBudgetMeta: 3000,
  monthlyBudgetGoogle: null,
  monthlySpendMeta: 1600,
  monthlySpendGoogle: 0,
  last7SpendMeta: 700,
  completeMonthSpend: 1400,
  completeMonthDataDays: 16,
};

test("returns gray when paid media data is stale", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      latestMetaDataAt: new Date("2026-09-14T00:00:00.000Z"),
    }),
    "GRAY"
  );
});

test("returns red for a confirmed zero prepaid Meta balance", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      metaPaymentMethod: "PIX",
      metaBalance: 0,
      metaBalanceUpdatedAt: new Date("2026-09-17T11:00:00.000Z"),
    }),
    "RED"
  );
});

test("does not turn a missing prepaid balance into zero", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      metaPaymentMethod: "Boleto",
      metaBalance: null,
      metaBalanceUpdatedAt: null,
    }),
    "GRAY"
  );
});

test("returns yellow for prepaid autonomy of three days or less", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      metaPaymentMethod: "Boleto",
      metaBalance: 250,
      metaBalanceUpdatedAt: new Date("2026-09-17T11:00:00.000Z"),
    }),
    "YELLOW"
  );
});

test("returns green only with fresh data and budget within projection", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      monthlySpendMeta: 1400,
    }),
    "GREEN"
  );
});

test("confirmed red is not hidden by unavailable general coverage", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      latestMetaDataAt: null,
      metaPaymentMethod: "PIX",
      metaBalance: 0,
      metaBalanceUpdatedAt: new Date("2026-09-17T11:00:00.000Z"),
    }),
    "RED"
  );
});

test("confirmed budget overrun is not hidden by missing prepaid balance", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      metaPaymentMethod: "Boleto",
      metaBalance: null,
      metaBalanceUpdatedAt: null,
      monthlySpendMeta: 3100,
    }),
    "RED"
  );
});

test("does not project from fewer than three complete data days", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      monthlySpendMeta: 300,
      completeMonthSpend: 300,
      completeMonthDataDays: 2,
    }),
    "GREEN"
  );
});

test("current partial day is excluded from budget projection", () => {
  assert.equal(
    evaluateAccountHealthStatus({
      ...base,
      monthlySpendMeta: 1700,
      completeMonthSpend: 1200,
      completeMonthDataDays: 16,
    }),
    "GREEN"
  );
});