import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gate } from "@/lib/flows/api";
import { jobHealth } from "@/lib/flows/jobs";
import { resolveResend, warmupDailyCap } from "@/lib/integrations/resend/connection";
import { getWhatsAppMetadata } from "@/lib/flows/wa-limits";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { upcomingDates } from "@/lib/flows/calendar";
import { birthdayCoverage, birthdaysInMonth } from "@/lib/flows/important-dates";
import { LIFECYCLE_LABELS } from "@/lib/flows/profile";

const DAY = 86_400_000;

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const days = Math.min(365, Math.max(7, Number(request.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * DAY);
  const base = { clienteId: ws, isTest: false, createdAt: { gte: since } };

  const [byChannel, conv, daily, flows, flowRevenue, subjects, links, resend, waConn, waMeta, jobs, dates, bdays, lifecycles, campaigns] =
    await Promise.all([
      prisma.messageDelivery.groupBy({
        by: ["channel"],
        where: base,
        _count: { _all: true, sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, bouncedAt: true, complainedAt: true, failedAt: true },
        _sum: { costMicros: true },
      }),
      prisma.messageDelivery.groupBy({
        by: ["conversionKind"],
        where: { clienteId: ws, isTest: false, convertedAt: { gte: since } },
        _count: { _all: true },
        _sum: { convertedCents: true },
      }),
      prisma.$queryRaw<Array<{ day: Date; channel: string; sent: bigint; opened: bigint; clicked: bigint; converted: bigint; cents: bigint | null }>>`
        SELECT date_trunc('day', "createdAt") AS day, channel,
          COUNT(*) FILTER (WHERE "sentAt" IS NOT NULL) AS sent,
          COUNT(*) FILTER (WHERE "openedAt" IS NOT NULL) AS opened,
          COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL) AS clicked,
          COUNT(*) FILTER (WHERE "convertedAt" IS NOT NULL) AS converted,
          SUM("convertedCents") AS cents
        FROM "MessageDelivery"
        WHERE "clienteId" = ${ws} AND "isTest" = false AND "createdAt" >= ${since}
        GROUP BY 1, 2 ORDER BY 1`,
      prisma.messageFlow.findMany({ where: { clienteId: ws }, select: { id: true, name: true, status: true, key: true } }),
      prisma.messageDelivery.groupBy({
        by: ["flowId"],
        where: { ...base, flowId: { not: null } },
        _count: { _all: true, openedAt: true, clickedAt: true, convertedAt: true },
        _sum: { convertedCents: true },
      }),
      prisma.messageDelivery.groupBy({
        by: ["subject"],
        where: { ...base, channel: "EMAIL", subject: { not: null } },
        _count: { _all: true, openedAt: true, clickedAt: true },
        orderBy: { _count: { openedAt: "desc" } },
        take: 30,
      }),
      prisma.$queryRaw<Array<{ link: string; clicks: bigint }>>`
        SELECT meta->>'link' AS link, COUNT(*) AS clicks
        FROM "MessageEvent"
        WHERE "clienteId" = ${ws} AND type = 'clicked' AND at >= ${since} AND meta->>'link' IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      resolveResend(ws),
      resolveWhatsApp(ws),
      getWhatsAppMetadata(ws).catch(() => ({}) as Record<string, unknown>),
      jobHealth(),
      upcomingDates(ws, { days: 90 }),
      birthdayCoverage(ws),
      prisma.customerProfile.groupBy({ by: ["lifecycle"], where: { clienteId: ws }, _count: { _all: true } }),
      prisma.messageCampaign.findMany({
        where: { clienteId: ws, status: { notIn: ["ENVIADA", "PERDIDA"] } },
        select: { id: true, name: true, status: true, eventDate: true, scheduledAt: true, calendarKey: true },
        orderBy: { eventDate: "asc" },
        take: 20,
      }),
    ]);

  const month = new Date().getMonth() + 1;
  const birthdaysThisMonth = await birthdaysInMonth(ws, month).catch(() => []);
  const email = byChannel.find((c) => c.channel === "EMAIL");
  const wa = byChannel.find((c) => c.channel === "WHATSAPP");
  const kpi = (c: typeof email) => ({
    sent: c?._count.sentAt ?? 0,
    delivered: c?._count.deliveredAt ?? 0,
    opened: c?._count.openedAt ?? 0,
    clicked: c?._count.clickedAt ?? 0,
    bounced: c?._count.bouncedAt ?? 0,
    complained: c?._count.complainedAt ?? 0,
    failed: c?._count.failedAt ?? 0,
    costMicros: c?._sum.costMicros ?? 0,
  });
  const attributed = conv.find((c) => c.conversionKind === "ATTRIBUTED");
  const influenced = conv.find((c) => c.conversionKind === "INFLUENCED");
  const flowNames = new Map(flows.map((f) => [f.id, f]));

  // Receita da loja no período, para comparar com a receita atribuída
  const orders = await prisma.marketplaceOrder.aggregate({
    where: { clienteId: ws, OR: [{ occurredAt: { gte: since } }, { occurredAt: null, createdAt: { gte: since } }] },
    _sum: { totalCents: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    days,
    email: kpi(email),
    whatsapp: kpi(wa),
    attributed: { orders: attributed?._count._all ?? 0, cents: attributed?._sum.convertedCents ?? 0 },
    influenced: { orders: influenced?._count._all ?? 0, cents: influenced?._sum.convertedCents ?? 0 },
    storeRevenue: { orders: orders._count._all, cents: orders._sum.totalCents ?? 0 },
    daily: daily.map((d) => ({
      day: d.day.toISOString().slice(0, 10),
      channel: d.channel,
      sent: Number(d.sent),
      opened: Number(d.opened),
      clicked: Number(d.clicked),
      converted: Number(d.converted),
      cents: Number(d.cents ?? 0),
    })),
    ranking: flowRevenue
      .map((f) => ({
        flowId: f.flowId,
        name: flowNames.get(f.flowId ?? "")?.name ?? "Fluxo",
        status: flowNames.get(f.flowId ?? "")?.status ?? null,
        sent: f._count._all,
        opened: f._count.openedAt,
        clicked: f._count.clickedAt,
        converted: f._count.convertedAt,
        cents: f._sum.convertedCents ?? 0,
      }))
      .sort((a, b) => b.cents - a.cents || b.clicked - a.clicked),
    subjects: subjects
      .filter((s) => s._count._all >= 20)
      .map((s) => ({
        subject: s.subject,
        sent: s._count._all,
        openRate: s._count._all ? s._count.openedAt / s._count._all : 0,
        clickRate: s._count._all ? s._count.clickedAt / s._count._all : 0,
      }))
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 8),
    links: links.map((l) => ({ link: l.link, clicks: Number(l.clicks) })),
    health: {
      resend: resend
        ? {
            connected: true,
            domain: resend.domain,
            domainStatus: resend.domainStatus,
            webhook: Boolean(resend.webhookSecret),
            lastWebhookAt: resend.lastWebhookAt,
            warmupDailyCap: warmupDailyCap(resend.domainVerifiedAt),
          }
        : { connected: false },
      whatsapp: waConn
        ? {
            connected: true,
            quality: (waMeta as Record<string, unknown>).phoneQuality ?? null,
            messagingLimit: (waMeta as Record<string, unknown>).messagingLimit ?? null,
            marketingMessagesStatus: (waMeta as Record<string, unknown>).marketingMessagesStatus ?? null,
          }
        : { connected: false },
      jobs,
    },
    upcoming: dates.slice(0, 8).map((d) => ({
      key: d.key,
      label: d.label,
      date: d.date.toISOString(),
      leadDays: d.leadDays,
      hint: d.hint ?? null,
      campaign: campaigns.find((c) => c.calendarKey === d.key) ?? null,
    })),
    campaigns,
    birthdays: { ...bdays, thisMonth: birthdaysThisMonth.length },
    lifecycles: lifecycles.map((l) => ({
      lifecycle: l.lifecycle,
      label: LIFECYCLE_LABELS[l.lifecycle as keyof typeof LIFECYCLE_LABELS] ?? l.lifecycle,
      count: l._count._all,
    })),
  });
}
