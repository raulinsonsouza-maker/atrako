/** Monta o Financeiro da área do cliente: caixa (ledger) como entradas e mídia paga como custo. */

import { eachDay, ymdBrt } from "@/lib/atendimento/period";

export type LedgerLike = {
  id: string;
  type: string;
  status: string;
  amount: number;
  occurredAt: Date;
  source: string;
  description: string | null;
  provider: string | null;
  leadId: string | null;
  contact: string | null;
};

export type SpendLike = { date: string; canal: string; amount: number };

export type FinanceRow = {
  id: string;
  kind: "income" | "refund" | "expense" | "ads";
  date: string;
  at: string;
  description: string;
  detail: string | null;
  amount: number;
  leadId: string | null;
};

export type FinanceTotals = {
  income: number;
  refund: number;
  expense: number;
  adSpend: number;
  costs: number;
  net: number;
  sales: number;
  roas: number | null;
  costPerSale: number | null;
};

const CHANNEL_LABEL: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads" };
const PROVIDER_LABEL: Record<string, string> = { MERCADO_PAGO: "Mercado Pago", MANUAL: "Manual" };
const round = (n: number) => Math.round(n * 100) / 100;

export function channelLabel(canal: string) {
  return CHANNEL_LABEL[canal.toUpperCase()] ?? canal;
}

export function financeTotals(ledger: LedgerLike[], spend: SpendLike[]): FinanceTotals {
  let income = 0;
  let refund = 0;
  let expense = 0;
  let sales = 0;
  for (const e of ledger) {
    if (e.status !== "CONFIRMED") continue;
    if (e.type === "INCOME") {
      income += e.amount;
      if (e.source === "crm") sales += 1;
    } else if (e.type === "REFUND") refund += e.amount;
    else if (e.type === "EXPENSE") expense += e.amount;
  }
  const adSpend = spend.reduce((s, r) => s + r.amount, 0);
  const costs = expense + adSpend;
  const net = income - refund - costs;
  return {
    income: round(income),
    refund: round(refund),
    expense: round(expense),
    adSpend: round(adSpend),
    costs: round(costs),
    net: round(net),
    sales,
    roas: adSpend > 0 ? round((income - refund) / adSpend) : null,
    costPerSale: adSpend > 0 && sales > 0 ? round(adSpend / sales) : null,
  };
}

export function financeDaily(
  period: { from: string; to: string },
  ledger: LedgerLike[],
  spend: SpendLike[],
) {
  const days = new Map(eachDay(period).map((d) => [d, { date: d, income: 0, costs: 0 }]));
  for (const e of ledger) {
    if (e.status !== "CONFIRMED") continue;
    const day = days.get(ymdBrt(e.occurredAt));
    if (!day) continue;
    if (e.type === "INCOME") day.income += e.amount;
    else if (e.type === "REFUND") day.income -= e.amount;
    else day.costs += e.amount;
  }
  for (const r of spend) {
    const day = days.get(r.date);
    if (day) day.costs += r.amount;
  }
  return [...days.values()].map((d) => ({ date: d.date, income: round(d.income), costs: round(d.costs) }));
}

/** Extrato único: lançamentos do caixa + uma linha de custo por dia e canal de mídia. */
export function financeRows(ledger: LedgerLike[], spend: SpendLike[]): FinanceRow[] {
  const rows: FinanceRow[] = ledger
    .filter((e) => e.status === "CONFIRMED")
    .map((e) => ({
      id: e.id,
      kind: e.type === "INCOME" ? "income" : e.type === "REFUND" ? "refund" : "expense",
      date: ymdBrt(e.occurredAt),
      at: e.occurredAt.toISOString(),
      description: e.description || (e.type === "INCOME" ? "Entrada" : "Saída"),
      detail: [e.contact, e.provider ? PROVIDER_LABEL[e.provider] ?? e.provider : null].filter(Boolean).join(" · ") || null,
      amount: round(e.amount),
      leadId: e.leadId,
    }));
  const byDay = new Map<string, number>();
  for (const r of spend) {
    const key = `${r.date}|${r.canal.toUpperCase()}`;
    byDay.set(key, (byDay.get(key) ?? 0) + r.amount);
  }
  for (const [key, amount] of byDay) {
    if (amount <= 0) continue;
    const [date, canal] = key.split("|");
    rows.push({
      id: `ads-${date}-${canal}`,
      kind: "ads",
      date,
      at: `${date}T12:00:00.000Z`,
      description: `Investimento em ${channelLabel(canal)}`,
      detail: "Custo de campanhas do dia",
      amount: round(amount),
      leadId: null,
    });
  }
  return rows.sort((a, b) => (a.date === b.date ? b.at.localeCompare(a.at) : b.date.localeCompare(a.date)));
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
