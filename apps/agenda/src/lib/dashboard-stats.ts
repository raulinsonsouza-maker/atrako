import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { buildPaymentWhere } from "@/lib/payments/org-filter";
import { ASAAS_ENABLED, CAKTO_ENABLED } from "@/lib/feature-flags";
import {
  isAsaasReady,
  isCaktoReady,
  isMercadoPagoReady,
  resolvePaymentProvider,
} from "@/lib/payments/resolve-provider";

function dayBounds(date: Date, timezone: string) {
  const zoned = toZonedTime(date, timezone);
  return {
    start: fromZonedTime(startOfDay(zoned), timezone),
    end: fromZonedTime(endOfDay(zoned), timezone),
  };
}

function monthBounds(date: Date, timezone: string) {
  const zoned = toZonedTime(date, timezone);
  const start = fromZonedTime(startOfMonth(zoned), timezone);
  const end = fromZonedTime(endOfDay(endOfMonth(zoned)), timezone);
  return { start, end };
}

const ACTIVE_STATUSES = ["CONFIRMED", "PENDING_PAYMENT"] as const;

export type DashboardScope = {
  professionalId?: string | null;
};

export async function getDashboardStats(
  organizationId: string,
  timezone: string,
  scope?: DashboardScope,
) {
  const now = new Date();
  const today = dayBounds(now, timezone);
  const tomorrow = dayBounds(addDays(now, 1), timezone);
  const thisMonth = monthBounds(now, timezone);

  const professionalId = scope?.professionalId ?? null;
  const orgFilter = {
    bookingPage: { organizationId },
    ...(professionalId ? { professionalId } : {}),
  };

  const [
    org,
    todayCount,
    tomorrowCount,
    activePages,
    totalServices,
    monthBookings,
    monthConfirmed,
    monthRevenue,
    googleConnected,
    allBookings,
    upcoming,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.booking.count({
      where: {
        ...orgFilter,
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { gte: today.start, lte: today.end },
      },
    }),
    prisma.booking.count({
      where: {
        ...orgFilter,
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { gte: tomorrow.start, lte: tomorrow.end },
      },
    }),
    professionalId
      ? prisma.bookingPage.count({
          where: {
            organizationId,
            isActive: true,
            services: {
              some: {
                isActive: true,
                professionals: { some: { professionalId } },
              },
            },
          },
        })
      : prisma.bookingPage.count({
          where: { organizationId, isActive: true },
        }),
    professionalId
      ? prisma.service.count({
          where: {
            isActive: true,
            professionals: { some: { professionalId } },
            bookingPage: { organizationId },
          },
        })
      : prisma.service.count({
          where: { bookingPage: { organizationId }, isActive: true },
        }),
    prisma.booking.count({
      where: {
        ...orgFilter,
        createdAt: { gte: thisMonth.start, lte: thisMonth.end },
      },
    }),
    prisma.booking.count({
      where: {
        ...orgFilter,
        status: "CONFIRMED",
        confirmedAt: { gte: thisMonth.start, lte: thisMonth.end },
      },
    }),
    prisma.payment.aggregate({
      where: {
        AND: [
          buildPaymentWhere(organizationId, { professionalId }),
          {
            status: "PAID",
            paidAt: { gte: thisMonth.start, lte: thisMonth.end },
          },
        ],
      },
      _sum: { amountCents: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { googleAccessToken: true },
    }).then((o) => Boolean(o?.googleAccessToken)),
    prisma.booking.findMany({
      where: orgFilter,
      select: { startAt: true, status: true, createdAt: true },
    }),
    prisma.booking.findMany({
      where: {
        ...orgFilter,
        status: "CONFIRMED",
        startAt: { gte: now },
      },
      include: { service: true, bookingPage: true },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
  ]);

  const paymentReady = org ? resolvePaymentProvider(org) !== "DEMO" : false;
  const integrationsConnected =
    (googleConnected ? 1 : 0) +
    (org && isMercadoPagoReady(org) ? 1 : 0) +
    (ASAAS_ENABLED && org && isAsaasReady(org) ? 1 : 0) +
    (CAKTO_ENABLED && org && isCaktoReady(org) ? 1 : 0);

  const chartMonths = Array.from({ length: 12 }, (_, i) => {
    const ref = subMonths(now, 11 - i);
    const zoned = toZonedTime(ref, timezone);
    const label = format(zoned, "MMM/yy", { locale: ptBR });
    const monthStart = fromZonedTime(startOfMonth(zoned), timezone);
    const monthEnd = fromZonedTime(
      endOfDay(
        new Date(zoned.getFullYear(), zoned.getMonth() + 1, 0, 23, 59, 59, 999),
      ),
      timezone,
    );

    const scheduled = allBookings.filter(
      (b) => b.startAt >= monthStart && b.startAt <= monthEnd,
    ).length;
    const confirmed = allBookings.filter(
      (b) =>
        b.status === "CONFIRMED" &&
        b.startAt >= monthStart &&
        b.startAt <= monthEnd,
    ).length;

    return { label, scheduled, confirmed };
  });

  const maxChart = Math.max(1, ...chartMonths.flatMap((m) => [m.scheduled, m.confirmed]));

  return {
    todayCount,
    tomorrowCount,
    activePages,
    totalServices,
    monthBookings,
    monthConfirmed,
    monthRevenueCents: monthRevenue._sum.amountCents || 0,
    paymentReady,
    paymentProvider: org ? resolvePaymentProvider(org) : "DEMO",
    googleConnected,
    integrationsConnected,
    chartMonths,
    maxChart,
    upcoming,
  };
}

export function utilizationPercent(value: number, scale: number) {
  if (scale <= 0) return 0;
  return Math.min(100, Math.round((value / scale) * 100));
}
