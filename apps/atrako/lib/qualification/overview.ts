/**
 * Agregados da visão geral inside sales (leads, prioridade, cadência, funil).
 */

import { prisma } from "@/lib/db";
import { ensureDefaultPipeline, isLostStage, isWonStage } from "@/lib/modules/crm";
import { nextActionHuman, priorityHumanLabel } from "@/lib/qualification/crm-labels";
import { parseLeadQualification, type LeadQualification } from "@/lib/qualification/store";

export type InsideSalesOverview = {
  period: { from: string; to: string };
  kpis: {
    newLeads: number;
    openLeads: number;
    priorityA: number;
    priorityB: number;
    priorityC: number;
    awaitingWhatsApp: number;
    inConversation: number;
    inCadence: number;
    scheduleMeeting: number;
    wonInPeriod: number;
  };
  stages: Array<{ id: string; name: string; color: string; count: number; role: string | null }>;
  attention: Array<{
    id: string;
    name: string;
    priority: "A" | "B" | "C" | null;
    priorityLabel: string | null;
    nextAction: string;
    stageName: string | null;
    createdAt: string;
  }>;
  midia: { investimento: number; leadsMidia: number };
};

export type QualifyActionBucket =
  | "meeting"
  | "awaiting_wa"
  | "in_conversation"
  | "cadence"
  | "other";

export function qualifyActionBucket(q: LeadQualification): QualifyActionBucket {
  const state = q.currentState || "";
  if (state === "meeting_requested" || state === "human_handoff") return "meeting";
  if (state === "awaiting_post_form_engagement" || state === "awaiting_start_choice") {
    return "awaiting_wa";
  }
  if (q.cadenceStatus === "running") return "cadence";
  if (state.startsWith("awaiting_")) return "in_conversation";
  return "other";
}

const ATTENTION_RANK: Record<QualifyActionBucket, number> = {
  meeting: 0,
  awaiting_wa: 1,
  in_conversation: 2,
  cadence: 3,
  other: 4,
};

const PRIORITY_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };

function ymdBrt(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function getInsideSalesOverview(
  workspaceId: string,
  range: { gte: Date; lte: Date },
): Promise<InsideSalesOverview> {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const stageById = new Map(pipeline.stages.map((s) => [s.id, s]));
  const lostIds = new Set(pipeline.stages.filter((s) => isLostStage(s)).map((s) => s.id));
  const wonIds = new Set(pipeline.stages.filter((s) => isWonStage(s)).map((s) => s.id));

  const [openLeads, newLeads, wonInPeriod, midiaRow] = await Promise.all([
    prisma.nativeLead.findMany({
      where: {
        clienteId: workspaceId,
        status: "OPEN",
        OR: [{ stageId: null }, { stageId: { notIn: [...lostIds, ...wonIds] } }],
      },
      select: {
        id: true,
        metadata: true,
        stageId: true,
        createdAt: true,
        contact: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.nativeLead.count({
      where: { clienteId: workspaceId, createdAt: { gte: range.gte, lte: range.lte } },
    }),
    prisma.nativeLead.count({
      where: {
        clienteId: workspaceId,
        OR: [{ status: "WON" }, { stageId: { in: [...wonIds] } }],
        updatedAt: { gte: range.gte, lte: range.lte },
      },
    }),
    prisma.fatoMidiaDiario.aggregate({
      where: { clienteId: workspaceId, data: { gte: range.gte, lte: range.lte } },
      _sum: { investimento: true, leads: true },
    }),
  ]);

  const kpis = {
    newLeads,
    openLeads: openLeads.length,
    priorityA: 0,
    priorityB: 0,
    priorityC: 0,
    awaitingWhatsApp: 0,
    inConversation: 0,
    inCadence: 0,
    scheduleMeeting: 0,
    wonInPeriod,
  };

  const stageCounts = new Map<string | null, number>();
  const attentionRaw: Array<
    InsideSalesOverview["attention"][number] & { bucket: QualifyActionBucket; prioRank: number }
  > = [];

  for (const lead of openLeads) {
    const q = parseLeadQualification(lead.metadata);
    if (q.priority === "A") kpis.priorityA += 1;
    else if (q.priority === "B") kpis.priorityB += 1;
    else if (q.priority === "C") kpis.priorityC += 1;

    const bucket = qualifyActionBucket(q);
    if (bucket === "meeting") kpis.scheduleMeeting += 1;
    else if (bucket === "awaiting_wa") kpis.awaitingWhatsApp += 1;
    else if (bucket === "in_conversation") kpis.inConversation += 1;
    else if (bucket === "cadence") kpis.inCadence += 1;

    stageCounts.set(lead.stageId, (stageCounts.get(lead.stageId) ?? 0) + 1);

    if (bucket !== "other" || q.priority === "A" || q.priority === "B") {
      attentionRaw.push({
        id: lead.id,
        name: lead.contact?.name?.trim() || "Lead",
        priority: q.priority,
        priorityLabel: priorityHumanLabel(q.priority),
        nextAction: nextActionHuman({
          priority: q.priority,
          currentState: q.currentState,
          cadenceStatus: q.cadenceStatus,
          missingCount: q.missing.length,
        }),
        stageName: lead.stageId ? stageById.get(lead.stageId)?.name ?? null : null,
        createdAt: lead.createdAt.toISOString(),
        bucket,
        prioRank: q.priority ? (PRIORITY_RANK[q.priority] ?? 9) : 9,
      });
    }
  }

  const attention = attentionRaw
    .sort((a, b) => {
      const ba = ATTENTION_RANK[a.bucket];
      const bb = ATTENTION_RANK[b.bucket];
      if (ba !== bb) return ba - bb;
      if (a.prioRank !== b.prioRank) return a.prioRank - b.prioRank;
      return 0;
    })
    .slice(0, 8)
    .map(({ bucket: _b, prioRank: _p, ...rest }) => rest);

  const stages = pipeline.stages
    .filter((s) => !isLostStage(s) && !isWonStage(s))
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      count: stageCounts.get(s.id) ?? 0,
      role: s.role,
    }));

  return {
    period: { from: ymdBrt(range.gte), to: ymdBrt(range.lte) },
    kpis,
    stages,
    attention,
    midia: {
      investimento: Number(midiaRow._sum.investimento ?? 0),
      leadsMidia: Number(midiaRow._sum.leads ?? 0),
    },
  };
}
