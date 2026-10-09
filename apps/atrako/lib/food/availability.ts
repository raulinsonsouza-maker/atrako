/** Horário da loja e do item. O navegador não decide se o item pode ser pedido. */

export type ClockInterval = { start: string; end: string };
export type WeekHours = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", ClockInterval[]>>;

export type ItemSchedule =
  | { mode: "ALWAYS" }
  | { mode: "HOURS"; days: WeekHours }
  | null;

const DAY_KEY = ["0", "1", "2", "3", "4", "5", "6"] as const;

function minutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function saoPauloNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { day: DAY_KEY[day < 0 ? 0 : day], minutes: hour * 60 + minute };
}

export function isOpenAt(hours: WeekHours | null | undefined, date = new Date()) {
  if (!hours || !Object.keys(hours).length) return true;
  const now = saoPauloNow(date);
  const slots = hours[now.day] ?? [];
  if (!slots.length) return false;
  return slots.some((slot) => {
    const start = minutes(slot.start);
    const end = minutes(slot.end);
    if (start == null || end == null || end <= start) return false;
    return now.minutes >= start && now.minutes < end;
  });
}

export function isItemOrderable(input: {
  available: boolean;
  categoryActive: boolean;
  storeHours: WeekHours | null;
  schedule: ItemSchedule;
  now?: Date;
}) {
  if (!input.available || !input.categoryActive) return false;
  const now = input.now ?? new Date();
  if (!isOpenAt(input.storeHours, now)) return false;
  if (!input.schedule || input.schedule.mode === "ALWAYS") return true;
  return isOpenAt(input.schedule.days, now);
}

export function asWeekHours(value: unknown): WeekHours | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hours: WeekHours = {};
  for (const key of DAY_KEY) {
    const raw = (value as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) continue;
    const slots = raw
      .map((slot) => {
        if (!slot || typeof slot !== "object") return null;
        const start = String((slot as { start?: unknown }).start ?? "");
        const end = String((slot as { end?: unknown }).end ?? "");
        if (minutes(start) == null || minutes(end) == null) return null;
        return { start, end };
      })
      .filter((slot): slot is ClockInterval => Boolean(slot))
      .slice(0, 4);
    if (slots.length) hours[key] = slots;
  }
  return Object.keys(hours).length ? hours : null;
}

export function asItemSchedule(value: unknown): ItemSchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const mode = (value as { mode?: unknown }).mode;
  if (mode === "HOURS") {
    return { mode: "HOURS", days: asWeekHours((value as { days?: unknown }).days) ?? {} };
  }
  if (mode === "ALWAYS") return { mode: "ALWAYS" };
  return null;
}
