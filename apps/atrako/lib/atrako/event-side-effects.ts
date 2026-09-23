import { upsertLeadFromEvent } from "@/lib/atrako/lead-pipeline";
import { ingestFinanceFromEvent } from "@/lib/atrako/finance-ledger";
import { processWhatsAppEventSideEffects } from "@/lib/whatsapp/triggers";

const LEAD_EVENTS = new Set([
  "lead.created",
  "lead.stage_changed",
  "form.completed",
  "tracking.form_submitted",
  "conversation.started",
  "booking.created",
  "booking.confirmed",
]);

const FINANCE_EVENTS = new Set([
  "payment.paid",
  "order.completed",
  "revenue.recorded",
]);

const WHATSAPP_EVENTS = new Set([
  "lead.created",
  "form.completed",
  "tracking.form_submitted",
  "conversation.started",
  "conversation.handoff_requested",
  "checkout.abandoned",
  "booking.created",
  "booking.confirmed",
]);

/** Processa side-effects do bridge: leads + ledger + WhatsApp. */
export async function processAtrakoEventSideEffects(event: {
  name: string;
  source: string;
  idempotencyKey: string;
  occurredAt: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const workspaceId = event.context.workspaceId;
  if (typeof workspaceId !== "string" || !workspaceId) return;

  if (LEAD_EVENTS.has(event.name)) {
    await upsertLeadFromEvent({
      workspaceId,
      eventName: event.name,
      source: event.source,
      idempotencyKey: event.idempotencyKey,
      context: event.context,
      payload: event.payload,
    });
  }

  if (FINANCE_EVENTS.has(event.name)) {
    await ingestFinanceFromEvent({
      workspaceId,
      eventName: event.name,
      source: event.source,
      idempotencyKey: event.idempotencyKey,
      context: event.context,
      payload: event.payload,
      occurredAt: new Date(event.occurredAt),
    });
  }

  // Booking pago: se payload tiver amount, também registra receita
  if (
    (event.name === "booking.confirmed" || event.name === "booking.created") &&
    (typeof event.payload.amount === "number" || typeof event.payload.valor === "number")
  ) {
    await ingestFinanceFromEvent({
      workspaceId,
      eventName: "payment.paid",
      source: event.source || "agenda",
      idempotencyKey: `${event.idempotencyKey}:pay`,
      context: event.context,
      payload: { ...event.payload, provider: event.payload.provider ?? "MERCADO_PAGO" },
      occurredAt: new Date(event.occurredAt),
    });
  }

  if (
    WHATSAPP_EVENTS.has(event.name) ||
    event.payload.channel === "whatsapp" ||
    event.payload.kind === "abandonment" ||
    event.payload.kind === "birthday" ||
    event.payload.kind === "welcome"
  ) {
    await processWhatsAppEventSideEffects(event).catch((err) =>
      console.warn("[atrako] whatsapp side-effect failed:", err),
    );
  }
}