import { prisma } from "@/lib/db";
import { newSessionId, newVisitorId } from "@/lib/symbius/attribution/ids";
import {
  isMeaningfulTouch,
  touchFromCampaign,
  type CampaignContext,
  type ClickIds,
  type TouchPoint,
} from "@/lib/symbius/attribution/types";

const SESSION_TTL_MS = 30 * 60 * 1000;

export async function ensureVisitor(params: {
  organizationId: string;
  anonymousId?: string | null;
  identityId?: string | null;
}) {
  const anonymousId = params.anonymousId?.trim() || newVisitorId();
  return prisma.trackingVisitor.upsert({
    where: {
      organizationId_anonymousId: {
        organizationId: params.organizationId,
        anonymousId,
      },
    },
    create: {
      organizationId: params.organizationId,
      anonymousId,
      identityId: params.identityId ?? undefined,
    },
    update: {
      identityId: params.identityId ?? undefined,
    },
  });
}

export async function ensureSession(params: {
  organizationId: string;
  visitorId: string;
  sessionId?: string | null;
  campaign?: CampaignContext | null;
  clickIds?: ClickIds | null;
  page?: { url?: string | null; referrer?: string | null } | null;
}) {
  const touch = touchFromCampaign(
    params.campaign,
    params.clickIds,
    params.page,
  );

  let session =
    params.sessionId?.trim()
      ? await prisma.trackingSession.findUnique({
          where: {
            organizationId_sessionId: {
              organizationId: params.organizationId,
              sessionId: params.sessionId.trim(),
            },
          },
        })
      : null;

  if (session) {
    const stale =
      Date.now() - new Date(session.lastSeenAt).getTime() > SESSION_TTL_MS;
    if (stale && isMeaningfulTouch(touch)) {
      // New session when stale + new campaign context
      session = null;
    }
  }

  if (!session) {
    const firstTouch = isMeaningfulTouch(touch) ? touch : null;
    session = await prisma.trackingSession.create({
      data: {
        organizationId: params.organizationId,
        sessionId: params.sessionId?.trim() || newSessionId(),
        visitorId: params.visitorId,
        landingPage: params.page?.url ?? undefined,
        referrer: params.page?.referrer ?? undefined,
        utmSource: touch.source ?? undefined,
        utmMedium: touch.medium ?? undefined,
        utmCampaign: touch.campaign ?? undefined,
        utmContent: touch.content ?? undefined,
        utmTerm: touch.term ?? undefined,
        fbclid: touch.fbclid ?? undefined,
        gclid: touch.gclid ?? undefined,
        ttclid: touch.ttclid ?? undefined,
        msclkid: touch.msclkid ?? undefined,
        firstTouch: firstTouch as object | undefined,
        lastTouch: firstTouch as object | undefined,
      },
    });
    return session;
  }

  const existingFirst = session.firstTouch as TouchPoint | null;
  const nextLast = isMeaningfulTouch(touch)
    ? touch
    : ((session.lastTouch as TouchPoint | null) ?? null);

  return prisma.trackingSession.update({
    where: { id: session.id },
    data: {
      lastSeenAt: new Date(),
      landingPage: session.landingPage ?? params.page?.url ?? undefined,
      referrer: params.page?.referrer ?? session.referrer ?? undefined,
      utmSource: touch.source ?? session.utmSource,
      utmMedium: touch.medium ?? session.utmMedium,
      utmCampaign: touch.campaign ?? session.utmCampaign,
      utmContent: touch.content ?? session.utmContent,
      utmTerm: touch.term ?? session.utmTerm,
      fbclid: touch.fbclid ?? session.fbclid,
      gclid: touch.gclid ?? session.gclid,
      ttclid: touch.ttclid ?? session.ttclid,
      msclkid: touch.msclkid ?? session.msclkid,
      firstTouch:
        existingFirst && isMeaningfulTouch(existingFirst)
          ? undefined
          : isMeaningfulTouch(touch)
            ? (touch as object)
            : undefined,
      lastTouch: nextLast ? (nextLast as object) : undefined,
    },
  });
}

export function sessionToTouch(
  session: {
    firstTouch: unknown;
    lastTouch: unknown;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    fbclid: string | null;
    gclid: string | null;
    ttclid: string | null;
    msclkid: string | null;
    landingPage: string | null;
    referrer: string | null;
  },
  which: "first" | "last",
): TouchPoint {
  const stored = (
    which === "first" ? session.firstTouch : session.lastTouch
  ) as TouchPoint | null;
  if (stored && isMeaningfulTouch(stored)) return stored;
  return {
    source: session.utmSource,
    medium: session.utmMedium,
    campaign: session.utmCampaign,
    content: session.utmContent,
    term: session.utmTerm,
    fbclid: session.fbclid,
    gclid: session.gclid,
    ttclid: session.ttclid,
    msclkid: session.msclkid,
    landingPage: session.landingPage,
    referrer: session.referrer,
  };
}
