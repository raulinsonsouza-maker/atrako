/**
 * Encaminhamento A/B/C → stage CRM + notify + handoff.
 * Soft = só etapa (cadência ainda roda). Hard = handoff quando o lead pediu conversa.
 */

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { handoffConversation } from "@/lib/whatsapp/domain";
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

/** Após form/cadastro: move etapa e avisa a equipe sem fechar a cadência. */
export async function applySoftPriorityRouting(input: {
  workspaceId: string;
  leadId: string;
  priority: Priority;
  contactName?: string | null;
}) {
  await moveLeadToPriorityStage(input);
  await notify({
    clienteId: input.workspaceId,
    role: "ADMIN",
    type: "wa.qualify_captured",
    title:
      input.priority === "C"
        ? "Novo lead franquia (nutrição)"
        : "Novo lead franquia — aguardando WhatsApp",
    body: `${input.contactName || "Lead"} preencheu o formulário (${input.priority === "A" ? "quente" : input.priority === "B" ? "interessado" : "nutrição"}). A cadência no WhatsApp já começou.`,
    href: "/crm",
    severity: "info",
    dedupeKey: `qualify-soft:${input.leadId}`,
    email: false,
  });
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

/** Lead pediu conversa / handoff humano — aí sim agenda. */
export async function applyPriorityRouting(input: {
  workspaceId: string;
  leadId: string;
  conversationId: string;
  priority: Priority;
  contactName?: string | null;
}) {
  await moveLeadToPriorityStage(input);
  await exitFranchiseNurture(input.workspaceId, input.leadId, "meeting_requested");

  if (input.priority === "A" || input.priority === "B") {
    await handoffConversation(input.conversationId, input.workspaceId);
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: input.priority === "A" ? "wa.qualified_a" : "wa.qualified_b",
      title:
        input.priority === "A"
          ? "Lead franquia quente — pediu conversa"
          : "Lead franquia interessado — pediu conversa",
      body: `${input.contactName || "Lead"} pediu para falar com a equipe. Abra o WhatsApp e continue a conversa.`,
      href: "/whatsapp",
      severity: input.priority === "A" ? "urgente" : "aviso",
      dedupeKey: `qualify-${input.priority}:${input.leadId}`,
      email: input.priority === "A",
    });
  } else {
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: "wa.qualified_c",
      title: "Lead franquia em nutrição",
      body: `${input.contactName || "Lead"} segue na nutrição — manter contato leve.`,
      href: "/crm",
      severity: "info",
      dedupeKey: `qualify-C:${input.leadId}`,
      email: false,
    });
  }
}
