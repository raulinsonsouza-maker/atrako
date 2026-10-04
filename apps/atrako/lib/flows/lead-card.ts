/**
 * Seções "Comunicações" e "Cliente" do card do lead.
 */

import { prisma } from "@/lib/db";
import { LIFECYCLE_LABELS, type Lifecycle } from "@/lib/flows/profile";

export async function leadCommunications(workspaceId: string, contactId: string) {
  const [contact, enrollments, deliveries, profile, birthday] = await Promise.all([
    prisma.nativeContact.findFirst({
      where: { id: contactId, clienteId: workspaceId },
      select: {
        email: true,
        phone: true,
        emailOptOutAt: true,
        emailBouncedAt: true,
        emailComplainedAt: true,
        waOptOutAt: true,
        waMarketingOptOutAt: true,
        marketingConsentAt: true,
        consentSource: true,
        flowsPausedUntil: true,
      },
    }),
    prisma.messageFlowEnrollment.findMany({
      where: { clienteId: workspaceId, contactId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { flow: { select: { name: true, steps: { select: { id: true }, where: { enabled: true } } } } },
    }),
    prisma.messageDelivery.findMany({
      where: { clienteId: workspaceId, contactId, isTest: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        channel: true,
        status: true,
        subject: true,
        templateName: true,
        flowId: true,
        campaignId: true,
        couponCode: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        convertedAt: true,
        convertedCents: true,
        conversionKind: true,
        bouncedAt: true,
        failedAt: true,
        error: true,
        createdAt: true,
      },
    }),
    prisma.customerProfile.findUnique({ where: { contactId } }),
    prisma.contactImportantDate.findFirst({
      where: { contactId, kind: "BIRTHDAY" },
      select: { day: true, month: true, year: true, source: true },
    }),
  ]);
  const flowIds = Array.from(new Set(deliveries.map((d) => d.flowId).filter((v): v is string => Boolean(v))));
  const campaignIds = Array.from(new Set(deliveries.map((d) => d.campaignId).filter((v): v is string => Boolean(v))));
  const [flows, campaigns] = await Promise.all([
    flowIds.length ? prisma.messageFlow.findMany({ where: { id: { in: flowIds } }, select: { id: true, name: true } }) : [],
    campaignIds.length
      ? prisma.messageCampaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const names = new Map([...flows, ...campaigns].map((x) => [x.id, x.name]));
  const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

  return {
    channels: {
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      emailOptOutAt: iso(contact?.emailOptOutAt),
      emailBouncedAt: iso(contact?.emailBouncedAt),
      emailComplainedAt: iso(contact?.emailComplainedAt),
      waOptOutAt: iso(contact?.waOptOutAt),
      waMarketingOptOutAt: iso(contact?.waMarketingOptOutAt),
      marketingConsentAt: iso(contact?.marketingConsentAt),
      consentSource: contact?.consentSource ?? null,
      flowsPausedUntil: contact?.flowsPausedUntil && contact.flowsPausedUntil > new Date() ? iso(contact.flowsPausedUntil) : null,
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      flowName: e.flow.name,
      status: e.status,
      stepIndex: e.stepIndex,
      totalSteps: e.flow.steps.length,
      nextRunAt: iso(e.nextRunAt),
      exitReason: e.exitReason,
      holdout: e.holdout,
      convertedCents: e.convertedCents,
      createdAt: e.createdAt.toISOString(),
    })),
    deliveries: deliveries.map((d) => ({
      id: d.id,
      channel: d.channel,
      status: d.status,
      title: d.subject ?? d.templateName ?? (d.channel === "EMAIL" ? "E-mail" : "WhatsApp"),
      origin: (d.flowId && names.get(d.flowId)) || (d.campaignId && names.get(d.campaignId)) || "Avulso",
      couponCode: d.couponCode,
      sentAt: iso(d.sentAt),
      deliveredAt: iso(d.deliveredAt),
      openedAt: iso(d.openedAt),
      clickedAt: iso(d.clickedAt),
      convertedAt: iso(d.convertedAt),
      convertedCents: d.convertedCents,
      conversionKind: d.conversionKind,
      bouncedAt: iso(d.bouncedAt),
      failedAt: iso(d.failedAt),
      error: d.error,
      createdAt: d.createdAt.toISOString(),
    })),
    profile: profile
      ? {
          lifecycle: profile.lifecycle,
          lifecycleLabel: LIFECYCLE_LABELS[profile.lifecycle as Lifecycle] ?? profile.lifecycle,
          ordersCount: profile.ordersCount,
          totalSpentCents: profile.totalSpentCents,
          avgTicketCents: profile.ordersCount ? Math.round(profile.totalSpentCents / profile.ordersCount) : 0,
          firstOrderAt: iso(profile.firstOrderAt),
          lastOrderAt: iso(profile.lastOrderAt),
          avgIntervalDays: profile.avgIntervalDays,
          nextPurchaseAt: iso(profile.nextPurchaseAt),
          topProducts: Array.isArray(profile.topProducts) ? (profile.topProducts as Array<{ title: string; count?: number }>) : [],
        }
      : null,
    birthday,
  };
}
