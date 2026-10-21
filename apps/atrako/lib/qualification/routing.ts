/**
 * Encaminhamento A/B/C → etapa do CRM + aviso para a equipe.
 */

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { exitEnrollments } from "@/lib/flows/engine";
import { fireAndForget, sendCrmStageConversion } from "@/lib/integrations/meta/capi";
import type { Priority } from "./classify";

async function findStageByName(workspaceId: string, names: string[]) {
  const stages = await prisma.crmStage.findMany({
    where: { pipeline: { clienteId: workspaceId } },
    select: { id: true, name: true },
  });
  const lower = names.map((n) => n.toLowerCase());
  return stages.find((s) => lower.some((n) => s.name.toLowerCase().includes(n))) ?? null;
}

export async function moveLeadToPriorityStage(input: {
  workspaceId: string;
  leadId: string;
  priority: Priority;
}) {
  const stage =
    input.priority === "C"
      ? await findStageByName(input.workspaceId, ["nutrição", "nutricao", "nurture"])
      : await findStageByName(input.workspaceId, ["qualificado", "qualificação", "qualificacao"]);

  if (!stage) return;
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { stageId: true },
  });
  if (!lead || lead.stageId === stage.id) return;
  await prisma.nativeLead.updateMany({
    where: { id: input.leadId, clienteId: input.workspaceId },
    data: { stageId: stage.id },
  });
  fireAndForget(
    sendCrmStageConversion({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      stageId: stage.id,
      stageName: stage.name,
    }),
    "qualify stage",
  );
}

/** Lead pediu conversa ou humano: a nutrição por e-mail da franquia para. */
export async function exitFranchiseNurture(workspaceId: string, leadId: string, reason: string) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: leadId, clienteId: workspaceId },
    select: { contactId: true },
  });
  if (!lead?.contactId) return;
  await exitEnrollments({
    clienteId: workspaceId,
    contactId: lead.contactId,
    reason,
    triggers: ["franchise_nurture"],
  }).catch((err) => console.warn("[qualification] nurture exit", err instanceof Error ? err.message : err));
}

/** Conversa passou para a equipe — aviso com a ficha. */
export async function notifyHandoff(input: {
  workspaceId: string;
  leadId: string;
  priority: Priority | null;
  contactName?: string | null;
  brief: string;
}) {
  const name = input.contactName || "Lead";
  const hot = input.priority === "A";
  await notify({
    clienteId: input.workspaceId,
    role: "ADMIN",
    type: hot ? "wa.qualified_a" : input.priority === "B" ? "wa.qualified_b" : "wa.handoff",
    title: hot ? `${name} · lead quente quer conversar` : `${name} quer falar com um consultor`,
    body: input.brief.split("\n").slice(1).join(" · "),
    href: `/crm/leads/${input.leadId}`,
    severity: hot ? "urgente" : "aviso",
    dedupeKey: `qualify-handoff:${input.leadId}`,
    email: hot,
  });
}

export async function notifyNurture(input: { workspaceId: string; leadId: string; contactName?: string | null }) {
  await notify({
    clienteId: input.workspaceId,
    role: "ADMIN",
    type: "wa.qualified_c",
    title: `${input.contactName || "Lead"} foi para a nutrição`,
    body: "Ainda avaliando. Segue nos e-mails e volta para a equipe se pedir conversa.",
    href: `/crm/leads/${input.leadId}`,
    severity: "info",
    dedupeKey: `qualify-C:${input.leadId}`,
    email: false,
  });
}
