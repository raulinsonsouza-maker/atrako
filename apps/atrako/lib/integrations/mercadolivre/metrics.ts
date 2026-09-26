export const MERCADO_LIVRE_PAID_STATUSES = ["paid", "confirmed"] as const;

export type MarketplaceMetricRow = {
  occurredAt: Date | null;
  totalCents: number | null;
  saleFeeCents: number | null;
  shippingCostCents: number | null;
  netCents: number | null;
};

export function buildMarketplaceDailySeries(rows: MarketplaceMetricRow[]) {
  const byDate = new Map<string, { date: string; orders: number; gmvCents: number; netCents: number }>();
  for (const row of rows) {
    if (!row.occurredAt) continue;
    const date = row.occurredAt.toISOString().slice(0, 10);
    const current = byDate.get(date) ?? { date, orders: 0, gmvCents: 0, netCents: 0 };
    const gmv = row.totalCents ?? 0;
    const net = row.netCents ?? gmv - (row.saleFeeCents ?? 0) - (row.shippingCostCents ?? 0);
    current.orders++;
    current.gmvCents += gmv;
    current.netCents += net;
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
