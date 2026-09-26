import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketplaceDailySeries,
  MERCADO_LIVRE_PAID_STATUSES,
} from "../lib/integrations/mercadolivre/metrics";
import {
  buildMercadoLivreMonthlyRanges,
  shouldContinueMercadoLivrePagination,
} from "../lib/integrations/mercadolivre/sync-utils";

test("splits the Mercado Livre backfill into complete monthly ranges", () => {
  assert.deepEqual(buildMercadoLivreMonthlyRanges("2026-01-01", "2026-03-12"), [
    { dateFrom: "2026-01-01", dateTo: "2026-01-31" },
    { dateFrom: "2026-02-01", dateTo: "2026-02-28" },
    { dateFrom: "2026-03-01", dateTo: "2026-03-12" },
  ]);
});

test("continues pagination beyond 400 orders until the reported total", () => {
  assert.equal(shouldContinueMercadoLivrePagination({ received: 50, offset: 350, limit: 50, total: 475 }), true);
  assert.equal(shouldContinueMercadoLivrePagination({ received: 25, offset: 450, limit: 50, total: 475 }), false);
});

test("aggregates paid-order daily GMV and estimated net values", () => {
  assert.deepEqual([...MERCADO_LIVRE_PAID_STATUSES], ["paid", "confirmed"]);
  const series = buildMarketplaceDailySeries([
    { occurredAt: new Date("2026-02-05T10:00:00Z"), totalCents: 10000, saleFeeCents: 1200, shippingCostCents: 800, netCents: null },
    { occurredAt: new Date("2026-02-05T18:00:00Z"), totalCents: 5000, saleFeeCents: 500, shippingCostCents: 0, netCents: 4500 },
  ]);
  assert.deepEqual(series, [{ date: "2026-02-05", orders: 2, gmvCents: 15000, netCents: 12500 }]);
});
