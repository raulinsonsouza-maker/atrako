/**
 * Início da área do cliente em uma leitura só: o que fazer agora, como foi o período (vs anterior),
 * onde os leads travam e de onde vem o resultado.
 */

import { prisma } from "@/lib/db";
import { ensureDefaultPipeline } from "@/lib/modules/crm";
import { getInsideSalesOverview } from "@/lib/qualification/overview";
import { parseLeadQualification } from "@/lib/qualification/store";
import { dateColumnRange, previousPeriod, type Period } from "@/lib/atendimento/period";
import {
  biggestDrop,
  buildFunnel,
  buildOrigins,
  originLabel,
  periodResult,
  periodSentence,
  type InicioLead,
} from "@/lib/atendimento/inicio-view";

const CONTACT_KEYS = new Set(["name", "email", "phone", "wa_opt_in"]);
const MEETING_STATES = new Set(["meeting_requested", "human_handoff"]);

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

async function loadLeads(workspaceId: string, p: Period, roleById: Map<string, string | null>) {
  const rows = await prisma.nativeLead.findMany({
    where: { clienteId: workspaceId, createdAt: { gte: p.gte, lte: p.lte } },
    select: { status: true, stageId: true, source: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return rows.map((row) => {
    const meta = asRecord(row.metadata);
    const q = parseLeadQualification(row.metadata);
    const lead: InicioLead & { originLabel: string } = {
      status: row.status,
      stageRole: row.stageId ? roleById.get(row.stageId) ?? null : null,
      source: row.source,
      campaign: text(meta.campaignName) || text(meta.utm_campaign),
      answered: Object.keys(q.answers).some((k) => !CONTACT_KEYS.has(k)),
      priority: q.priority === "A" || q.priority === "B" || q.priority === "C" ? q.priority : null,
      meeting: MEETING_STATES.has(q.currentState || ""),
      originLabel: originLabel(row.source, text(meta.utm_source)),
    };
    return lead;
  });
}

async function revenue(workspaceId: string, p: Period) {
  const rows = await prisma.workspaceLedgerEntry.groupBy({
    by: ["type"],
    where: { clienteId: workspaceId, status: "CONFIRMED", occurredAt: { gte: p.gte, lte: p.lte } },
    _sum: { amount: true },
  });
  const sum = (type: string) => Number(rows.find((r) => r.type === type)?._sum.amount ?? 0);
  return sum("INCOME") - sum("REFUND");
}

async function spend(workspaceId: string, p: Period) {
  const row = await prisma.fatoMidiaDiario.aggregate({
    where: { clienteId: workspaceId, data: dateColumnRange(p) },
    _sum: { investimento: true },
  });
  return Number(row._sum.investimento ?? 0);
}

async function wonCount(workspaceId: string, p: Period, wonStageIds: string[]) {
  return prisma.nativeLead.count({
    where: {
      clienteId: workspaceId,
      OR: [{ status: "WON" }, ...(wonStageIds.length ? [{ stageId: { in: wonStageIds } }] : [])],
      updatedAt: { gte: p.gte, lte: p.lte },
    },
  });
}

export async function getInicio(workspaceId: string, period: Period) {
  const prev = previousPeriod(period);
  const pipeline = await ensureDefaultPipeline(workspaceId);
  const roleById = new Map(pipeline.stages.map((s) => [s.id, (s as { role?: string | null }).role ?? null]));
  const wonStageIds = pipeline.stages.filter((s) => roleById.get(s.id) === "WON").map((s) => s.id);
  const now = new Date();

  const [leads, prevLeads, wonNow, wonPrev, revNow, revPrev, spendNow, spendPrev, campaignSpend, overview, pending] =
    await Promise.all([
      loadLeads(workspaceId, period, roleById),
      loadLeads(workspaceId, prev, roleById),
      wonCount(workspaceId, period, wonStageIds),
      wonCount(workspaceId, prev, wonStageIds),
      revenue(workspaceId, period),
      revenue(workspaceId, prev),
      spend(workspaceId, period),
      spend(workspaceId, prev),
      prisma.fatoMidiaDiario.groupBy({
        by: ["campaignName"],
        where: { clienteId: workspaceId, data: dateColumnRange(period) },
        _sum: { investimento: true },
      }),
      getInsideSalesOverview(workspaceId, { gte: period.gte, lte: period.lte }),
      prisma.leadPaymentLink.aggregate({
        where: { clienteId: workspaceId, status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);

  const current = periodResult({ leads, revenue: revNow, spend: spendNow, won: wonNow });
  const previous = periodResult({ leads: prevLeads, revenue: revPrev, spend: spendPrev, won: wonPrev });
  const funnel = buildFunnel(leads);
  const spendByCampaign = new Map(
    campaignSpend
      .filter((r) => r.campaignName && Number(r._sum.investimento ?? 0) > 0)
      .map((r) => [r.campaignName, Number(r._sum.investimento ?? 0)] as const),
  );

  return {
    period: { from: period.from, to: period.to, days: period.days },
    previousPeriod: { from: prev.from, to: prev.to },
    now: {
      openLeads: overview.kpis.openLeads,
      scheduleMeeting: overview.kpis.scheduleMeeting,
      awaitingWhatsApp: overview.kpis.awaitingWhatsApp,
      inConversation: overview.kpis.inConversation,
      inCadence: overview.kpis.inCadence,
      pendingLinks: { count: pending._count, amount: (pending._sum.amountCents ?? 0) / 100 },
      attention: overview.attention,
      stages: overview.stages,
    },
    current,
    previous,
    summary: periodSentence(current),
    funnel,
    drop: biggestDrop(funnel),
    origins: buildOrigins(leads, spendByCampaign),
  };
}

export type Inicio = Awaited<ReturnType<typeof getInicio>>;
