/**
 * Calendário sazonal do varejo BR (datas móveis calculadas por ano) + datas próprias da loja
 * (WorkspaceCalendarDate). Alimenta a faixa "Próximas datas" e a criação automática D-30.
 */

import { prisma } from "@/lib/db";

export type SeasonalDate = {
  key: string;
  label: string;
  date: Date;
  custom?: boolean;
  /** Sugestão de abordagem para a campanha */
  hint?: string;
  leadDays: number;
};

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** n-ésimo dia da semana do mês (weekday 0=domingo). */
export function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = utc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month, 1 + offset + (n - 1) * 7);
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function retailCalendar(year: number): Omit<SeasonalDate, "leadDays">[] {
  const easter = easterSunday(year);
  const blackFriday = nthWeekday(year, 11, 5, 4);
  return [
    { key: "ano-novo", label: "Ano Novo", date: utc(year, 1, 1), hint: "Metas, recomeço, novidades do ano" },
    { key: "carnaval", label: "Carnaval", date: addDays(easter, -47), hint: "Kits, praticidade, festa" },
    { key: "dia-da-mulher", label: "Dia da Mulher", date: utc(year, 3, 8), hint: "Homenagem, presentes" },
    { key: "dia-do-consumidor", label: "Dia do Consumidor", date: utc(year, 3, 15), hint: "Ofertas relâmpago, frete grátis" },
    { key: "pascoa", label: "Páscoa", date: easter, hint: "Presentes, família" },
    { key: "dia-das-maes", label: "Dia das Mães", date: nthWeekday(year, 5, 0, 2), hint: "Guia de presentes, entrega garantida" },
    { key: "dia-dos-namorados", label: "Dia dos Namorados", date: utc(year, 6, 12), hint: "Presentes a dois, prazo de entrega" },
    { key: "dia-dos-pais", label: "Dia dos Pais", date: nthWeekday(year, 8, 0, 2), hint: "Guia de presentes" },
    { key: "dia-do-cliente", label: "Dia do Cliente", date: utc(year, 9, 15), hint: "Agradecimento, cupom para a base" },
    { key: "dia-das-criancas", label: "Dia das Crianças", date: utc(year, 10, 12), hint: "Presentes por idade" },
    { key: "11-11", label: "11.11", date: utc(year, 11, 11), hint: "Esquenta da Black Friday" },
    { key: "black-friday", label: "Black Friday", date: blackFriday, hint: "Maior desconto do ano, aviso antecipado" },
    { key: "cyber-monday", label: "Cyber Monday", date: addDays(blackFriday, 3), hint: "Última chance da Black" },
    { key: "natal", label: "Natal", date: utc(year, 12, 25), hint: "Prazo de entrega, guia de presentes" },
  ];
}

/** Próximas datas (sazonais + próprias) dentro de `days`. */
export async function upcomingDates(workspaceId: string, opts?: { days?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  const horizon = addDays(now, opts?.days ?? 120);
  const prefs = await prisma.workspaceCalendarDate.findMany({ where: { clienteId: workspaceId } });
  const byKey = new Map(prefs.map((p) => [p.key, p]));
  const out: SeasonalDate[] = [];
  for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    for (const d of retailCalendar(year)) {
      const pref = byKey.get(d.key);
      if (pref && !pref.enabled) continue;
      if (d.date < addDays(now, -1) || d.date > horizon) continue;
      out.push({ ...d, key: `${d.key}-${year}`, leadDays: pref?.leadDays ?? 30 });
    }
    for (const p of prefs) {
      if (!p.custom || !p.enabled || !p.date) continue;
      const base = p.date;
      const date = p.recurring ? utc(year, base.getUTCMonth() + 1, base.getUTCDate()) : base;
      if (!p.recurring && year !== now.getUTCFullYear()) continue;
      if (date < addDays(now, -1) || date > horizon) continue;
      out.push({ key: `${p.key}-${date.getUTCFullYear()}`, label: p.label, date, custom: true, leadDays: p.leadDays });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Liga/desliga data sazonal ou cria data própria. */
export async function upsertCalendarDate(
  workspaceId: string,
  input: { key?: string; label?: string; date?: string | null; recurring?: boolean; enabled?: boolean; leadDays?: number },
) {
  const custom = !input.key || input.key.startsWith("custom:");
  const key =
    input.key ||
    `custom:${(input.label ?? "data")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)}`;
  const seasonal = retailCalendar(new Date().getUTCFullYear()).find((d) => d.key === key);
  const label = input.label ?? seasonal?.label ?? key;
  const date = input.date ? new Date(`${input.date.slice(0, 10)}T12:00:00Z`) : null;
  return prisma.workspaceCalendarDate.upsert({
    where: { clienteId_key: { clienteId: workspaceId, key } },
    create: {
      clienteId: workspaceId,
      key,
      label: label.slice(0, 120),
      date,
      recurring: input.recurring ?? true,
      custom,
      enabled: input.enabled ?? true,
      leadDays: Math.min(90, Math.max(7, input.leadDays ?? 30)),
    },
    update: {
      ...(input.label ? { label: input.label.slice(0, 120) } : {}),
      ...(input.date !== undefined ? { date } : {}),
      ...(input.recurring !== undefined ? { recurring: input.recurring } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.leadDays !== undefined ? { leadDays: Math.min(90, Math.max(7, input.leadDays)) } : {}),
    },
  });
}
