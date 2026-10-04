/**
 * Datas importantes: aniversário (lojas, forms, WA, CSV, card), datas próprias e
 * aniversário da primeira compra. Gatilho `date_based` com idempotência anual (fluxo + contato + ano).
 */

import { prisma } from "@/lib/db";
import { enrollContact } from "@/lib/flows/engine";
import { isLeapYear, localParts, zonedDate } from "@/lib/flows/dates";

export type DateKind = "BIRTHDAY" | "CUSTOM" | "FIRST_ORDER";

/** Aceita YYYY-MM-DD, DD/MM/YYYY, DD/MM, DD-MM-YYYY, ISO com hora. */
export function parseBirthDate(raw: unknown): { month: number; day: number; year: number | null } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let year: number | null = null;
  let month: number;
  let day: number;
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    day = Number(m[1]);
    month = Number(m[2]);
    if (m[3]) {
      const y = Number(m[3]);
      year = m[3].length === 2 ? (y > 30 ? 1900 + y : 2000 + y) : y;
    }
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const maxDay = new Date(Date.UTC(2024, month, 0)).getUTCDate();
  if (day > maxDay) return null;
  const nowY = new Date().getUTCFullYear();
  if (year != null && (year < 1900 || year > nowY)) year = null;
  return { month, day, year };
}

const MONTH_NAMES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Resposta livre no WhatsApp: "15/08", "dia 15/8/1990", "15 de agosto". */
export function parseBirthdayReply(text: string): string | null {
  const s = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const numeric = s.match(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?\b/);
  if (numeric) return numeric[0].replace(/\s+/g, "");
  const named = s.match(/\b(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})(?:\s*(?:de\s+)?(\d{4}))?\b/);
  if (named) {
    const word = named[2];
    const idx = MONTH_NAMES.findIndex((m) => m === word || m.slice(0, 3) === word);
    if (idx >= 0) return `${named[1]}/${idx + 1}${named[3] ? `/${named[3]}` : ""}`;
  }
  return null;
}

/** Grava aniversário (não sobrescreve edição manual por dado de loja). */
export async function upsertContactBirthday(input: {
  workspaceId: string;
  contactId: string;
  raw: unknown;
  source: string;
  overwrite?: boolean;
}) {
  const parsed = parseBirthDate(input.raw);
  if (!parsed) return null;
  const existing = await prisma.contactImportantDate.findUnique({
    where: { contactId_kind_label: { contactId: input.contactId, kind: "BIRTHDAY", label: "Aniversário" } },
  });
  if (existing && !input.overwrite && existing.source === "manual") return existing;
  if (existing && existing.month === parsed.month && existing.day === parsed.day && (existing.year ?? null) === parsed.year) {
    return existing;
  }
  return prisma.contactImportantDate.upsert({
    where: { contactId_kind_label: { contactId: input.contactId, kind: "BIRTHDAY", label: "Aniversário" } },
    create: {
      clienteId: input.workspaceId,
      contactId: input.contactId,
      kind: "BIRTHDAY",
      label: "Aniversário",
      month: parsed.month,
      day: parsed.day,
      year: parsed.year,
      source: input.source.slice(0, 40),
    },
    update: { month: parsed.month, day: parsed.day, year: parsed.year, source: input.source.slice(0, 40) },
  });
}

/** Lê aniversário do payload de pedido/cliente das lojas. */
export function birthDateFromStorePayload(provider: string, raw: unknown): string | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const order = (r.order ?? r) as Record<string, unknown>;
  if (provider === "WOOCOMMERCE") {
    const meta = (order.meta_data as Array<{ key?: string; value?: unknown }> | undefined) ?? [];
    const keys = ["billing_birthdate", "_billing_birthdate", "billing_birth_date", "birthdate", "data_nascimento"];
    const hit = meta.find((m) => m.key && keys.includes(m.key.toLowerCase()));
    return hit?.value != null ? String(hit.value) : null;
  }
  if (provider === "TRAY") {
    const c = (order.Customer ?? order.customer) as Record<string, unknown> | undefined;
    const v = c?.birth_date ?? order.birth_date;
    return v && v !== "0000-00-00" ? String(v) : null;
  }
  if (provider === "NUVEMSHOP") {
    const c = order.customer as Record<string, unknown> | undefined;
    const v = c?.birth_date ?? c?.birthdate;
    return v ? String(v) : null;
  }
  if (provider === "SHOPIFY") {
    const c = order.customer as Record<string, unknown> | undefined;
    const mf = (c?.metafields as Array<{ key?: string; value?: unknown }> | undefined) ?? [];
    const hit = mf.find((m) => m.key === "birth_date" || m.key === "birthday" || m.key === "date_of_birth");
    return hit?.value != null ? String(hit.value) : null;
  }
  return null;
}

type DateFlowSettings = { dateKind?: DateKind; offsetDays?: number; sendHour?: number; label?: string };

/** Datas-alvo (mês/dia) para hoje − offset; em ano não bissexto, 28/02 também cobre 29/02. */
function targetMonthDays(today: { year: number; month: number; day: number }, offsetDays: number) {
  const t = new Date(Date.UTC(today.year, today.month - 1, today.day - offsetDays));
  const month = t.getUTCMonth() + 1;
  const day = t.getUTCDate();
  const out = [{ month, day }];
  if (month === 2 && day === 28 && !isLeapYear(t.getUTCFullYear())) out.push({ month: 2, day: 29 });
  return { list: out, year: t.getUTCFullYear() };
}

/** Cron de hora em hora: matricula quem faz aniversário (ou data própria / 1 ano de cliente) hoje − offset. */
export async function runDateTriggers(now = new Date()) {
  const flows = await prisma.messageFlow.findMany({
    where: { trigger: "date_based", status: "ACTIVE" },
    select: { id: true, clienteId: true, settings: true },
  });
  const tzCache = new Map<string, string>();
  let enrolled = 0;
  let checked = 0;
  for (const flow of flows) {
    const s = (flow.settings ?? {}) as DateFlowSettings;
    const kind = s.dateKind ?? "BIRTHDAY";
    const offset = Number(s.offsetDays ?? 0);
    const sendHour = Math.min(22, Math.max(0, Number(s.sendHour ?? 9)));
    let tz = tzCache.get(flow.clienteId);
    if (!tz) {
      const ws = await prisma.workspaceSettings.findUnique({ where: { clienteId: flow.clienteId }, select: { timezone: true } });
      tz = ws?.timezone || "America/Sao_Paulo";
      tzCache.set(flow.clienteId, tz);
    }
    const local = localParts(now, tz);
    if (local.hour < sendHour) continue;
    checked++;
    const { list, year } = targetMonthDays(local, offset);
    const startAt = zonedDate(local.year, local.month, local.day, sendHour, 0, tz);

    let contactIds: string[] = [];
    if (kind === "FIRST_ORDER") {
      for (const md of list) {
        const rows = await prisma.$queryRaw<Array<{ contactId: string }>>`
          SELECT "contactId" FROM "CustomerProfile"
          WHERE "clienteId" = ${flow.clienteId}
            AND "firstOrderAt" IS NOT NULL
            AND EXTRACT(MONTH FROM ("firstOrderAt" AT TIME ZONE ${tz})) = ${md.month}
            AND EXTRACT(DAY FROM ("firstOrderAt" AT TIME ZONE ${tz})) = ${md.day}
            AND EXTRACT(YEAR FROM ("firstOrderAt" AT TIME ZONE ${tz})) < ${year}`;
        contactIds.push(...rows.map((r) => r.contactId));
      }
    } else {
      const rows = await prisma.contactImportantDate.findMany({
        where: {
          clienteId: flow.clienteId,
          kind: kind === "CUSTOM" ? "CUSTOM" : "BIRTHDAY",
          ...(kind === "CUSTOM" && s.label ? { label: s.label } : {}),
          OR: list.map((md) => ({ month: md.month, day: md.day })),
        },
        select: { contactId: true },
      });
      contactIds = rows.map((r) => r.contactId);
    }

    for (const contactId of Array.from(new Set(contactIds))) {
      const r = await enrollContact({
        clienteId: flow.clienteId,
        trigger: "date_based",
        contactId,
        refType: "date",
        flowIds: [flow.id],
        dedupeKey: `date:${flow.id}:${year}`,
        startAt: startAt > now ? startAt : now,
        context: { includePurchased: false },
      }).catch((err) => {
        console.warn("[dates] enroll", err instanceof Error ? err.message : err);
        return { enrolled: 0 };
      });
      enrolled += r.enrolled;
    }
  }
  return { flows: flows.length, checked, enrolled };
}

/** Aniversariantes do mês (aba Campanhas / sino). */
export async function birthdaysInMonth(workspaceId: string, month: number) {
  return prisma.contactImportantDate.findMany({
    where: { clienteId: workspaceId, kind: "BIRTHDAY", month },
    orderBy: { day: "asc" },
    select: { day: true, month: true, contact: { select: { id: true, name: true, email: true, phone: true } } },
    take: 500,
  });
}

/** Quantos contatos têm aniversário (incentivo à coleta no card). */
export async function birthdayCoverage(workspaceId: string) {
  const [withDate, total] = await Promise.all([
    prisma.contactImportantDate.count({ where: { clienteId: workspaceId, kind: "BIRTHDAY" } }),
    prisma.nativeContact.count({ where: { clienteId: workspaceId } }),
  ]);
  return { withDate, total };
}
