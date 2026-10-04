/**
 * Atualização de MessageDelivery a partir de eventos (Resend webhook/sync, WA status, /r).
 * Flags monotônicas: aberto/clicado nunca voltam; status "último evento" por ranking.
 */

import { prisma } from "@/lib/db";

export type DeliveryEventType =
  | "sent"
  | "delivered"
  | "delayed"
  | "opened"
  | "clicked"
  | "converted"
  | "bounced"
  | "complained"
  | "failed"
  | "blocked"
  | "unsubscribed";

const RANK: Record<string, number> = {
  QUEUED: 0,
  SKIPPED: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
  CONVERTED: 5,
  FAILED: 6,
  BLOCKED: 6,
  BOUNCED: 7,
  COMPLAINED: 8,
};

const STATUS_BY_EVENT: Partial<Record<DeliveryEventType, string>> = {
  sent: "SENT",
  delivered: "DELIVERED",
  opened: "OPENED",
  clicked: "CLICKED",
  converted: "CONVERTED",
  bounced: "BOUNCED",
  complained: "COMPLAINED",
  failed: "FAILED",
  blocked: "BLOCKED",
};

const TIMESTAMP_FIELD: Partial<Record<DeliveryEventType, string>> = {
  sent: "sentAt",
  delivered: "deliveredAt",
  opened: "openedAt",
  clicked: "clickedAt",
  converted: "convertedAt",
  bounced: "bouncedAt",
  complained: "complainedAt",
  failed: "failedAt",
  blocked: "failedAt",
};

export function mapResendEventType(type: string): DeliveryEventType | null {
  switch (type) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "delayed";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

/** `last_event` do GET /emails → evento. */
export function mapResendLastEvent(lastEvent: string | undefined): DeliveryEventType | null {
  if (!lastEvent) return null;
  return mapResendEventType(lastEvent.startsWith("email.") ? lastEvent : `email.${lastEvent}`);
}

export function nextStatus(current: string, event: DeliveryEventType): string {
  const target = STATUS_BY_EVENT[event];
  if (!target) return current;
  if (current === "CONVERTED" && RANK[target] < RANK.BOUNCED) return current;
  return (RANK[target] ?? 0) >= (RANK[current] ?? 0) ? target : current;
}

/**
 * Aplica evento. `providerEventId` garante idempotência (svix-id / id de status WA).
 * Retorna false se o evento já tinha sido processado.
 */
export async function applyDeliveryEvent(input: {
  deliveryId: string;
  clienteId: string;
  contactId?: string | null;
  event: DeliveryEventType;
  at?: Date;
  meta?: Record<string, unknown>;
  providerEventId?: string | null;
  extra?: Record<string, unknown>;
  /** Sync de backup: não cria MessageEvent (evita duplicar timeline). */
  skipEventRow?: boolean;
}): Promise<boolean> {
  const at = input.at ?? new Date();
  if (!input.skipEventRow) {
    try {
      await prisma.messageEvent.create({
        data: {
          clienteId: input.clienteId,
          deliveryId: input.deliveryId,
          contactId: input.contactId ?? null,
          type: input.event,
          at,
          meta: (input.meta ?? undefined) as object | undefined,
          providerEventId: input.providerEventId ?? null,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return false;
      throw err;
    }
  }

  const d = await prisma.messageDelivery.findUnique({
    where: { id: input.deliveryId },
    select: {
      status: true,
      sentAt: true,
      deliveredAt: true,
      openedAt: true,
      clickedAt: true,
      convertedAt: true,
      bouncedAt: true,
      complainedAt: true,
      failedAt: true,
    },
  });
  if (!d) return true;

  const data: Record<string, unknown> = { ...(input.extra ?? {}) };
  const field = TIMESTAMP_FIELD[input.event];
  if (field && !(d as Record<string, unknown>)[field]) data[field] = at;
  // Abertura/clique implicam entrega
  if ((input.event === "opened" || input.event === "clicked") && !d.deliveredAt) {
    data.deliveredAt = at;
  }
  if (input.event === "clicked" && !d.openedAt) data.openedAt = at;
  const status = nextStatus(d.status, input.event);
  if (status !== d.status) data.status = status;
  if (Object.keys(data).length) {
    await prisma.messageDelivery.update({ where: { id: input.deliveryId }, data });
  }
  return true;
}

/** Supressão por bounce permanente / reclamação. */
export async function suppressContactEmail(
  contactId: string,
  reason: "bounce" | "complaint" | "unsubscribe",
) {
  const now = new Date();
  await prisma.nativeContact.update({
    where: { id: contactId },
    data:
      reason === "bounce"
        ? { emailBouncedAt: now }
        : reason === "complaint"
          ? { emailComplainedAt: now, emailOptOutAt: now }
          : { emailOptOutAt: now },
  });
}
