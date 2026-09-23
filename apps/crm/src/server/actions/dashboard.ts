"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getAverageClosingTime, getAverageTimeByStage } from "./stageHistory";

// Helper para validação de tenant (modo embed Atrako libera sem sessão)
async function assertTenantAccess(tenantId: string) {
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!tenant) throw new Error("Tenant inválido");
    return null;
  }
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  return session;
}

export async function getDashboardKpis(tenantId: string) {
  await assertTenantAccess(tenantId);

  const now = new Date();
  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);

  const [novos7, novos30, emAtendimento, convertidos] = await Promise.all([
    db.lead.count({ where: { tenantId, deletedAt: null, createdAt: { gte: d7 } } }),
    db.lead.count({ where: { tenantId, deletedAt: null, createdAt: { gte: d30 } } }),
    db.lead.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] },
      },
    }),
    db.lead.count({ where: { tenantId, deletedAt: null, status: "WON" } }),
  ]);

  return { novos7, novos30, emAtendimento, convertidos };
}

const getCachedDashboardSummary = unstable_cache(
  async (tenantId: string) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      leadsThisMonth,
      leadsLastMonth,
      leadsInProgress,
      leadsWonThisMonth,
      totalActiveLeads,
      revenueThisMonth,
      revenueLastMonth,
      expensesThisMonth,
      salesThisMonth,
      avgDealValue,
    ] = await Promise.all([
      db.lead.count({ where: { tenantId, deletedAt: null, createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
      db.lead.count({ where: { tenantId, deletedAt: null, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      db.lead.count({
        where: { tenantId, deletedAt: null, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] } },
      }),
      db.lead.count({
        where: { tenantId, deletedAt: null, status: "WON", updatedAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      db.lead.count({ where: { tenantId, deletedAt: null } }),
      db.transaction.aggregate({
        where: { tenantId, type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { tenantId, type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, date: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { tenantId, type: TransactionType.EXPENSE, status: TransactionStatus.CONFIRMED, date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      db.sale.count({ where: { tenantId, soldAt: { gte: startOfMonth, lte: endOfMonth } } }),
      db.sale.aggregate({ where: { tenantId, soldAt: { gte: startOfMonth, lte: endOfMonth } }, _avg: { amount: true } }),
    ]);

    const revenue = revenueThisMonth._sum.amount ? Number(revenueThisMonth._sum.amount) : 0;
    const lastRevenue = revenueLastMonth._sum.amount ? Number(revenueLastMonth._sum.amount) : 0;
    const expenses = expensesThisMonth._sum.amount ? Number(expensesThisMonth._sum.amount) : 0;
    const avgTicket = avgDealValue._avg.amount ? Number(avgDealValue._avg.amount) : 0;
    const revenueChange = lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue) * 100 : 0;
    const leadsChange = leadsLastMonth > 0 ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100 : 0;
    const conversionRate = leadsThisMonth > 0 ? (leadsWonThisMonth / leadsThisMonth) * 100 : 0;

    return {
      revenue,
      revenueChange: Math.round(revenueChange),
      expenses,
      profit: revenue - expenses,
      leadsThisMonth,
      leadsChange: Math.round(leadsChange),
      leadsInProgress,
      leadsWonThisMonth,
      totalActiveLeads,
      salesThisMonth,
      avgTicket: Math.round(avgTicket),
      conversionRate: Math.round(conversionRate * 10) / 10,
      monthName: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  },
  ["dashboard-summary"],
  { revalidate: 30 }
);

// Nova funcao para resumo completo do dashboard
// OTIMIZADO: cache 30s + helper de validacao
export async function getDashboardSummary(tenantId: string) {
  await assertTenantAccess(tenantId);
  return getCachedDashboardSummary(tenantId);
}

// OTIMIZADO: Paraleliza query de stages junto com groupBy
export async function getDashboardCharts(tenantId: string) {
  await assertTenantAccess(tenantId);

  // OTIMIZADO: Todas as queries em paralelo
  const [bySource, byStage, stages] = await Promise.all([
    db.lead.groupBy({
      by: ["source"],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    }),
    db.lead.groupBy({
      by: ["stageId"],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    }),
    db.leadStage.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
  ]);

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));

  return {
    bySource: bySource.map((s) => ({ name: s.source, total: s._count.id })),
    byStage: byStage.map((s) => ({ name: stageMap[s.stageId ?? ""] || "Sem estágio", total: s._count.id })),
  };
}

const getCachedPipelineOverview = unstable_cache(
  async (tenantId: string) => {
    const [stages, counts] = await Promise.all([
    db.leadStage.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    db.lead.groupBy({
      by: ["stageId"],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    }),
  ]);

    const countMap = Object.fromEntries(counts.map((c) => [c.stageId, c._count.id]));
    const totalLeads = counts.reduce((sum, c) => sum + c._count.id, 0);
    return {
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        count: countMap[s.id] || 0,
      })),
      totalLeads,
    };
  },
  ["pipeline-overview"],
  { revalidate: 30 }
);

export async function getPipelineOverview(tenantId: string) {
  await assertTenantAccess(tenantId);
  return getCachedPipelineOverview(tenantId);
}

export async function getRecentLeads(tenantId: string, limit = 5) {
  await assertTenantAccess(tenantId);

  const leads = await db.lead.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      source: true,
      dealValue: true,
      createdAt: true,
      stage: { select: { name: true, color: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return leads.map((lead) => ({
    ...lead,
    dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
  }));
}

// OTIMIZADO: Paraleliza todas as queries e corrige filtros
export async function getReportCharts(
  tenantId: string,
  days: 7 | 30 | 90
) {
  await assertTenantAccess(tenantId);

  const from = new Date();
  from.setDate(from.getDate() - days);
  const where = { tenantId, deletedAt: null, createdAt: { gte: from } };
  const saleWhere = { tenantId, soldAt: { gte: from } };

  // Calcular tempo médio de fechamento
  const avgClosingTime = await getAverageClosingTime(tenantId, days);
  const avgTimeByStage = await getAverageTimeByStage(tenantId, days);

  // OTIMIZADO: Todas as queries em paralelo, incluindo stages
  const [
    bySource,
    byStage,
    stages,
    novos,
    emAtendimento,
    convertidos,
    perdidos,
    wonComValor,
    totalConvs,
    convsComResposta,
    receitaAgg,
    vendasPorLead,
  ] = await Promise.all([
    db.lead.groupBy({ by: ["source"], where, _count: { id: true } }),
    db.lead.groupBy({ by: ["stageId"], where, _count: { id: true } }),
    db.leadStage.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
    db.lead.count({ where }),
    db.lead.count({
      where: {
        ...where,
        status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] },
      },
    }),
    db.lead.count({ where: { ...where, status: "WON" } }),
    db.lead.count({ where: { ...where, status: "LOST" } }),
    db.lead.aggregate({
      where: { ...where, status: "WON", dealValue: { not: null } },
      _sum: { dealValue: true },
      _count: { id: true },
    }),
    db.conversation.count({ where: { tenantId, createdAt: { gte: from } } }),
    db.conversation.count({
      where: {
        tenantId,
        createdAt: { gte: from },
        messages: { some: { direction: "OUT" } },
      },
    }),
    db.sale.aggregate({ where: saleWhere, _sum: { amount: true } }),
    // CORRIGIDO: Filtrar por periodo
    db.sale.groupBy({ by: ["leadId"], where: saleWhere, _count: { id: true } }),
  ]);

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));

  const ticketMedio =
    wonComValor._count.id > 0 && wonComValor._sum.dealValue != null
      ? Number(wonComValor._sum.dealValue) / wonComValor._count.id
      : null;
  const taxaConversao = novos > 0 ? (convertidos / novos) * 100 : null;
  const taxaResposta = totalConvs > 0 ? (convsComResposta / totalConvs) * 100 : null;
  const receita = receitaAgg._sum.amount != null ? Number(receitaAgg._sum.amount) : 0;
  const recompra = vendasPorLead.filter((v) => v._count.id >= 2).length;

  return {
    bySource: bySource.map((s) => ({ name: s.source, total: s._count.id })),
    byStage: byStage.map((s) => ({ name: stageMap[s.stageId ?? ""] || "Sem estágio", total: s._count.id })),
    totais: {
      novos,
      emAtendimento,
      convertidos,
      perdidos,
      ticketMedio: ticketMedio != null ? Math.round(ticketMedio * 100) / 100 : null,
      taxaConversao: taxaConversao != null ? Math.round(taxaConversao * 10) / 10 : null,
      taxaResposta: taxaResposta != null ? Math.round(taxaResposta * 10) / 10 : null,
      receita,
      recompra,
      tempoMedioFechamento: avgClosingTime.averageDays,
      tempoMedioPorEtapa: avgTimeByStage,
    },
  };
}
