import {
  addMinutes,
  format,
  parse,
  isBefore,
  isAfter,
  getDay,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export type Rule = { dayOfWeek: number; startTime: string; endTime: string };

export type AvailabilityException = {
  date: string;
  isBlocked: boolean;
  startTime?: string | null;
  endTime?: string | null;
};

export type SlotWindow = { start: string; end: string; label?: string };

export function normalizeTime(time: string) {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function normalizeRules(rules: Rule[]): Rule[] {
  return rules.map((rule) => ({
    dayOfWeek: Number(rule.dayOfWeek),
    startTime: normalizeTime(rule.startTime),
    endTime: normalizeTime(rule.endTime),
  }));
}

export function parseTimeOnDate(dateStr: string, time: string, tz: string) {
  const normalized = normalizeTime(time);
  const local = parse(`${dateStr} ${normalized}`, "yyyy-MM-dd HH:mm", new Date());
  return fromZonedTime(local, tz);
}

export function getDayWindows(
  rules: Rule[],
  exceptions: AvailabilityException[],
  date: string,
): SlotWindow[] {
  const dayLocal = parse(date, "yyyy-MM-dd", new Date());
  const dow = getDay(dayLocal);
  const dayExceptions = exceptions.filter((e) => e.date === date);

  const blockedFull = dayExceptions.find((e) => e.isBlocked && !e.startTime);
  if (blockedFull) return [];

  const openEx = dayExceptions.find(
    (e) => !e.isBlocked && e.startTime && e.endTime,
  );
  if (openEx?.startTime && openEx?.endTime) {
    return [
      {
        start: normalizeTime(openEx.startTime),
        end: normalizeTime(openEx.endTime),
      },
    ];
  }

  return normalizeRules(rules)
    .filter((r) => r.dayOfWeek === dow)
    .map((r) => ({ start: r.startTime, end: r.endTime }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function generateSlotsForWindows(params: {
  date: string;
  timezone: string;
  windows: SlotWindow[];
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  stepMinutes: number;
  partialBlocks: AvailabilityException[];
  skipPast?: boolean;
}) {
  const {
    date,
    timezone,
    windows,
    durationMinutes,
    bufferBefore,
    bufferAfter,
    stepMinutes,
    partialBlocks,
    skipPast = true,
  } = params;

  const now = new Date();
  const slots: {
    startAt: string;
    endAt: string;
    label: string;
    windowIndex: number;
  }[] = [];

  windows.forEach((win, windowIndex) => {
    let cursor = parseTimeOnDate(date, win.start, timezone);
    const windowEnd = parseTimeOnDate(date, win.end, timezone);

    if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(windowEnd.getTime())) {
      return;
    }

    while (isBefore(cursor, windowEnd)) {
      const slotStart = cursor;
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (isAfter(slotEnd, windowEnd)) break;

      const blocked = partialBlocks.some((b) => {
        if (!b.startTime || !b.endTime) return false;
        const bStart = parseTimeOnDate(date, b.startTime, timezone);
        const bEnd = parseTimeOnDate(date, b.endTime, timezone);
        return isBefore(slotStart, bEnd) && isAfter(slotEnd, bStart);
      });

      if (!blocked && (!skipPast || isAfter(slotStart, now))) {
        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
          label: format(toZonedTime(slotStart, timezone), "HH:mm"),
          windowIndex,
        });
      }
      cursor = addMinutes(cursor, stepMinutes);
    }
  });

  return slots;
}

export function computeTheoreticalSlots(params: {
  rules: Rule[];
  exceptions: AvailabilityException[];
  date: string;
  timezone: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  slotStepMinutes?: number;
  skipPast?: boolean;
}) {
  const rules = normalizeRules(params.rules);
  const windows = getDayWindows(rules, params.exceptions, params.date);
  const dayExceptions = params.exceptions.filter((e) => e.date === params.date);
  const partialBlocks = dayExceptions.filter(
    (e) => e.isBlocked && e.startTime && e.endTime,
  );

  const bufferBefore = params.bufferBefore || 0;
  const bufferAfter = params.bufferAfter || 0;
  const stepMinutes =
    params.slotStepMinutes && params.slotStepMinutes > 0
      ? params.slotStepMinutes
      : params.durationMinutes + bufferBefore + bufferAfter;

  const slots = generateSlotsForWindows({
    date: params.date,
    timezone: params.timezone,
    windows,
    durationMinutes: params.durationMinutes,
    bufferBefore,
    bufferAfter,
    stepMinutes,
    partialBlocks,
    skipPast: params.skipPast ?? false,
  });

  const byWindow = windows.map((win, i) => ({
    ...win,
    slots: slots.filter((s) => s.windowIndex === i).map((s) => s.label),
    count: slots.filter((s) => s.windowIndex === i).length,
  }));

  return { windows: byWindow, slots, total: slots.length };
}
