/**
 * Puxa checkouts abandonados das lojas conectadas (Shopify, Nuvemshop, Tray).
 * Cursor e último erro ficam em WorkspaceConnection.metadata.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { syncShopifyAbandonedCheckouts } from "@/lib/integrations/shopify/abandoned-checkouts";
import { syncNuvemshopAbandonedCheckouts } from "@/lib/integrations/nuvemshop/abandoned-checkouts";
import { syncTrayAbandonedCheckouts } from "@/lib/integrations/tray/abandoned-checkouts";
import { RECOVERY_WINDOW_DAYS } from "./abandoned-cart";

const SYNCERS = {
  SHOPIFY: syncShopifyAbandonedCheckouts,
  NUVEMSHOP: syncNuvemshopAbandonedCheckouts,
  TRAY: syncTrayAbandonedCheckouts,
} as const;

type CheckoutProvider = keyof typeof SYNCERS;

const CURSOR_KEY = "abandonedCheckoutsSyncedAt";
const ERROR_KEY = "abandonedCheckoutsError";
const OVERLAP_MS = 10 * 60_000;
const FIRST_RUN_MS = 2 * 86_400_000;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function pollAbandonedCheckouts(opts?: {
  workspaceId?: string;
  /** Ignora o cursor e puxa a janela inteira de recuperação (backfill). */
  full?: boolean;
}) {
  const connections = await prisma.workspaceConnection.findMany({
    where: {
      status: "ACTIVE",
      provider: { in: Object.keys(SYNCERS) },
      ...(opts?.workspaceId ? { clienteId: opts.workspaceId } : {}),
    },
    select: { id: true, clienteId: true, provider: true, metadata: true },
  });

  const results: Array<{ workspaceId: string; provider: string; synced?: number; error?: string }> =
    [];
  for (const conn of connections) {
    const provider = conn.provider as CheckoutProvider;
    const meta = asRecord(conn.metadata);
    const startedAt = new Date();
    const cursor = typeof meta[CURSOR_KEY] === "string" ? Date.parse(meta[CURSOR_KEY]) : NaN;
    const since = opts?.full
      ? new Date(startedAt.getTime() - RECOVERY_WINDOW_DAYS * 86_400_000)
      : Number.isFinite(cursor)
        ? new Date(cursor - OVERLAP_MS)
        : new Date(startedAt.getTime() - FIRST_RUN_MS);

    try {
      const synced = await SYNCERS[provider](conn.clienteId, since);
      await saveMeta(conn.id, meta, { [CURSOR_KEY]: startedAt.toISOString(), [ERROR_KEY]: null });
      results.push({ workspaceId: conn.clienteId, provider, synced });
    } catch (err) {
      const error = err instanceof Error ? err.message.slice(0, 300) : String(err);
      console.warn(`[abandoned-checkouts] ${provider} ${conn.clienteId}`, error);
      await saveMeta(conn.id, meta, { [ERROR_KEY]: error });
      results.push({ workspaceId: conn.clienteId, provider, error });
    }
  }
  return results;
}

async function saveMeta(
  connectionId: string,
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  await prisma.workspaceConnection.update({
    where: { id: connectionId },
    data: { metadata: { ...prev, ...patch } as Prisma.InputJsonValue },
  });
}
