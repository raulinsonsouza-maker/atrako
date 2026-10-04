/**
 * WorkspaceSettings.messagingPrefs — remetente/rodapé (Config → Empresa) + limites do motor.
 */

import { prisma } from "@/lib/db";

export type MessagingPrefs = {
  senderName: string | null;
  storeUrl: string | null;
  footerAddress: string | null;
  legalText: string | null;
  socials: Partial<Record<"instagram" | "facebook" | "tiktok" | "youtube" | "whatsapp" | "site", string>>;
  /** Janela de envio no fuso do workspace */
  sendStartHour: number;
  sendEndHour: number;
  /** Máx. e-mails de marketing por contato por dia (todos os fluxos) */
  maxEmailsPerDay: number;
  /** Intervalo mínimo entre WhatsApps de marketing (h) */
  minHoursBetweenWa: number;
  /** % do limite diário do portfólio WA reservado para automáticos */
  waAutoReservePercent: number;
  /** Janela de atribuição do clique/cupom (dias) */
  attributionDays: number;
  /** Janela de receita influenciada (dias) */
  influenceDays: number;
  /** Pausa dos fluxos quando o cliente responde (h) */
  replyPauseHours: number;
  nativeChecklist: Record<string, boolean>;
};

export const DEFAULT_MESSAGING_PREFS: MessagingPrefs = {
  senderName: null,
  storeUrl: null,
  footerAddress: null,
  legalText: null,
  socials: {},
  sendStartHour: 8,
  sendEndHour: 21,
  maxEmailsPerDay: 1,
  minHoursBetweenWa: 48,
  waAutoReservePercent: 40,
  attributionDays: 5,
  influenceDays: 3,
  replyPauseHours: 72,
  nativeChecklist: {},
};

function num(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parseMessagingPrefs(raw: unknown): MessagingPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const socialsRaw = (r.socials && typeof r.socials === "object" ? r.socials : {}) as Record<string, unknown>;
  const socials: MessagingPrefs["socials"] = {};
  for (const k of ["instagram", "facebook", "tiktok", "youtube", "whatsapp", "site"] as const) {
    const v = str(socialsRaw[k]);
    if (v) socials[k] = v;
  }
  const d = DEFAULT_MESSAGING_PREFS;
  return {
    senderName: str(r.senderName),
    storeUrl: str(r.storeUrl),
    footerAddress: str(r.footerAddress),
    legalText: str(r.legalText),
    socials,
    sendStartHour: num(r.sendStartHour, d.sendStartHour, 0, 23),
    sendEndHour: num(r.sendEndHour, d.sendEndHour, 1, 24),
    maxEmailsPerDay: num(r.maxEmailsPerDay, d.maxEmailsPerDay, 1, 10),
    minHoursBetweenWa: num(r.minHoursBetweenWa, d.minHoursBetweenWa, 0, 24 * 14),
    waAutoReservePercent: num(r.waAutoReservePercent, d.waAutoReservePercent, 0, 100),
    attributionDays: num(r.attributionDays, d.attributionDays, 1, 30),
    influenceDays: num(r.influenceDays, d.influenceDays, 0, 14),
    replyPauseHours: num(r.replyPauseHours, d.replyPauseHours, 0, 24 * 7),
    nativeChecklist:
      r.nativeChecklist && typeof r.nativeChecklist === "object"
        ? (r.nativeChecklist as Record<string, boolean>)
        : {},
  };
}

export async function loadMessagingPrefs(workspaceId: string) {
  const s = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { messagingPrefs: true, timezone: true, primaryColor: true, currency: true },
  });
  return {
    prefs: parseMessagingPrefs(s?.messagingPrefs),
    timezone: s?.timezone || "America/Sao_Paulo",
    primaryColor: s?.primaryColor ?? null,
    currency: s?.currency || "BRL",
  };
}
