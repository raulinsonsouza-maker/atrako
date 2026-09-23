"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";

/**
 * Registra entrada em um novo stage
 */
export async function recordStageEntry(
  tenantId: string,
  leadId: string,
  stageId: string | null,
  previousStageId?: string | null
) {
  // Fechar entrada anterior se existir
  if (previousStageId !== undefined) {
    await db.leadStageHistory.updateMany({
      where: {
        tenantId,
        leadId,
        stageId: previousStageId,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  // Criar nova entrada se stageId não for null
  if (stageId) {
    await db.leadStageHistory.create({
      data: {
        tenantId,
        leadId,
        stageId,
        previousStageId: previousStageId || null,
        enteredAt: new Date(),
      },
    });
  }
}

/**
 * Calcula tempo médio de fechamento (do primeiro stage até WON)
 */
export async function getAverageClosingTime(tenantId: string, days: number = 30) {
  await assertTenantAccess(tenantId);

  const from = new Date();
  from.setDate(from.getDate() - days);

  // Buscar leads que foram ganhos no período
  const wonLeads = await db.lead.findMany({
    where: {
      tenantId,
      status: "WON",
      updatedAt: { gte: from },
      deletedAt: null,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (wonLeads.length === 0) {
    return {
      averageDays: 0,
      averageHours: 0,
      totalLeads: 0,
    };
  }

  // Calcular tempo de cada lead
  const times = wonLeads.map((lead) => {
    const created = new Date(lead.createdAt);
    const won = new Date(lead.updatedAt);
    return (won.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // dias
  });

  const averageDays = times.reduce((a, b) => a + b, 0) / times.length;
  const averageHours = averageDays * 24;

  return {
    averageDays: Math.round(averageDays * 10) / 10,
    averageHours: Math.round(averageHours * 10) / 10,
    totalLeads: wonLeads.length,
  };
}

/**
 * Calcula tempo médio por etapa do funil
 */
export async function getAverageTimeByStage(tenantId: string, days: number = 30) {
  await assertTenantAccess(tenantId);

  const from = new Date();
  from.setDate(from.getDate() - days);

  // Buscar histórico de mudanças de stage no período
  const history = await db.leadStageHistory.findMany({
    where: {
      tenantId,
      enteredAt: { gte: from },
      stageId: { not: null },
    },
    include: {
      stage: {
        select: {
          id: true,
          name: true,
          order: true,
        },
      },
    },
    orderBy: {
      enteredAt: "asc",
    },
  });

  // Agrupar por stage e calcular tempo médio
  const stageTimes = new Map<string, { times: number[]; name: string; order: number }>();

  for (const entry of history) {
    if (!entry.stageId || !entry.stage) continue;

    const key = entry.stageId;
    if (!stageTimes.has(key)) {
      stageTimes.set(key, {
        times: [],
        name: entry.stage.name,
        order: entry.stage.order,
      });
    }

    const entryData = stageTimes.get(key)!;
    if (entry.leftAt) {
      const timeInStage =
        (new Date(entry.leftAt).getTime() - new Date(entry.enteredAt).getTime()) /
        (1000 * 60 * 60 * 24); // dias
      entryData.times.push(timeInStage);
    }
  }

  // Calcular médias
  const averages = Array.from(stageTimes.entries())
    .map(([stageId, data]) => {
      const avg = data.times.length > 0 ? data.times.reduce((a, b) => a + b, 0) / data.times.length : 0;
      return {
        stageId,
        stageName: data.name,
        order: data.order,
        averageDays: Math.round(avg * 10) / 10,
        averageHours: Math.round(avg * 24 * 10) / 10,
        sampleSize: data.times.length,
      };
    })
    .sort((a, b) => a.order - b.order);

  return averages;
}

/**
 * Calcula tempo médio entre etapas específicas
 */
export async function getAverageTimeBetweenStages(
  tenantId: string,
  fromStageId: string,
  toStageId: string,
  days: number = 30
) {
  await assertTenantAccess(tenantId);

  const from = new Date();
  from.setDate(from.getDate() - days);

  // Buscar leads que passaram por ambas as etapas
  const leads = await db.lead.findMany({
    where: {
      tenantId,
      deletedAt: null,
      stageHistory: {
        some: {
          stageId: toStageId,
          enteredAt: { gte: from },
        },
      },
    },
    include: {
      stageHistory: {
        where: {
          stageId: { in: [fromStageId, toStageId] },
        },
        orderBy: {
          enteredAt: "asc",
        },
      },
    },
  });

  const times: number[] = [];

  for (const lead of leads) {
    const fromEntry = lead.stageHistory.find((h) => h.stageId === fromStageId);
    const toEntry = lead.stageHistory.find((h) => h.stageId === toStageId);

    if (fromEntry && toEntry) {
      const timeDiff =
        (new Date(toEntry.enteredAt).getTime() - new Date(fromEntry.enteredAt).getTime()) /
        (1000 * 60 * 60 * 24); // dias
      times.push(timeDiff);
    }
  }

  if (times.length === 0) {
    return {
      averageDays: 0,
      averageHours: 0,
      sampleSize: 0,
    };
  }

  const averageDays = times.reduce((a, b) => a + b, 0) / times.length;

  return {
    averageDays: Math.round(averageDays * 10) / 10,
    averageHours: Math.round(averageDays * 24 * 10) / 10,
    sampleSize: times.length,
  };
}
