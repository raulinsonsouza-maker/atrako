/** Fuso do workspace: janela de envio, datas locais e aniversários (29/02 → 28/02 em ano não bissexto). */

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

export function localParts(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

/** Converte data/hora local do fuso em instante UTC. */
export function zonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const p = localParts(guess, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offset = asUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Instante permitido mais próximo dentro da janela [startHour, endHour) no fuso. */
export function nextAllowedTime(now: Date, timeZone: string, startHour: number, endHour: number): Date {
  const p = localParts(now, timeZone);
  if (p.hour >= startHour && p.hour < endHour) return now;
  if (p.hour < startHour) return zonedDate(p.year, p.month, p.day, startHour, 0, timeZone);
  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return zonedDate(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    startHour,
    0,
    timeZone,
  );
}

/** Início do próximo dia local na hora de início da janela. */
export function nextDayStart(now: Date, timeZone: string, startHour: number): Date {
  const p = localParts(now, timeZone);
  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return zonedDate(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), startHour, 0, timeZone);
}

/** A data (mês/dia) cai hoje − offset? Ex.: offset -7 → aniversário daqui a 7 dias. */
export function matchesAnnualDate(
  month: number,
  day: number,
  today: { year: number; month: number; day: number },
  offsetDays: number,
): boolean {
  const target = new Date(Date.UTC(today.year, today.month - 1, today.day - offsetDays));
  const y = target.getUTCFullYear();
  const d = month === 2 && day === 29 && !isLeapYear(y) ? 28 : day;
  return target.getUTCMonth() + 1 === month && target.getUTCDate() === d;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}
