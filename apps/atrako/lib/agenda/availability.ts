import {
  addDays,
  addMinutes,
  format,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import {
  computeTheoreticalSlots,
  getDayWindows,
  normalizeRules,
  parseTimeOnDate,
  type Rule,
} from "@/lib/agenda/availability-core";

export type { Rule } from "@/lib/agenda/availability-core";

export function filterSlotsByBusy<T extends { startAt: string; endAt: string }>(
  slots: T[],
  busy: { start: Date; end: Date }[],
): T[] {
  return slots.filter((slot) => {
    const s = new Date(slot.startAt);
    const e = new Date(slot.endAt);
    return !intervalsOverlap(s, e, busy);
  });
}

export function intervalsOverlap(
  start: Date,
  end: Date,
  busy: { start: Date; end: Date }[],
) {
  return busy.some((b) => isBefore(start, b.end) && isAfter(end, b.start));
}

export class SlotUnavailableError extends Error {
  constructor(message = "Horário indisponível. Escolha outro.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export async function getBusyIntervals(params: {
  bookingPageId: string;
  date: string;
  timezone: string;
  bufferBefore: number;
  bufferAfter: number;
  professionalId?: string | null;
  excludeBookingId?: string;
}) {
  const dayStart = parseTimeOnDate(params.date, "00:00", params.timezone);
  const dayEnd = parseTimeOnDate(params.date, "23:59", params.timezone);
  const now = new Date();

  const bookingWhere = {
    bookingPageId: params.bookingPageId,
    startAt: { gte: dayStart, lte: dayEnd },
    ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    ...(params.professionalId ? { professionalId: params.professionalId } : {}),
    OR: [
      { status: "CONFIRMED" as const },
      { status: "PENDING_PAYMENT" as const, holdExpiresAt: { gt: now } },
    ],
  };

  const bookings = await prisma.agendaBooking.findMany({ where: bookingWhere });

  const holds = await prisma.agendaSlotHold.findMany({
    where: {
      bookingPageId: params.bookingPageId,
      startAt: { gte: dayStart, lte: dayEnd },
      expiresAt: { gt: now },
      ...(params.professionalId ? { professionalId: params.professionalId } : {}),
      ...(params.excludeBookingId
        ? {
            OR: [{ bookingId: null }, { bookingId: { not: params.excludeBookingId } }],
          }
        : { bookingId: null }),
    },
  });

  const intervals = [
    ...bookings.map((b) => ({
      start: addMinutes(b.startAt, -params.bufferBefore),
      end: addMinutes(b.endAt, params.bufferAfter),
    })),
    ...holds.map((h) => ({
      start: addMinutes(h.startAt, -params.bufferBefore),
      end: addMinutes(h.endAt, params.bufferAfter),
    })),
  ];

  return intervals;
}

async function loadRulesAndExceptions(params: {
  bookingPageId: string;
  professionalId?: string | null;
  date?: string;
}) {
  if (params.professionalId) {
    const rules = await prisma.agendaAvailabilityRule.findMany({
      where: { professionalId: params.professionalId },
    });
    const exceptions = await prisma.agendaAvailabilityException.findMany({
      where: {
        professionalId: params.professionalId,
        ...(params.date ? { date: params.date } : {}),
      },
    });
    return { rules, exceptions };
  }

  const rules = await prisma.agendaAvailabilityRule.findMany({
    where: { bookingPageId: params.bookingPageId, professionalId: null },
  });
  const exceptions = await prisma.agendaAvailabilityException.findMany({
    where: {
      bookingPageId: params.bookingPageId,
      professionalId: null,
      ...(params.date ? { date: params.date } : {}),
    },
  });
  return { rules, exceptions };
}

export async function getTheoreticalSlots(params: {
  bookingPageId: string;
  date: string;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  slotStepMinutes?: number;
  professionalId?: string | null;
}) {
  const { rules, exceptions } = await loadRulesAndExceptions({
    bookingPageId: params.bookingPageId,
    professionalId: params.professionalId,
    date: params.date,
  });

  return computeTheoreticalSlots({
    rules,
    exceptions,
    date: params.date,
    timezone: params.timezone,
    durationMinutes: params.durationMinutes,
    bufferBefore: params.bufferBefore,
    bufferAfter: params.bufferAfter,
    slotStepMinutes: params.slotStepMinutes,
    skipPast: false,
  });
}

export async function getAvailableDays(params: {
  bookingPageId: string;
  from: Date;
  days?: number;
  timezone: string;
  professionalId?: string | null;
}) {
  const { bookingPageId, from, timezone, days = 60, professionalId } = params;
  const { rules, exceptions } = await loadRulesAndExceptions({
    bookingPageId,
    professionalId,
  });

  const available: string[] = [];
  const start = startOfDay(toZonedTime(from, timezone));

  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const dateStr = format(day, "yyyy-MM-dd");
    const windows = getDayWindows(rules, exceptions, dateStr);
    if (windows.length > 0) available.push(dateStr);
  }
  return available;
}

export async function getAvailableSlots(params: {
  bookingPageId: string;
  serviceId: string;
  date: string;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  slotStepMinutes?: number;
  professionalId?: string | null;
}) {
  const {
    bookingPageId,
    date,
    timezone,
    durationMinutes,
    bufferBefore = 0,
    bufferAfter = 0,
    slotStepMinutes = 0,
    professionalId,
  } = params;

  const page = await prisma.agendaBookingPage.findUnique({
    where: { id: bookingPageId },
  });
  const step =
    slotStepMinutes > 0
      ? slotStepMinutes
      : page?.slotStepMinutes && page.slotStepMinutes > 0
        ? page.slotStepMinutes
        : durationMinutes + bufferBefore + bufferAfter;

  const { slots } = await getTheoreticalSlots({
    bookingPageId,
    date,
    timezone,
    durationMinutes,
    bufferBefore,
    bufferAfter,
    slotStepMinutes: step,
    professionalId,
  });

  const busy = await getBusyIntervals({
    bookingPageId,
    date,
    timezone,
    bufferBefore,
    bufferAfter,
    professionalId,
  });

  const available = filterSlotsByBusy(
    slots.filter((s) => isAfter(new Date(s.startAt), new Date())),
    busy,
  );

  return available.map(({ startAt, endAt, label }) => ({ startAt, endAt, label }));
}

export async function getAvailableDaysAnyone(params: {
  bookingPageId: string;
  from: Date;
  days?: number;
  timezone: string;
  professionalIds: string[];
}) {
  const set = new Set<string>();
  for (const professionalId of params.professionalIds) {
    const days = await getAvailableDays({
      bookingPageId: params.bookingPageId,
      from: params.from,
      days: params.days,
      timezone: params.timezone,
      professionalId,
    });
    for (const d of days) set.add(d);
  }
  return [...set].sort();
}

export async function getAvailableSlotsAnyone(params: {
  bookingPageId: string;
  serviceId: string;
  date: string;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  professionalIds: string[];
}) {
  const byStart = new Map<string, { startAt: string; endAt: string; label: string }>();

  for (const professionalId of params.professionalIds) {
    const slots = await getAvailableSlots({ ...params, professionalId });
    for (const s of slots) {
      if (!byStart.has(s.startAt)) byStart.set(s.startAt, s);
    }
  }

  return [...byStart.values()].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

export async function pickProfessionalForSlot(params: {
  bookingPageId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  professionalIds: string[];
}) {
  const pros = await prisma.agendaProfessional.findMany({
    where: {
      id: { in: params.professionalIds },
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  for (const pro of pros) {
    const ok = await isSlotAvailable({
      bookingPageId: params.bookingPageId,
      serviceId: params.serviceId,
      startAt: params.startAt,
      endAt: params.endAt,
      timezone: params.timezone,
      durationMinutes: params.durationMinutes,
      bufferBefore: params.bufferBefore,
      bufferAfter: params.bufferAfter,
      professionalId: pro.id,
    });
    if (ok) return pro.id;
  }
  return null;
}

export async function assertSlotAvailable(params: {
  bookingPageId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  excludeBookingId?: string;
  professionalId?: string | null;
}) {
  const bufferBefore = params.bufferBefore || 0;
  const bufferAfter = params.bufferAfter || 0;
  const date = format(toZonedTime(params.startAt, params.timezone), "yyyy-MM-dd");

  const page = await prisma.agendaBookingPage.findUnique({
    where: { id: params.bookingPageId },
  });
  const slotStepMinutes =
    page?.slotStepMinutes && page.slotStepMinutes > 0
      ? page.slotStepMinutes
      : params.durationMinutes + bufferBefore + bufferAfter;

  const { slots } = await getTheoreticalSlots({
    bookingPageId: params.bookingPageId,
    date,
    timezone: params.timezone,
    durationMinutes: params.durationMinutes,
    bufferBefore,
    bufferAfter,
    slotStepMinutes,
    professionalId: params.professionalId,
  });

  const matchesTheoretical = slots.some(
    (slot) =>
      Math.abs(new Date(slot.startAt).getTime() - params.startAt.getTime()) < 60_000 &&
      Math.abs(new Date(slot.endAt).getTime() - params.endAt.getTime()) < 60_000,
  );

  if (!matchesTheoretical) {
    throw new SlotUnavailableError(
      "Este horário não está mais disponível. Escolha outro.",
    );
  }

  const busy = await getBusyIntervals({
    bookingPageId: params.bookingPageId,
    date,
    timezone: params.timezone,
    bufferBefore,
    bufferAfter,
    excludeBookingId: params.excludeBookingId,
    professionalId: params.professionalId,
  });

  if (intervalsOverlap(params.startAt, params.endAt, busy)) {
    throw new SlotUnavailableError(
      "Este horário acabou de ser reservado. Escolha outro.",
    );
  }

  const overlap = await prisma.agendaBooking.findFirst({
    where: {
      bookingPageId: params.bookingPageId,
      ...(params.professionalId ? { professionalId: params.professionalId } : {}),
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      OR: [
        { status: "CONFIRMED" },
        { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } },
      ],
    },
  });

  if (overlap) {
    throw new SlotUnavailableError(
      "Este horário acabou de ser reservado. Escolha outro.",
    );
  }
}

export async function isSlotAvailable(params: {
  bookingPageId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  excludeBookingId?: string;
  professionalId?: string | null;
}) {
  try {
    await assertSlotAvailable(params);
    return true;
  } catch (e) {
    if (e instanceof SlotUnavailableError) return false;
    throw e;
  }
}

export function defaultWeekRules(): Rule[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "08:00",
    endTime: "18:00",
  }));
}

export { computeTheoreticalSlots, normalizeRules };
