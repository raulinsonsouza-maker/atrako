"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";

export async function getSalesRepPerformance(tenantId: string, userId?: string) {
  await assertTenantAccess(tenantId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const where = userId ? { tenantId, assignedToId: userId } : { tenantId };
  const whereDeleted = { ...where, deletedAt: null };

  // Leads
  const [
    leadsThisMonth,
    leadsLastMonth,
    leadsWonThisMonth,
    leadsWonLastMonth,
    leadsInProgress,
    totalLeads,
  ] = await Promise.all([
    db.lead.count({
      where: { ...whereDeleted, createdAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    db.lead.count({
      where: { ...whereDeleted, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),
    db.lead.count({
      where: {
        ...whereDeleted,
        status: "WON",
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    db.lead.count({
      where: {
        ...whereDeleted,
        status: "WON",
        updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
    db.lead.count({
      where: {
        ...whereDeleted,
        status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] },
      },
    }),
    db.lead.count({ where: whereDeleted }),
  ]);

  // Oportunidades
  const [
    opportunitiesThisMonth,
    opportunitiesWonThisMonth,
    opportunitiesLostThisMonth,
    totalOpportunities,
  ] = await Promise.all([
    db.opportunity.count({
      where: {
        ...where,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    db.opportunity.count({
      where: {
        ...where,
        status: "WON",
        wonAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    db.opportunity.count({
      where: {
        ...where,
        status: "LOST",
        lostAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    db.opportunity.count({
      where: {
        ...where,
        status: "OPEN",
      },
    }),
  ]);

  // Vendas
  const [salesThisMonth, salesLastMonth, revenueThisMonth, revenueLastMonth, avgTicket] =
    await Promise.all([
      db.sale.count({
        where: {
          ...where,
          soldAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      db.sale.count({
        where: {
          ...where,
          soldAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      db.sale.aggregate({
        where: {
          ...where,
          soldAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      db.sale.aggregate({
        where: {
          ...where,
          soldAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      db.sale.aggregate({
        where: {
          ...where,
          soldAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _avg: { amount: true },
      }),
    ]);

  // Cálculos
  const revenue = revenueThisMonth._sum.amount ? Number(revenueThisMonth._sum.amount) : 0;
  const lastRevenue = revenueLastMonth._sum.amount ? Number(revenueLastMonth._sum.amount) : 0;
  const revenueChange = lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue) * 100 : 0;
  const leadsChange = leadsLastMonth > 0 ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100 : 0;
  const conversionRate = leadsThisMonth > 0 ? (leadsWonThisMonth / leadsThisMonth) * 100 : 0;
  const lastConversionRate =
    leadsLastMonth > 0 ? (leadsWonLastMonth / leadsLastMonth) * 100 : 0;
  const conversionChange = conversionRate - lastConversionRate;
  const avgTicketValue = avgTicket._avg.amount ? Number(avgTicket._avg.amount) : 0;

  return {
    leads: {
      thisMonth: leadsThisMonth,
      lastMonth: leadsLastMonth,
      change: Math.round(leadsChange),
      won: leadsWonThisMonth,
      inProgress: leadsInProgress,
      total: totalLeads,
    },
    opportunities: {
      thisMonth: opportunitiesThisMonth,
      won: opportunitiesWonThisMonth,
      lost: opportunitiesLostThisMonth,
      open: totalOpportunities,
    },
    sales: {
      thisMonth: salesThisMonth,
      lastMonth: salesLastMonth,
      revenue: Math.round(revenue),
      revenueChange: Math.round(revenueChange),
      avgTicket: Math.round(avgTicketValue),
    },
    conversion: {
      rate: Math.round(conversionRate * 10) / 10,
      change: Math.round(conversionChange * 10) / 10,
    },
  };
}

export async function getAllSalesRepsPerformance(tenantId: string) {
  await assertTenantAccess(tenantId);

  // Buscar todos os usuários que têm leads atribuídos
  const users = await db.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true },
  });

  const performances = await Promise.all(
    users.map(async (user) => {
      const perf = await getSalesRepPerformance(tenantId, user.id);
      return {
        user,
        ...perf,
      };
    })
  );

  return performances.sort((a, b) => b.sales.revenue - a.sales.revenue);
}

export async function getSalesRepLeadsByStage(tenantId: string, userId: string) {
  await assertTenantAccess(tenantId);

  const [leads, stages] = await Promise.all([
    db.lead.groupBy({
      by: ["stageId"],
      where: { tenantId, assignedToId: userId, deletedAt: null },
      _count: { id: true },
    }),
    db.leadStage.findMany({
      where: { tenantId },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));
  return leads.map((l) => ({
    stageId: l.stageId || null,
    stageName: l.stageId ? stageMap[l.stageId]?.name || "Sem estágio" : "Sem estágio",
    color: l.stageId ? stageMap[l.stageId]?.color || "#6B7280" : "#6B7280",
    count: l._count.id,
  }));
}

export async function getSalesRepLeadsBySource(tenantId: string, userId: string) {
  await assertTenantAccess(tenantId);

  const leads = await db.lead.groupBy({
    by: ["source"],
    where: { tenantId, assignedToId: userId, deletedAt: null },
    _count: { id: true },
  });

  return leads.map((l) => ({
    source: l.source,
    count: l._count.id,
  }));
}
