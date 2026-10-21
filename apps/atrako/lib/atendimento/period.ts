/** Período dos painéis da área do cliente, sempre em datas de Brasília (YYYY-MM-DD, fim inclusivo). */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const BRT = "-03:00";

export type Period = { from: string; to: string; gte: Date; lte: Date; days: number };

export function ymdBrt(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDaysYmd(ymd: string, delta: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function periodFromYmd(from: string, to: string): Period {
  const gte = new Date(`${from}T00:00:00.000${BRT}`);
  const lte = new Date(`${to}T23:59:59.999${BRT}`);
  const days = Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / DAY) + 1;
  return { from, to, gte, lte, days };
}

/** `dataInicio`/`dataFim` do DateRangeFilter, ou `periodo` (últimos N dias até hoje). */
export function parsePeriod(sp: URLSearchParams, defaultDays = 30, now = new Date()): Period {
  const ini = sp.get("dataInicio") ?? "";
  const fim = sp.get("dataFim") ?? "";
  if (YMD.test(ini) && YMD.test(fim) && ini <= fim) return periodFromYmd(ini, fim);
  const days = Math.min(730, Math.max(1, parseInt(sp.get("periodo") ?? "", 10) || defaultDays));
  const to = ymdBrt(now);
  return periodFromYmd(addDaysYmd(to, -(days - 1)), to);
}

/** Mesmo número de dias, imediatamente antes. */
export function previousPeriod(p: Period): Period {
  const to = addDaysYmd(p.from, -1);
  return periodFromYmd(addDaysYmd(to, -(p.days - 1)), to);
}

export function eachDay(p: Pick<Period, "from" | "to">): string[] {
  const out: string[] = [];
  for (let d = p.from; d <= p.to && out.length < 800; d = addDaysYmd(d, 1)) out.push(d);
  return out;
}

/** Limites para colunas `@db.Date` (meia-noite UTC do dia). */
export function dateColumnRange(p: Pick<Period, "from" | "to">) {
  return { gte: new Date(`${p.from}T00:00:00.000Z`), lte: new Date(`${p.to}T00:00:00.000Z`) };
}
