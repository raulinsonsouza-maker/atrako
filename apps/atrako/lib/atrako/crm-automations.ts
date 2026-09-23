import { createEvent, publishEventBatch, type AtrakoEvent } from "@atrako/events";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import {
  sendAndPersistText,
  sendAndPersistTemplate,
  handoffConversation,
  normalizeWaPhone,
} from "@/lib/whatsapp/domain";
import { prisma } from "@/lib/db";

export type AutomationKind =
  | "welcome"
  | "abandonment"
  | "birthday"
  | "handoff";

export interface AutomationDraft {
  kind: AutomationKind;
  workspaceId: string;
  contactId?: string;
  leadId?: string;
  phone?: string;
  message: string;
  channel: "whatsapp";
  templateName?: string;
  conversationId?: string;
}

/**
 * Planeja automações CRM→WhatsApp. Efeitos externos exigem confirmação no agente.
 */
export function planCrmAutomation(draft: AutomationDraft): {
  event: AtrakoEvent;
  requiresConfirmation: boolean;
  summary: string;
} {
  const name =
    draft.kind === "handoff" ? "conversation.handoff_requested" : "conversation.started";

  const event = createEvent({
    name,
    source: "crm",
    idempotencyKey: `crm-auto-${draft.kind}-${draft.workspaceId}-${draft.leadId ?? draft.contactId ?? "anon"}-${Date.now()}`,
    context: {
      workspaceId: draft.workspaceId,
      contactId: draft.contactId,
      leadId: draft.leadId,
    },
    payload: {
      kind: draft.kind,
      channel: draft.channel,
      message: draft.message,
      phone: draft.phone,
      templateName: draft.templateName,
      conversationId: draft.conversationId,
    },
  });

  return {
    event,
    requiresConfirmation: true,
    summary: `Automação ${draft.kind} via WhatsApp para workspace ${draft.workspaceId}`,
  };
}

async function resolvePhone(draft: AutomationDraft) {
  if (draft.phone) return normalizeWaPhone(draft.phone);
  if (draft.contactId) {
    const c = await prisma.nativeContact.findFirst({
      where: { id: draft.contactId, clienteId: draft.workspaceId },
    });
    if (c?.phone) return normalizeWaPhone(c.phone);
  }
  return null;
}

/** Publica evento e, se confirmado, envia WhatsApp de verdade (Cloud API). */
export async function publishCrmAutomation(draft: AutomationDraft, confirmed: boolean) {
  const plan = planCrmAutomation(draft);
  if (!confirmed) {
    return { status: "NEEDS_CONFIRMATION" as const, plan };
  }
  await publishEventBatch([plan.event]);

  const wa = await resolveWhatsApp(draft.workspaceId);
  if (!wa) {
    return { status: "PUBLISHED" as const, plan, send: "SKIPPED_NO_WA" as const };
  }

  try {
    if (draft.kind === "handoff") {
      if (draft.conversationId) {
        await handoffConversation(draft.conversationId, draft.workspaceId);
      }
      const phone = await resolvePhone(draft);
      if (phone) {
        await sendAndPersistText({
          workspaceId: draft.workspaceId,
          to: phone,
          body: draft.message || AUTOMATION_TEMPLATES.handoff,
          contactId: draft.contactId,
        });
      }
      return { status: "PUBLISHED" as const, plan, send: "OK" as const };
    }

    const phone = await resolvePhone(draft);
    if (!phone) {
      return { status: "PUBLISHED" as const, plan, send: "SKIPPED_NO_PHONE" as const };
    }

    if (draft.templateName) {
      await sendAndPersistTemplate({
        workspaceId: draft.workspaceId,
        to: phone,
        templateName: draft.templateName,
        contactId: draft.contactId,
        previewBody: draft.message,
      });
    } else {
      await sendAndPersistText({
        workspaceId: draft.workspaceId,
        to: phone,
        body: draft.message,
        contactId: draft.contactId,
      });
    }
    return { status: "PUBLISHED" as const, plan, send: "OK" as const };
  } catch (e) {
    console.warn("[crm-automations] send failed", e);
    return {
      status: "PUBLISHED" as const,
      plan,
      send: "FAILED" as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const AUTOMATION_TEMPLATES: Record<AutomationKind, string> = {
  welcome: "Olá, vimos que você iniciou seu cadastro. Posso te ajudar a concluir?",
  abandonment: "Olá, vimos que você começou e ainda não concluiu. Quer retomar de onde parou?",
  birthday: "Olá! Hoje é seu aniversário. Preparamos um presente especial para você.",
  handoff: "Vou transferir você para um atendente humano agora.",
};
