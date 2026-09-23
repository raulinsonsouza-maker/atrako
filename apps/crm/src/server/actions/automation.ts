"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { z } from "zod";
import { AutomationTrigger, LeadStatus, Prisma } from "@prisma/client";
import { createTask } from "./task";
import { updateLead } from "./lead";
import { sendWhatsAppMessage } from "./conversation";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  enabled: z.boolean().default(true),
  trigger: z.nativeEnum(AutomationTrigger),
  triggerConfig: z.record(z.unknown()).optional(),
  actions: z.array(z.record(z.unknown())),
  order: z.number().int().default(0),
});

const updateSchema = createSchema.partial();

export async function listAutomationRules(tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.automationRule.findMany({
    where: { tenantId },
    orderBy: [{ enabled: "desc" }, { order: "asc" }],
  });
}

export async function getAutomationRule(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.automationRule.findFirst({
    where: { id, tenantId },
  });
}

export async function createAutomationRule(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);

  const d = createSchema.parse(data);
  return db.automationRule.create({
    data: {
      tenantId,
      name: d.name.trim(),
      enabled: d.enabled ?? true,
      trigger: d.trigger,
      triggerConfig: d.triggerConfig ? (d.triggerConfig as Prisma.InputJsonValue) : Prisma.JsonNull,
      actions: d.actions as Prisma.InputJsonValue,
      order: d.order ?? 0,
    },
  });
}

export async function updateAutomationRule(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  await assertTenantAccess(tenantId);

  const d = updateSchema.parse(data);
  const updateData: {
    name?: string;
    enabled?: boolean;
    trigger?: AutomationTrigger;
    triggerConfig?: Prisma.InputJsonValue | Prisma.JsonNullValueInput;
    actions?: Prisma.InputJsonValue;
    order?: number;
  } = {};
  if (d.name !== undefined) updateData.name = d.name.trim();
  if (d.enabled !== undefined) updateData.enabled = d.enabled;
  if (d.trigger !== undefined) updateData.trigger = d.trigger;
  if (d.triggerConfig !== undefined) {
    updateData.triggerConfig = d.triggerConfig ? (d.triggerConfig as Prisma.InputJsonValue) : Prisma.JsonNull;
  }
  if (d.actions !== undefined) updateData.actions = d.actions as Prisma.InputJsonValue;
  if (d.order !== undefined) updateData.order = d.order;

  return db.automationRule.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteAutomationRule(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.automationRule.deleteMany({
    where: { id, tenantId },
  });
}

// Engine de execução de automações
export async function executeAutomations(
  tenantId: string,
  trigger: AutomationTrigger,
  context: {
    leadId?: string;
    stageId?: string;
    status?: string;
    assignedToId?: string | null;
    [key: string]: unknown;
  }
) {
  // Buscar regras habilitadas para este trigger
  const rules = await db.automationRule.findMany({
    where: {
      tenantId,
      enabled: true,
      trigger,
    },
    orderBy: { order: "asc" },
  });

  for (const rule of rules) {
    // Verificar condições do triggerConfig
    if (rule.triggerConfig) {
      const config = rule.triggerConfig as Record<string, unknown>;
      let shouldExecute = true;

      if (config.stageId && context.stageId !== config.stageId) {
        shouldExecute = false;
      }
      if (config.status && context.status !== config.status) {
        shouldExecute = false;
      }
      if (config.source && context.source !== config.source) {
        shouldExecute = false;
      }

      if (!shouldExecute) continue;
    }

    // Executar ações
    const actions = rule.actions as Array<Record<string, unknown>>;
    for (const action of actions) {
      try {
        await executeAction(tenantId, action, context);
      } catch (error) {
        console.error(`[Automation] Erro ao executar ação na regra ${rule.id}:`, error);
        // Continuar com próxima ação mesmo em caso de erro
      }
    }
  }
}

async function executeAction(
  tenantId: string,
  action: Record<string, unknown>,
  context: Record<string, unknown>
) {
  const actionType = action.type as string;

  switch (actionType) {
    case "CHANGE_STAGE":
      if (context.leadId && action.stageId) {
        await updateLead(context.leadId as string, tenantId, {
          stageId: action.stageId as string,
        });
      }
      break;

    case "CHANGE_STATUS":
      if (context.leadId && action.status) {
        await updateLead(context.leadId as string, tenantId, {
          status: action.status as LeadStatus,
        });
      }
      break;

    case "ASSIGN_TO":
      if (context.leadId && action.userId) {
        await updateLead(context.leadId as string, tenantId, {
          assignedToId: action.userId as string,
        });
      }
      break;

    case "CREATE_TASK":
      if (context.leadId && action.title) {
        await createTask(tenantId, {
          leadId: context.leadId as string,
          type: (action.taskType as "manual" | "stage" | "no_reply") || "manual",
          title: action.title as string,
          dueAt: action.dueAt ? new Date(action.dueAt as string) : undefined,
          assignedToId: action.assignedToId ? (action.assignedToId as string) : null,
        });
      }
      break;

    case "SEND_WHATSAPP":
      if (context.leadId && action.message && action.conversationId) {
        try {
          await sendWhatsAppMessage(tenantId, action.conversationId as string, action.message as string);
        } catch (error) {
          console.error("[Automation] Erro ao enviar WhatsApp:", error);
        }
      }
      break;

    default:
      console.warn(`[Automation] Tipo de ação desconhecido: ${actionType}`);
  }
}
