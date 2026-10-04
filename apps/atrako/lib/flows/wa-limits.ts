/**
 * Limites WhatsApp: limite diário do portfólio (destinatários únicos fora da janela, 24h móveis),
 * reserva para automáticos, onboarding da Marketing Messages API e erros 131049/131050/132015.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { waFetch } from "@/lib/integrations/whatsapp/client";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";

const TIER_LIMITS: Record<string, number | null> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: null,
  UNLIMITED: null,
};

/** Tabela inicial (Meta, BR). Novas linhas com `effectiveFrom` maior substituem sem apagar o histórico. */
const DEFAULT_RATES = [
  { category: "marketing", priceMicros: 321_700 },
  { category: "utility", priceMicros: 35_000 },
  { category: "authentication", priceMicros: 35_000 },
];
const DEFAULT_RATES_FROM = new Date("2026-10-01T00:00:00Z");
let ratesSeeded = false;

async function ensureDefaultRates() {
  if (ratesSeeded) return;
  await prisma.waRateCard.createMany({
    data: DEFAULT_RATES.map((r) => ({ ...r, country: "BR", currency: "BRL", effectiveFrom: DEFAULT_RATES_FROM })),
    skipDuplicates: true,
  });
  ratesSeeded = true;
}

/** Preço vigente por mensagem (micros de BRL) para a categoria do template. */
export async function waRateFor(category: string, now = new Date()) {
  await ensureDefaultRates().catch(() => null);
  return prisma.waRateCard.findFirst({
    where: { category: category.toLowerCase(), country: "BR", effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });
}

export function tierToLimit(tier: string | null | undefined): number | null {
  if (!tier) return 250;
  const t = tier.toUpperCase();
  if (t in TIER_LIMITS) return TIER_LIMITS[t];
  const n = Number(t.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n * (t.includes("K") ? 1000 : 1) : 250;
}

export async function patchWhatsAppMetadata(workspaceId: string, patch: Record<string, unknown>) {
  const row = await prisma.workspaceConnection.findUnique({
    where: { clienteId_provider: { clienteId: workspaceId, provider: "WHATSAPP" } },
    select: { id: true, metadata: true },
  });
  if (!row) return;
  await prisma.workspaceConnection.update({
    where: { id: row.id },
    data: { metadata: { ...((row.metadata ?? {}) as object), ...patch } as Prisma.InputJsonValue },
  });
}

export async function getWhatsAppMetadata(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, "WHATSAPP");
  return (row?.metadata ?? {}) as Record<string, unknown>;
}

/** Atualiza limite do portfólio, qualidade do número e status da MM API. */
export async function refreshWaAccountInfo(workspaceId: string) {
  const wa = await resolveWhatsApp(workspaceId);
  if (!wa) return null;
  const patch: Record<string, unknown> = { accountInfoAt: new Date().toISOString() };
  try {
    const r = await waFetch(
      workspaceId,
      `/${wa.phoneNumberId}?fields=whatsapp_business_manager_messaging_limit,quality_rating,display_phone_number`,
    );
    const d = (await r.json()) as {
      whatsapp_business_manager_messaging_limit?: string;
      quality_rating?: string;
    };
    if (r.ok) {
      if (d.whatsapp_business_manager_messaging_limit) {
        patch.messagingLimit = d.whatsapp_business_manager_messaging_limit;
      }
      if (d.quality_rating) patch.phoneQuality = d.quality_rating;
    }
  } catch {
    /* ignore */
  }
  if (wa.wabaId) {
    try {
      const r = await waFetch(workspaceId, `/${wa.wabaId}?fields=marketing_messages_onboarding_status`);
      const d = (await r.json()) as { marketing_messages_onboarding_status?: string };
      if (r.ok && d.marketing_messages_onboarding_status) {
        patch.marketingMessagesStatus = d.marketing_messages_onboarding_status;
      }
    } catch {
      /* ignore */
    }
  }
  await patchWhatsAppMetadata(workspaceId, patch);
  return patch;
}

/** Destinatários únicos de template nas últimas 24h (aproxima a contagem da Meta). */
export async function uniqueWaRecipients24h(workspaceId: string, opts?: { campaignOnly?: boolean }) {
  const since = new Date(Date.now() - 86_400_000);
  const rows = await prisma.messageDelivery.findMany({
    where: {
      clienteId: workspaceId,
      channel: "WHATSAPP",
      isTest: false,
      createdAt: { gte: since },
      status: { notIn: ["FAILED", "BLOCKED", "SKIPPED", "QUEUED"] },
      ...(opts?.campaignOnly ? { campaignId: { not: null } } : {}),
    },
    distinct: ["contactId"],
    select: { contactId: true },
  });
  return rows.length;
}

export async function waCapacity(workspaceId: string, reservePercent: number) {
  const meta = await getWhatsAppMetadata(workspaceId);
  const limit = tierToLimit(typeof meta.messagingLimit === "string" ? meta.messagingLimit : null);
  const used = await uniqueWaRecipients24h(workspaceId);
  const campaignUsed = await uniqueWaRecipients24h(workspaceId, { campaignOnly: true });
  if (limit === null) {
    return { limit: null, used, automaticLeft: Infinity, campaignLeft: Infinity };
  }
  const campaignCap = Math.floor(limit * (1 - reservePercent / 100));
  return {
    limit,
    used,
    automaticLeft: Math.max(0, limit - used),
    campaignLeft: Math.max(0, Math.min(campaignCap - campaignUsed, limit - used)),
  };
}

export async function isMarketingMessagesOnboarded(workspaceId: string) {
  const meta = await getWhatsAppMetadata(workspaceId);
  return String(meta.marketingMessagesStatus ?? "").toUpperCase() === "ONBOARDED";
}

export const WA_ERROR = {
  /** Limite de marketing por usuário — não reenviar antes de 24h */
  USER_MARKETING_LIMIT: 131049,
  /** Usuário parou marketing desta empresa */
  USER_STOPPED_MARKETING: 131050,
  /** Segurada no pacing e descartada (template pausado) */
  PACING_DROPPED: 132015,
  TEMPLATE_PAUSED: 132015,
  TEMPLATE_DISABLED: 132016,
  OUTSIDE_WINDOW: 131047,
} as const;

/** Aplica efeitos de erro WA no contato. Retorna se deve cair para e-mail / re-enfileirar. */
export async function applyWaErrorToContact(
  contactId: string | null,
  code: number | null,
): Promise<{ fallbackEmail: boolean; requeue: boolean; blocked: boolean }> {
  if (!code) return { fallbackEmail: true, requeue: false, blocked: false };
  if (code === WA_ERROR.USER_MARKETING_LIMIT) {
    if (contactId) {
      await prisma.nativeContact.update({
        where: { id: contactId },
        data: { waMarketingBlockedUntil: new Date(Date.now() + 24 * 3_600_000) },
      });
    }
    return { fallbackEmail: true, requeue: false, blocked: true };
  }
  if (code === WA_ERROR.USER_STOPPED_MARKETING) {
    if (contactId) {
      await prisma.nativeContact.update({
        where: { id: contactId },
        data: { waMarketingOptOutAt: new Date() },
      });
    }
    return { fallbackEmail: true, requeue: false, blocked: true };
  }
  if (code === WA_ERROR.PACING_DROPPED) return { fallbackEmail: false, requeue: true, blocked: false };
  return { fallbackEmail: true, requeue: false, blocked: false };
}
