import { Decimal } from "@/lib/generated/prisma/runtime/library";
import { prisma } from "@/lib/db";

export async function upsertFatoAnalyticsDiario(
  clienteId: string,
  data: Date,
  payload: {
    sessions: number;
    activeUsers: number;
    engagedSessions: number;
    engagementRate: number;
    bounceRate: number;
    averageSessionDuration: number;
    newUsers: number;
    screenPageViews: number;
    contaId?: string | null;
  }
) {
  const engagementRateDecimal = new Decimal(payload.engagementRate);
  const bounceRateDecimal = new Decimal(payload.bounceRate);

  return prisma.fatoAnalyticsDiario.upsert({
    where: {
      clienteId_data: { clienteId, data },
    },
    create: {
      clienteId,
      data,
      sessions: payload.sessions,
      activeUsers: payload.activeUsers,
      engagedSessions: payload.engagedSessions,
      engagementRate: engagementRateDecimal,
      bounceRate: bounceRateDecimal,
      averageSessionDuration: payload.averageSessionDuration,
      newUsers: payload.newUsers,
      screenPageViews: payload.screenPageViews,
      contaId: payload.contaId ?? null,
    },
    update: {
      sessions: payload.sessions,
      activeUsers: payload.activeUsers,
      engagedSessions: payload.engagedSessions,
      engagementRate: engagementRateDecimal,
      bounceRate: bounceRateDecimal,
      averageSessionDuration: payload.averageSessionDuration,
      newUsers: payload.newUsers,
      screenPageViews: payload.screenPageViews,
    },
  });
}

export async function upsertFatoAnalyticsPorCanal(
  clienteId: string,
  data: Date,
  canal: string,
  payload: {
    sessions: number;
    activeUsers: number;
  }
) {
  return prisma.fatoAnalyticsPorCanal.upsert({
    where: {
      clienteId_data_canal: { clienteId, data, canal },
    },
    create: {
      clienteId,
      data,
      canal,
      sessions: payload.sessions,
      activeUsers: payload.activeUsers,
    },
    update: {
      sessions: payload.sessions,
      activeUsers: payload.activeUsers,
    },
  });
}

export async function findFatosAnalyticsByClienteAndPeriod(
  clienteId: string,
  dataInicio: Date,
  dataFim: Date
) {
  return prisma.fatoAnalyticsDiario.findMany({
    where: {
      clienteId,
      data: { gte: dataInicio, lte: dataFim },
    },
    orderBy: { data: "asc" },
  });
}
