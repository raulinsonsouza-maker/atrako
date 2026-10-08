/** Agrupamento dos gráficos de período. Até 62 dias no dia, até 180 na semana, o ano no mês. */

export type ChartAgrupamento = "dia" | "semana" | "mes";

const DAY_MS = 86_400_000;

export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function agrupamentoPorDias(days: number): ChartAgrupamento {
  if (days > 180) return "mes";
  if (days > 62) return "semana";
  return "dia";
}

export function diasEntre(startYmd: string, endYmd: string) {
  const start = Date.parse(`${startYmd.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${endYmd.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.abs(Math.round((end - start) / DAY_MS)) + 1;
}

export function bucketYmd(dayKey: string, agrupamento: ChartAgrupamento) {
  const day = dayKey.slice(0, 10);
  if (agrupamento === "dia") return day;
  if (agrupamento === "mes") return `${day.slice(0, 7)}-01`;
  const date = new Date(`${day}T00:00:00Z`);
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}

export function rotuloEixo(dayKey: string, agrupamento: ChartAgrupamento, multiYear: boolean) {
  const [year, month, day] = dayKey.slice(0, 10).split("-");
  const mes = MESES_CURTOS[Number(month) - 1] ?? month;
  if (agrupamento === "mes") return multiYear ? `${mes}/${year.slice(2)}` : mes;
  return `${day}/${month}`;
}

export function rotuloTooltip(dayKey: string, agrupamento: ChartAgrupamento) {
  const [year, month, day] = dayKey.slice(0, 10).split("-");
  if (agrupamento === "mes") return `${MESES_LONGOS[Number(month) - 1] ?? month} ${year}`;
  if (agrupamento === "semana") return `Semana de ${day}/${month}`;
  return `${day}/${month}`;
}
