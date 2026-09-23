/**
 * Shell bridge: publishes domain events using the shared @atrako/events contract.
 * Storage remains in the shell DB; `Cliente.id` is the runtime workspaceId.
 */
import {
  createEvent,
  createEventId,
  publishEventBatch,
  type AtrakoEvent,
  type AtrakoEventName,
} from "@atrako/events";

export type { AtrakoEvent, AtrakoEventName };

export type ShellLeadEventName = Extract<AtrakoEventName, "lead.created" | "lead.stage_changed">;

export function createLeadEvent(input: {
  name: ShellLeadEventName;
  workspaceId: string;
  leadId: string;
  contactId?: string;
  campaignId?: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}): AtrakoEvent {
  return createEvent({
    id: createEventId(),
    name: input.name,
    source: "atrako",
    idempotencyKey: input.idempotencyKey,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    context: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      contactId: input.contactId,
      campaignId: input.campaignId,
    },
    payload: input.payload,
  });
}

export async function publishAtrakoEvents(events: AtrakoEvent[]): Promise<void> {
  await publishEventBatch(events);
}
