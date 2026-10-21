/** Financeiro da área do cliente: entradas do caixa, custos de mídia por dia e cobranças em aberto. */

import { prisma } from "@/lib/db";
import { dateColumnRange, previousPeriod, type Period } from "@/lib/atendimento/period";
import {
  channelLabel,
  financeDaily,
  financeRows,
  financeTotals,
  pctChange,
  type LedgerLike,
  type SpendLike,
} from "@/lib/atendimento/finance-view";

async function loadLedger(workspaceId: string, p: Period): Promise<LedgerLike[]> {
  const rows = await prisma.workspaceLedgerEntry.findMany({
    where: { clienteId: workspaceId, occurredAt: { gte: p.gte, lte: p.lte } },
    orderBy: { occurredAt: "desc" },
    take: 5000,
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      occurredAt: true,
      source: true,
      description: true,
      provider: true,
      leadId: true,
      contact: true,
    },
  });
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

async function loadSpend(workspaceId: string, p: Period): Promise<SpendLike[]> {
  const rows = await prisma.fatoMidiaDiario.groupBy({
    by: ["data", "canal"],
    where: { clienteId: workspaceId, data: dateColumnRange(p) },
    _sum: { investimento: true },
  });
  return rows
    .map((r) => ({
      date: r.data.toISOString().slice(0, 10),
      canal: r.canal,
      amount: Number(r._sum.investimento ?? 0),
    }))
    .filter((r) => r.amount > 0);
}

async function loadCampaigns(workspaceId: string, p: Period) {
  const rows = await prisma.fatoMidiaDiario.groupBy({
    by: ["canal", "campaignName"],
    where: { clienteId: workspaceId, data: dateColumnRange(p) },
    _sum: { investimento: true, leads: true },
  });
  return rows
    .map((r) => ({
      channel: channelLabel(r.canal),
      name: r.campaignName || "Sem nome",
      spend: Number(r._sum.investimento ?? 0),
      leads: Number(r._sum.leads ?? 0),
    }))
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
}

export async function getAtendimentoFinance(workspaceId: string, period: Period) {
  const prev = previousPeriod(period);
  const now = new Date();
  const [ledger, spend, prevLedger, prevSpend, campaigns, pendingLinks] = await Promise.all([
    loadLedger(workspaceId, period),
    loadSpend(workspaceId, period),
    loadLedger(workspaceId, prev),
    loadSpend(workspaceId, prev),
    loadCampaigns(workspaceId, period),
    prisma.leadPaymentLink.aggregate({
      where: { clienteId: workspaceId, status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);
  const totals = financeTotals(ledger, spend);
  const previous = financeTotals(prevLedger, prevSpend);
  return {
    period: { from: period.from, to: period.to, days: period.days },
    previousPeriod: { from: prev.from, to: prev.to },
    totals,
    previous,
    change: {
      income: pctChange(totals.income, previous.income),
      adSpend: pctChange(totals.adSpend, previous.adSpend),
      net: pctChange(totals.net, previous.net),
      sales: pctChange(totals.sales, previous.sales),
    },
    pending: { count: pendingLinks._count, amount: (pendingLinks._sum.amountCents ?? 0) / 100 },
    daily: financeDaily(period, ledger, spend),
    campaigns,
    rows: financeRows(ledger, spend).slice(0, 400),
  };
}

export type AtendimentoFinance = Awaited<ReturnType<typeof getAtendimentoFinance>>;
