import { createEvent, publishEventBatch } from "@atrako/events";

export async function publishCheckoutEvent(input: {
  name:
    | "checkout.started"
    | "checkout.abandoned"
    | "payment.paid"
    | "order.created"
    | "order.completed"
    | "revenue.recorded"
    | "lead.created";
  workspaceId: string;
  orderId?: string;
  paymentId?: string;
  contactId?: string;
  campaignId?: string;
  payload?: Record<string, unknown>;
}) {
  const event = createEvent({
    name: input.name,
    source: "commerce",
    idempotencyKey: `commerce-${input.name}-${input.orderId ?? input.paymentId ?? Date.now()}`,
    context: {
      workspaceId: input.workspaceId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      contactId: input.contactId,
      campaignId: input.campaignId,
    },
    payload: input.payload ?? {},
  });
  return publishEventBatch([event]);
}

export type LandingPageDraft = {
  workspaceId: string;
  brief: string;
  priceCents?: number;
  withCheckout: boolean;
};

export function createLandingPageDraft(input: LandingPageDraft) {
  return {
    status: "DRAFT" as const,
    slug: input.brief
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60),
    salesPage: {
      headline: input.brief,
      subheadline: "Gerado pelo agente Atrako",
      bullets: [] as string[],
      faq: [] as string[],
    },
    checkout: input.withCheckout
      ? { provider: "mercado_pago", priceCents: input.priceCents ?? 0 }
      : null,
  };
}
