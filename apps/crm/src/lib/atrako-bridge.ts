import { createEvent, publishEventBatch } from "@atrako/events";

/**
 * Helper do módulo CRM legado para publicar leads na ponte Atrako.
 * Requer ATRAKO_EVENTS_URL + ATRAKO_EVENTS_TOKEN no ambiente do CRM.
 */
export async function publishLeadCreated(input: {
  workspaceId: string;
  leadId: string;
  contactId?: string;
  campaignId?: string;
  payload?: Record<string, unknown>;
}) {
  const event = createEvent({
    name: "lead.created",
    source: "crm",
    idempotencyKey: `crm-lead-created-${input.leadId}`,
    context: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      contactId: input.contactId,
      campaignId: input.campaignId,
    },
    payload: input.payload ?? {},
  });
  return publishEventBatch([event]);
}

export async function publishConversationStarted(input: {
  workspaceId: string;
  leadId?: string;
  contactId?: string;
  payload?: Record<string, unknown>;
}) {
  const event = createEvent({
    name: "conversation.started",
    source: "whatsapp",
    idempotencyKey: `crm-conversation-${input.workspaceId}-${input.leadId ?? input.contactId ?? Date.now()}`,
    context: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      contactId: input.contactId,
    },
    payload: input.payload ?? {},
  });
  return publishEventBatch([event]);
}
