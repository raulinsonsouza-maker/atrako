/**
 * Datas de loja sem fuso ("2026-10-03T13:29:50", "2026-10-03 13:29:50") estão na hora da loja.
 * `new Date(raw)` usa o fuso do servidor (UTC em produção) e desloca o horário.
 */

import { zonedDate } from "@/lib/flows/dates";

export const STORE_TIMEZONE = "America/Sao_Paulo";

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const HAS_OFFSET_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

export function parseStoreLocalTime(raw: string | null | undefined, timeZone = STORE_TIMEZONE): Date | null {
  const s = raw?.trim();
  if (!s || s.startsWith("0000-00-00")) return null;
  if (HAS_OFFSET_RE.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = LOCAL_RE.exec(s);
  if (!m) return null;
  const d = zonedDate(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), timeZone);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + Number(m[6] ?? 0) * 1000);
}

/** Woo: `*_gmt` é UTC sem sufixo; o campo sem `_gmt` fica na hora da loja. */
export function parseWooTime(gmt: string | null | undefined, local: string | null | undefined): Date | null {
  const g = gmt?.trim();
  if (g && LOCAL_RE.test(g)) {
    const d = new Date(HAS_OFFSET_RE.test(g) ? g : `${g}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return parseStoreLocalTime(local);
}
