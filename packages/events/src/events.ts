export type AtrakoEventName =
  | "tracking.session_started"
  | "tracking.page_viewed"
  | "tracking.form_started"
  | "tracking.form_submitted"
  | "lead.created"
  | "lead.stage_changed"
  | "conversation.started"
  | "conversation.handoff_requested"
  | "booking.started"
  | "booking.created"
  | "booking.confirmed"
  | "checkout.started"
  | "checkout.abandoned"
  | "payment.paid"
  | "order.created"
  | "order.completed"
  | "revenue.recorded"
  | "social.comment_received"
  | "social.dm_sent"
  | "form.completed";

export const ATRAKO_EVENT_NAMES: readonly AtrakoEventName[] = [
  "tracking.session_started",
  "tracking.page_viewed",
  "tracking.form_started",
  "tracking.form_submitted",
  "lead.created",
  "lead.stage_changed",
  "conversation.started",
  "conversation.handoff_requested",
  "booking.started",
  "booking.created",
  "booking.confirmed",
  "checkout.started",
  "checkout.abandoned",
  "payment.paid",
  "order.created",
  "order.completed",
  "revenue.recorded",
  "social.comment_received",
  "social.dm_sent",
  "form.completed",
] as const;

export type AtrakoEventSource =
  | "central"
  | "atrako"
  | "crm"
  | "agendador"
  | "agenda"
  | "plataforma-de-vendas"
  | "commerce"
  | "social"
  | "meta"
  | "google"
  | "tiktok"
  | "linkedin"
  | "instagram"
  | "whatsapp"
  | "mercadolivre"
  | "system";

export interface AtrakoEventContext {
  workspaceId: string;
  contactId?: string;
  leadId?: string;
  sessionId?: string;
  campaignId?: string;
  creativeId?: string;
  pageId?: string;
  bookingId?: string;
  orderId?: string;
  paymentId?: string;
  formId?: string;
}

export interface AtrakoEvent<TPayload = Record<string, unknown>> {
  id: string;
  name: AtrakoEventName;
  version: 1;
  occurredAt: string;
  source: AtrakoEventSource;
  idempotencyKey: string;
  context: AtrakoEventContext;
  payload: TPayload;
}

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  event: AtrakoEvent<TPayload>;
  traceId: string;
}

export interface EventBatch<TPayload = Record<string, unknown>> {
  traceId: string;
  events: AtrakoEvent<TPayload>[];
}

export function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEvent<TPayload>(input: {
  id?: string;
  name: AtrakoEventName;
  source: AtrakoEventSource;
  idempotencyKey: string;
  context: AtrakoEventContext;
  payload: TPayload;
  occurredAt?: string;
}): AtrakoEvent<TPayload> {
  return {
    id: input.id ?? createEventId(),
    name: input.name,
    version: 1,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    context: input.context,
    payload: input.payload,
  };
}

export function isAtrakoEventName(value: string): value is AtrakoEventName {
  return (ATRAKO_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Publishes a batch of events to the Atrako shell bridge.
 * No-op when ATRAKO_EVENTS_URL is unset (local modules stay independent).
 */
export async function publishEventBatch(
  events: AtrakoEvent[],
  options?: { url?: string; token?: string; timeoutMs?: number },
): Promise<{ published: boolean; status?: number }> {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const url = options?.url ?? env.ATRAKO_EVENTS_URL?.trim();
  if (!url || events.length === 0) return { published: false };

  const token = options?.token ?? env.ATRAKO_EVENTS_TOKEN?.trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      traceId: createEventId(),
      events,
    } satisfies EventBatch),
    signal: AbortSignal.timeout(options?.timeoutMs ?? 10_000),
  });

  if (!response.ok) {
    throw new Error(`Atrako events bridge returned ${response.status}`);
  }

  return { published: true, status: response.status };
}
