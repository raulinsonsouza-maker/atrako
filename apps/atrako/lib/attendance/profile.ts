/**
 * Ficha de atendimento do workspace. A mesma ficha entra no agente do Atrako
 * e no atendimento pelo WhatsApp oficial.
 */

export const ATTENDANCE_MODES = ["off", "qualify", "sell"] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export const OFFER_KINDS = ["none", "checkout", "agenda", "fixed"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export const HOUR_PRESETS = ["weekdays", "all", "weekend"] as const;
export type HourPreset = (typeof HOUR_PRESETS)[number];

const PRESET_DAYS: Record<HourPreset, number[]> = {
  weekdays: [1, 2, 3, 4, 5],
  all: [1, 2, 3, 4, 5, 6, 7],
  weekend: [6, 7],
};

export type AttendanceProfile = {
  about: string;
  sells: string;
  conditions: string;
  tone: string;
  handoffWhen: string;
  mode: AttendanceMode;
  waEnabled: boolean;
  hourPreset: HourPreset | "";
  hourStart: string;
  hourEnd: string;
  offerKind: OfferKind;
  checkoutProductId: string;
  agendaLinkSlug: string;
  fixedAmount: number | null;
  offerLabel: string;
};

export const EMPTY_ATTENDANCE: AttendanceProfile = {
  about: "",
  sells: "",
  conditions: "",
  tone: "",
  handoffWhen: "",
  mode: "off",
  waEnabled: false,
  hourPreset: "",
  hourStart: "",
  hourEnd: "",
  offerKind: "none",
  checkoutProductId: "",
  agendaLinkSlug: "",
  fixedAmount: null,
  offerLabel: "",
};

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function clock(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : "";
}

export function parseAttendance(raw: unknown): AttendanceProfile {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const mode = ATTENDANCE_MODES.includes(row.mode as AttendanceMode) ? (row.mode as AttendanceMode) : "off";
  const offerKind = OFFER_KINDS.includes(row.offerKind as OfferKind) ? (row.offerKind as OfferKind) : "none";
  const hourPreset = HOUR_PRESETS.includes(row.hourPreset as HourPreset) ? (row.hourPreset as HourPreset) : "";
  const amount = typeof row.fixedAmount === "number" ? row.fixedAmount : Number(row.fixedAmount);
  const fixedAmount = Number.isFinite(amount) && amount >= 1 && amount <= 100_000 ? Math.round(amount * 100) / 100 : null;
  return {
    about: clip(row.about, 2000),
    sells: clip(row.sells, 2000),
    conditions: clip(row.conditions, 2000),
    tone: clip(row.tone, 400),
    handoffWhen: clip(row.handoffWhen, 800),
    mode,
    waEnabled: mode !== "off" && row.waEnabled === true,
    hourPreset,
    hourStart: clock(row.hourStart),
    hourEnd: clock(row.hourEnd),
    offerKind: mode === "sell" ? offerKind : "none",
    checkoutProductId: clip(row.checkoutProductId, 80),
    agendaLinkSlug: clip(row.agendaLinkSlug, 120),
    fixedAmount: mode === "sell" && offerKind === "fixed" ? fixedAmount : null,
    offerLabel: clip(row.offerLabel, 160),
  };
}

export function attendanceFromPrefs(prefs: unknown): AttendanceProfile {
  const row = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>).attendance : null;
  return parseAttendance(row);
}

/** Atendimento automático no WhatsApp está ligado. */
export function attendanceIsOn(profile: AttendanceProfile) {
  return profile.waEnabled && profile.mode !== "off";
}

export function attendanceDays(profile: AttendanceProfile): number[] {
  return profile.hourPreset ? PRESET_DAYS[profile.hourPreset] : [];
}

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Sem horário configurado, o dia inteiro vale. */
export function isWithinAttendanceHours(profile: AttendanceProfile, timezone: string, now = new Date()) {
  if (!profile.hourStart || !profile.hourEnd || profile.hourEnd <= profile.hourStart) return true;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = WEEKDAY[parts.find((p) => p.type === "weekday")?.value ?? ""] ?? 0;
  const days = attendanceDays(profile);
  if (days.length && !days.includes(weekday)) return false;
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const clockNow = `${hh}:${mm}`;
  return clockNow >= profile.hourStart && clockNow < profile.hourEnd;
}

export function hoursLabel(profile: AttendanceProfile) {
  const preset =
    profile.hourPreset === "weekdays"
      ? "segunda a sexta"
      : profile.hourPreset === "weekend"
        ? "sábado e domingo"
        : profile.hourPreset === "all"
          ? "todos os dias"
          : "";
  if (!profile.hourStart || !profile.hourEnd) return preset;
  return [preset, `${profile.hourStart} às ${profile.hourEnd}`].filter(Boolean).join(", ");
}

/** Texto da ficha para o system prompt. Vazio quando o dealer ainda não preencheu. */
export function describeAttendance(profile: AttendanceProfile): string {
  const lines = [
    profile.about ? `O que a empresa faz: ${profile.about}` : "",
    profile.sells ? `O que vende: ${profile.sells}` : "",
    profile.conditions ? `Condições e preço: ${profile.conditions}` : "",
    profile.tone ? `Tom de voz: ${profile.tone}` : "",
    profile.handoffWhen ? `Quando passar para uma pessoa: ${profile.handoffWhen}` : "",
    hoursLabel(profile) ? `Horário de atendimento: ${hoursLabel(profile)}` : "",
    profile.mode === "qualify"
      ? "Modo: primeiro atendimento. Qualifique e entregue para o time. Não cobre e não envie link de pagamento."
      : profile.mode === "sell"
        ? "Modo: pode fechar a venda, enviando a oferta configurada. Ganho só acontece quando o pagamento confirma."
        : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function attendanceCanQuote(profile: AttendanceProfile) {
  if (profile.mode !== "sell") return false;
  if (profile.offerKind === "fixed" && profile.fixedAmount) return true;
  if (profile.offerKind === "checkout" && profile.checkoutProductId) return true;
  if (profile.offerKind === "agenda" && profile.agendaLinkSlug) return true;
  return /\d/.test(profile.conditions);
}
