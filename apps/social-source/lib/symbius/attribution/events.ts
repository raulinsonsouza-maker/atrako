import { prisma } from "@/lib/db";
import { newEventId } from "@/lib/symbius/attribution/ids";
import { identifyLead } from "@/lib/symbius/attribution/identify";
import { ensureSession, ensureVisitor } from "@/lib/symbius/attribution/session";
import type {
  CampaignContext,
  ClickIds,
} from "@/lib/symbius/attribution/types";
import { touchFromCampaign } from "@/lib/symbius/attribution/types";
import { fireOutboundWebhook } from "@/lib/symbius/integrations";

export type TrackEventInput = {
  organizationId: string;
  event: string;
  eventId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  stId?: string | null;
  email?: string | null;
  phone?: string | null;
  timestamp?: string | null;
  context?: {
    page?: { url?: string | null; referrer?: string | null };
    campaign?: CampaignContext | null;
    click_ids?: ClickIds | null;
  };
  properties?: Record<string, unknown>;
};

export async function trackEvent(input: TrackEventInput) {
  const eventId = input.eventId?.trim() || newEventId();
  const existing = await prisma.trackingEvent.findUnique({
    where: {
      organizationId_eventId: {
        organizationId: input.organizationId,
        eventId,
      },
    },
  });
  if (existing) return existing;

  let identityId: string | undefined;
  if (input.stId || input.email || input.phone) {
    const identity = await identifyLead({
      organizationId: input.organizationId,
      anonymousId: input.anonymousId,
      stId: input.stId,
      email: input.email,
      phone: input.phone,
      leadSource: touchFromCampaign(
        input.context?.campaign,
        input.context?.click_ids,
        input.context?.page,
      ),
    });
    identityId = identity.id;
  }

  const visitor = await ensureVisitor({
    organizationId: input.organizationId,
    anonymousId: input.anonymousId,
    identityId,
  });

  if (identityId && !visitor.identityId) {
    await prisma.trackingVisitor.update({
      where: { id: visitor.id },
      data: { identityId },
    });
  }

  const session = await ensureSession({
    organizationId: input.organizationId,
    visitorId: visitor.id,
    sessionId: input.sessionId,
    campaign: input.context?.campaign,
    clickIds: input.context?.click_ids,
    page: input.context?.page,
  });

  if (!identityId && visitor.identityId) {
    identityId = visitor.identityId;
  }

  const occurredAt = input.timestamp
    ? new Date(input.timestamp)
    : new Date();

  const row = await prisma.trackingEvent.create({
    data: {
      organizationId: input.organizationId,
      eventId,
      name: input.event,
      visitorId: visitor.id,
      sessionId: session.id,
      identityId,
      properties: (input.properties ?? {}) as object,
      context: (input.context ?? {}) as object,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    },
  });

  void fireOutboundWebhook(input.organizationId, `tracking.${input.event}`, {
    eventId: row.eventId,
    name: row.name,
    stId: input.stId,
    visitorId: visitor.anonymousId,
    sessionId: session.sessionId,
    properties: input.properties,
  });

  // Bridge legacy conversion types when applicable
  const legacyMap: Record<string, string> = {
    lead_created: "email_captured",
    email_captured: "email_captured",
    phone_captured: "phone_captured",
    link_clicked: "link_clicked",
  };
  const legacy = legacyMap[input.event];
  if (legacy) {
    try {
      const { recordConversion } = await import("@/lib/symbius/conversions");
      await recordConversion({
        organizationId: input.organizationId,
        tipo: legacy as "email_captured" | "phone_captured" | "link_clicked",
        metadata: {
          eventId: row.eventId,
          stId: input.stId,
          ...(input.properties ?? {}),
        },
      });
    } catch {
      // ignore bridge failures
    }
  }

  return row;
}
