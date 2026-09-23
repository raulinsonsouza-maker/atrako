/**
 * Insights do vendedor: reputação + visitas.
 * APIs: GET /users/{id}, GET /users/{id}/items_visits/time_window
 */

import { prisma } from "@/lib/db";
import { mlFetch, mlGetMe } from "./client";
import { resolveMercadoLivre } from "@/lib/config/resolveConnection";

export type MlSellerUser = {
  id: number;
  nickname?: string;
  seller_reputation?: {
    level_id?: string | null;
    power_seller_status?: string | null;
    transactions?: { total?: number; completed?: number; canceled?: number };
    metrics?: {
      sales?: { period?: string; completed?: number };
    };
    transactions_ratings?: {
      positive?: number;
      neutral?: number;
      negative?: number;
    };
  };
};

export type MlVisitsWindow = {
  total_visits?: number;
  visits_detail?: Array<{ company?: string; quantity?: number }>;
};

export async function fetchSellerReputation(workspaceId: string, meliUserId: number) {
  return mlFetch<MlSellerUser>(workspaceId, `/users/${meliUserId}`);
}

export async function fetchSellerVisitsLastDays(
  workspaceId: string,
  meliUserId: number,
  last = 30,
) {
  return mlFetch<MlVisitsWindow>(
    workspaceId,
    `/users/${meliUserId}/items_visits/time_window?last=${last}&unit=day`,
  );
}

/** Atualiza snapshot do vendedor (reputação + visitas 30d). */
export async function refreshMarketplaceSellerSnapshot(workspaceId: string) {
  const conn = await resolveMercadoLivre(workspaceId);
  if (!conn) return null;

  const me = conn.meliUserId
    ? { id: conn.meliUserId }
    : await mlGetMe(workspaceId);
  const userId = me.id;

  const [user, visits] = await Promise.all([
    fetchSellerReputation(workspaceId, userId),
    fetchSellerVisitsLastDays(workspaceId, userId, 30).catch(() => null),
  ]);

  const rep = user.seller_reputation;
  const ratings = rep?.transactions_ratings;

  return prisma.marketplaceSellerSnapshot.upsert({
    where: {
      clienteId_provider: {
        clienteId: workspaceId,
        provider: "MERCADO_LIVRE",
      },
    },
    create: {
      clienteId: workspaceId,
      provider: "MERCADO_LIVRE",
      meliUserId: String(userId),
      nickname: user.nickname ?? null,
      reputationLevel: rep?.level_id ?? null,
      powerSellerStatus: rep?.power_seller_status ?? null,
      transactionsTotal: rep?.transactions?.total ?? null,
      ratingsPositive: ratings?.positive ?? null,
      ratingsNeutral: ratings?.neutral ?? null,
      ratingsNegative: ratings?.negative ?? null,
      visitsLast30: visits?.total_visits ?? null,
      rawPayload: { user, visits } as object,
      capturedAt: new Date(),
    },
    update: {
      meliUserId: String(userId),
      nickname: user.nickname ?? null,
      reputationLevel: rep?.level_id ?? null,
      powerSellerStatus: rep?.power_seller_status ?? null,
      transactionsTotal: rep?.transactions?.total ?? null,
      ratingsPositive: ratings?.positive ?? null,
      ratingsNeutral: ratings?.neutral ?? null,
      ratingsNegative: ratings?.negative ?? null,
      visitsLast30: visits?.total_visits ?? null,
      rawPayload: { user, visits } as object,
      capturedAt: new Date(),
    },
  });
}
