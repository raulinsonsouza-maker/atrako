/** Ciclos mensais de comissão (ex.: dia 24 → dia 23 do mês seguinte). Datas como "YYYY-MM-DD" em BRT. */

export const CARENCIA_DIAS = 7;

export type CicloStatus = "EM_ANDAMENTO" | "EM_APURACAO" | "FECHADO";

export type CicloPeriodo = { dataInicio: string; dataFim: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: unknown): value is string {
  return typeof value === "string" && DAY_RE.test(value);
}

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Dia de corte no mês (year, month0); meses curtos usam o último dia. */
function anchor(year: number, month0: number, diaCorte: number): string {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return fromUtc(new Date(Date.UTC(year, month0, Math.min(diaCorte, lastDay))));
}

/** Próximo início de ciclo estritamente depois de `day`. */
function nextStart(day: string, diaCorte: number): string {
  const d = toUtc(day);
  const sameMonth = anchor(d.getUTCFullYear(), d.getUTCMonth(), diaCorte);
  if (sameMonth > day) return sameMonth;
  return anchor(d.getUTCFullYear(), d.getUTCMonth() + 1, diaCorte);
}

/** Hoje em America/Sao_Paulo. */
export function todayBRT(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Ciclos desde `inicio` até o ciclo que contém `hoje` (em ordem cronológica). */
export function listCiclos(opts: { inicio: string; diaCorte: number; hoje: string }): CicloPeriodo[] {
  const { inicio, hoje } = opts;
  const diaCorte = Math.min(31, Math.max(1, Math.trunc(opts.diaCorte)));
  if (!isDay(inicio) || !isDay(hoje) || inicio > hoje) return [];
  const out: CicloPeriodo[] = [];
  let start = inicio;
  while (start <= hoje && out.length < 600) {
    const next = nextStart(start, diaCorte);
    out.push({ dataInicio: start, dataFim: addDays(next, -1) });
    start = next;
  }
  return out;
}

export function cicloStatus(dataFim: string, hoje: string, carenciaDias = CARENCIA_DIAS): CicloStatus {
  if (hoje <= dataFim) return "EM_ANDAMENTO";
  if (hoje <= addDays(dataFim, carenciaDias)) return "EM_APURACAO";
  return "FECHADO";
}

export const CICLO_STATUS_LABELS: Record<CicloStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  EM_APURACAO: "Em apuração",
  FECHADO: "Fechado",
};

/** "24/08/2026" */
export function formatDayBR(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** "24/08 a 23/09/2026" */
export function formatCicloLabel(c: CicloPeriodo): string {
  const [y1, m1, d1] = c.dataInicio.split("-");
  const end = formatDayBR(c.dataFim);
  return y1 === c.dataFim.slice(0, 4) ? `${d1}/${m1} a ${end}` : `${d1}/${m1}/${y1} a ${end}`;
}

/** Date (@db.Date) → "YYYY-MM-DD". */
export function dateToDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dayToDate(day: string): Date {
  return toUtc(day);
}
