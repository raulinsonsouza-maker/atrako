import { createEvent, publishEventBatch } from "@atrako/events";
import { getAtrakoWorkspaceId } from "@/lib/symbius/atrako-connections";

export async function publishSocialLeadEvent(input: {
  name: "lead.created" | "conversation.started" | "form.completed";
  leadId?: string;
  contactId?: string;
  payload?: Record<string, unknown>;
}) {
  const workspaceId = getAtrakoWorkspaceId();
  if (!workspaceId) return { published: false };

  const event = createEvent({
    name: input.name,
    source: "social",
    idempotencyKey: `social-${input.name}-${input.leadId ?? input.contactId ?? Date.now()}`,
    context: {
      workspaceId,
      leadId: input.leadId,
      contactId: input.contactId,
    },
    payload: input.payload ?? {},
  });
  return publishEventBatch([event]);
}
