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
import { ingestFinanceFromEvent } from "@/lib/atrako/finance-ledger";

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

const FINANCE_EVENTS = new Set<string>(["payment.paid", "order.completed", "revenue.recorded"]);

export async function publishAtrakoEvents(events: AtrakoEvent[]): Promise<void> {
  const { published } = await publishEventBatch(events);
  if (published) return;

  // Sem bridge HTTP (ATRAKO_EVENTS_URL), o Caixa ainda precisa receber pagamentos.
  for (const event of events) {
    if (!FINANCE_EVENTS.has(event.name)) continue;
    const workspaceId = event.context.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) continue;
    await ingestFinanceFromEvent({
      workspaceId,
      eventName: event.name,
      source: event.source,
      idempotencyKey: event.idempotencyKey,
      context: event.context as Record<string, unknown>,
      payload: event.payload as Record<string, unknown>,
      occurredAt: new Date(event.occurredAt),
    }).catch((err) => console.warn("[atrako/events] ledger fallback failed:", err));
  }
}
