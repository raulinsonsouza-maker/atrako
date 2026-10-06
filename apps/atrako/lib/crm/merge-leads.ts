/**
 * Junta cards duplicados do mesmo contato (criados quando cada compra abria um lead novo).
 * Fica o card mais antigo; pedidos, carrinhos, fluxos e lançamentos passam para ele.
 * Idempotente: contato com um card só não muda.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { contactLifetimeCents } from "@/lib/crm/lead-value";
import { readStageHistory } from "@/lib/crm/stage-history";

type LeadRow = Awaited<ReturnType<typeof loadLeads>>[number];

function loadLeads(clienteId: string) {
  return prisma.nativeLead.findMany({
    where: { clienteId, contactId: { not: null } },
    select: {
      id: true,
      contactId: true,
      stageId: true,
      status: true,
      source: true,
      dealValue: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function pickIso(values: unknown[], pick: "min" | "max"): string | undefined {
  const isos = values.filter((v): v is string => typeof v === "string" && !!v).sort();
  return pick === "min" ? isos[0] : isos[isos.length - 1];
}

function mergedMetadata(leads: LeadRow[], finalStatus: string) {
  const byUpdate = [...leads].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const metas = byUpdate.map((l) => asRecord(l.metadata));
  const merged: Record<string, unknown> = Object.assign({}, ...metas);
  const seen = new Set<string>();
  merged.stageHistory = metas
    .flatMap((m) => readStageHistory(m))
    .filter((e) => {
      const key = `${e.at}|${e.stageId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-40);
  const paidAt = pickIso(metas.map((m) => m.paidAt), "min");
  const lastPaidAt = pickIso(metas.flatMap((m) => [m.lastPaidAt, m.paidAt]), "max");
  if (paidAt) merged.paidAt = paidAt;
  if (lastPaidAt) merged.lastPaidAt = lastPaidAt;
  if (finalStatus !== "LOST") {
    delete merged.lostReason;
    delete merged.lostAt;
  }
  return merged;
}

export async function mergeDuplicateLeads(clienteId: string): Promise<{ contacts: number; removed: number }> {
  const leads = await loadLeads(clienteId);
  const byContact = new Map<string, LeadRow[]>();
  for (const l of leads) {
    const list = byContact.get(l.contactId!) ?? [];
    list.push(l);
    byContact.set(l.contactId!, list);
  }

  let contacts = 0;
  let removed = 0;
  for (const [contactId, group] of byContact) {
    if (group.length < 2) continue;
    const keeper = group[0];
    const dupIds = group.slice(1).map((l) => l.id);
    const latest = (rows: LeadRow[]) => [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const won = group.filter((l) => l.status === "WON");
    const state = won.length ? latest(won) : latest(group);
    const dealCents =
      state.status === "WON"
        ? await contactLifetimeCents(clienteId, contactId)
        : state.dealValue != null
          ? Math.round(Number(state.dealValue) * 100)
          : null;

    await prisma.$transaction([
      prisma.marketplaceOrder.updateMany({ where: { clienteId, leadId: { in: dupIds } }, data: { leadId: keeper.id } }),
      prisma.abandonedCart.updateMany({ where: { clienteId, leadId: { in: dupIds } }, data: { leadId: keeper.id } }),
      prisma.messageFlowEnrollment.updateMany({ where: { clienteId, leadId: { in: dupIds } }, data: { leadId: keeper.id } }),
      prisma.workspaceLedgerEntry.updateMany({ where: { clienteId, leadId: { in: dupIds } }, data: { leadId: keeper.id } }),
      prisma.nativeLead.update({
        where: { id: keeper.id },
        data: {
          status: state.status,
          stageId: state.stageId,
          source: keeper.source ?? group.find((l) => l.source)?.source ?? null,
          dealValue: dealCents != null && dealCents > 0 ? new Prisma.Decimal(dealCents / 100) : null,
          metadata: mergedMetadata(group, state.status) as Prisma.InputJsonValue,
        },
      }),
      prisma.nativeLead.deleteMany({ where: { id: { in: dupIds } } }),
    ]);
    contacts++;
    removed += dupIds.length;
  }
  return { contacts, removed };
}
