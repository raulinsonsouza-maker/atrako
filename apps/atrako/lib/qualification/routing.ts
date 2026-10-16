/**
 * Encaminhamento A/B/C → stage CRM + notify + handoff.
 */

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { handoffConversation } from "@/lib/whatsapp/domain";
import type { Priority } from "./classify";

async function findStageByName(workspaceId: string, names: string[]) {
  const stages = await prisma.crmStage.findMany({
    where: { pipeline: { clienteId: workspaceId } },
    select: { id: true, name: true },
  });
  const lower = names.map((n) => n.toLowerCase());
  return stages.find((s) => lower.some((n) => s.name.toLowerCase().includes(n))) ?? null;
}

export async function applyPriorityRouting(input: {
  workspaceId: string;
  leadId: string;
  conversationId: string;
  priority: Priority;
  contactName?: string | null;
}) {
  const stage =
    input.priority === "C"
      ? await findStageByName(input.workspaceId, ["nutrição", "nutricao", "nurture"])
      : await findStageByName(input.workspaceId, ["qualificado", "qualificação", "qualificacao"]);

  if (stage) {
    await prisma.nativeLead.updateMany({
      where: { id: input.leadId, clienteId: input.workspaceId },
      data: { stageId: stage.id },
    });
  }

  if (input.priority === "A" || input.priority === "B") {
    await handoffConversation(input.conversationId, input.workspaceId);
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: input.priority === "A" ? "wa.qualified_a" : "wa.qualified_b",
      title:
        input.priority === "A"
          ? "Lead franquia prioridade A — agendar reunião"
          : "Lead franquia prioridade B — follow-up comercial",
      body: `${input.contactName || "Lead"} qualificado (${input.priority}). Abrir CRM e agendar a primeira reunião.`,
      href: "/crm",
      severity: input.priority === "A" ? "urgente" : "aviso",
      dedupeKey: `qualify-${input.priority}:${input.leadId}`,
      email: input.priority === "A",
    });
  } else {
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: "wa.qualified_c",
      title: "Lead franquia em nutrição (C)",
      body: `${input.contactName || "Lead"} ficou na prioridade C — cadência de nutrição.`,
      href: "/crm",
      severity: "info",
      dedupeKey: `qualify-C:${input.leadId}`,
      email: false,
    });
  }
}
