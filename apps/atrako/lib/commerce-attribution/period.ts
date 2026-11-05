/** Recortes de período. Datas de calendário em UTC; instantes de pedido em Brasília (sem horário de verão). */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(value: string | null | undefined): value is string {
  return Boolean(value && YMD.test(value));
}

/** Meia-noite UTC do dia, para colunas `@db.Date`. */
export function calendarRange(inicio: string, fim: string) {
  return {
    gte: new Date(`${inicio}T00:00:00.000Z`),
    lte: new Date(`${fim}T00:00:00.000Z`),
  };
}

/** Inclusive, 00:00–23:59:59.999 em America/Sao_Paulo. */
export function brtRange(inicio: string, fim: string) {
  return {
    gte: new Date(`${inicio}T00:00:00.000-03:00`),
    lte: new Date(`${fim}T23:59:59.999-03:00`),
  };
}

export function brtDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function ymdFromLocalDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Último instante do mês civil `YYYY-MM`, em Brasília. */
export function brtMonthRange(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return brtRange(`${year}-${mm}-01`, `${year}-${mm}-${String(last).padStart(2, "0")}`);
}
