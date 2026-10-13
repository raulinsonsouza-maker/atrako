/**
 * Noites de temporada. checkOut é exclusivo: a noite de saída fica livre para o próximo hóspede.
 * Datas em YYYY-MM-DD, comparáveis como texto.
 */

const DAY = 86_400_000;

export type OccupyingStay = {
  checkIn: string;
  checkOut: string;
  status: string;
  holdExpiresAt?: string | Date | null;
};

export type StayBlockRange = {
  startDate: string;
  endDate: string;
};

export function parseDay(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function formatDay(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const dt = parseDay(iso);
  if (!dt) return iso;
  dt.setUTCDate(dt.getUTCDate() + n);
  return formatDay(dt);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function eachNight(checkIn: string, checkOut: string): string[] {
  const n = nightsBetween(checkIn, checkOut);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(checkIn, i));
  return out;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return formatDay(now);
  }
}

export function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Segunda-feira na primeira coluna. Células nulas preenchem o começo do mês. */
export function monthCells(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= days; d++) cells.push(formatDay(new Date(Date.UTC(year, month - 1, d))));
  return cells;
}

export function stayOccupies(stay: OccupyingStay, nowMs: number): boolean {
  if (stay.status === "CONFIRMED") return true;
  if (stay.status !== "PENDING_PAYMENT") return false;
  if (!stay.holdExpiresAt) return false;
  return new Date(stay.holdExpiresAt).getTime() > nowMs;
}

export function occupiedNights(input: {
  reservations: OccupyingStay[];
  blocks: StayBlockRange[];
  now?: Date;
}): Set<string> {
  const nowMs = (input.now ?? new Date()).getTime();
  const set = new Set<string>();
  for (const stay of input.reservations) {
    if (!stayOccupies(stay, nowMs)) continue;
    for (const night of eachNight(stay.checkIn, stay.checkOut)) set.add(night);
  }
  for (const block of input.blocks) {
    for (const night of eachNight(block.startDate, block.endDate)) set.add(night);
  }
  return set;
}

export type StayQuoteInput = {
  checkIn: string;
  checkOut: string;
  nightlyCents: number;
  cleaningFeeCents: number;
  minNights: number;
  maxNights: number;
  occupied: ReadonlySet<string>;
  today: string;
};

export function quoteStay(
  input: StayQuoteInput,
):
  | { ok: true; nights: number; nightlyCents: number; cleaningFeeCents: number; amountCents: number }
  | { ok: false; error: string } {
  if (!parseDay(input.checkIn) || !parseDay(input.checkOut)) {
    return { ok: false, error: "Datas inválidas." };
  }
  if (input.checkIn < input.today) {
    return { ok: false, error: "O check-in precisa ser hoje ou depois." };
  }
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights < 1) return { ok: false, error: "O check-out precisa ser depois do check-in." };
  if (nights < input.minNights) {
    return { ok: false, error: `A estadia mínima é de ${input.minNights} noites.` };
  }
  if (nights > input.maxNights) {
    return { ok: false, error: `A estadia máxima é de ${input.maxNights} noites.` };
  }
  for (const night of eachNight(input.checkIn, input.checkOut)) {
    if (input.occupied.has(night)) return { ok: false, error: "Essas noites já estão ocupadas." };
  }
  return {
    ok: true,
    nights,
    nightlyCents: input.nightlyCents,
    cleaningFeeCents: input.cleaningFeeCents,
    amountCents: nights * input.nightlyCents + input.cleaningFeeCents,
  };
}

export function paymentKind(raw: string): "paid" | "refunded" | "rejected" | "pending" {
  const s = raw.toLowerCase();
  if (s.includes("refund")) return "refunded";
  if (["processed", "approved", "paid"].some((x) => s.includes(x))) return "paid";
  if (["cancelled", "canceled", "rejected", "chargeback"].some((x) => s.includes(x))) return "rejected";
  return "pending";
}

/** Pagamento aprovado fecha o lead como ganho, com o valor da reserva em reais. */
export function stayPaidLead(amountCents: number) {
  return { status: "WON" as const, dealValue: amountCents / 100 };
}
