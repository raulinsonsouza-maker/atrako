import { getWorkspaceConnection, upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { prisma } from "@/lib/db";
import { ingestMercadoLivreOrder } from "./ingest-order";
import { mlFetch } from "./client";
import {
  buildMercadoLivreMonthlyRanges,
  shouldContinueMercadoLivrePagination,
} from "./sync-utils";

type MlOrderSearchResponse = {
  results?: Array<{ id?: number | string }>;
  paging?: { total?: number; limit?: number; offset?: number };
};

export type MercadoLivreSyncResult = {
  ok: boolean;
  processed: number;
  pages: number;
  total: number;
  dateFrom: string;
  dateTo: string;
  error: string | null;
};

const DEFAULT_DATE_FROM = "2026-01-01";

function dateOnly(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

function friendlyMercadoLivreError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/401|invalid_token|unauthorized/i.test(raw)) {
    return "A autorização do Mercado Livre expirou ou foi revogada. Reconecte a conta.";
  }
  if (/403|forbidden|not authorized/i.test(raw)) {
    return "A conta conectada não possui permissão para consultar esses pedidos no Mercado Livre.";
  }
  return raw || "Falha desconhecida ao sincronizar o Mercado Livre.";
}

async function persistSyncState(
  workspaceId: string,
  status: "SYNCING" | "ACTIVE" | "SYNC_ERROR",
  patch: Record<string, unknown>,
) {
  const connection = await getWorkspaceConnection(workspaceId, "MERCADO_LIVRE");
  if (!connection) return;
  const metadata = connection.metadata && typeof connection.metadata === "object"
    ? connection.metadata as Record<string, unknown>
    : {};
  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "MERCADO_LIVRE",
    label: connection.label,
    status,
    credentials: connection.credentials,
    metadata: { ...metadata, ...patch },
  });
}

async function syncRange(
  workspaceId: string,
  sellerId: number,
  range: { dateFrom: string; dateTo: string },
  maxPages?: number,
): Promise<{ processed: number; pages: number; total: number }> {
  const limit = 50;
  let processed = 0;
  let pages = 0;
  let total = 0;
  for (let offset = 0; ; offset += limit) {
    if (maxPages && pages >= maxPages) break;
    const params = new URLSearchParams({
      seller: String(sellerId),
      sort: "date_desc",
      limit: String(limit),
      offset: String(offset),
      "order.date_created.from": `${range.dateFrom}T00:00:00.000-00:00`,
      "order.date_created.to": `${range.dateTo}T23:59:59.999-00:00`,
    });
    const response = await mlFetch<MlOrderSearchResponse>(
      workspaceId,
      `/orders/search?${params.toString()}`,
    );
    const rows = response.results ?? [];
    total = response.paging?.total ?? total;
    pages++;
    for (const row of rows) {
      if (row.id == null) continue;
      await ingestMercadoLivreOrder({ workspaceId, orderId: row.id });
      processed++;
    }
    if (!shouldContinueMercadoLivrePagination({ received: rows.length, offset, limit, total })) break;
  }
  return { processed, pages, total };
}

export async function syncMercadoLivreWorkspace(
  workspaceId: string,
  options?: { dateFrom?: string; dateTo?: string; maxPages?: number },
): Promise<MercadoLivreSyncResult> {
  const dateFrom = options?.dateFrom ?? DEFAULT_DATE_FROM;
  const dateTo = options?.dateTo ?? dateOnly(new Date());
  await persistSyncState(workspaceId, "SYNCING", { lastSyncError: null });
  let processed = 0;
  let pages = 0;
  let total = 0;
  try {
    const seller = await mlFetch<{ id: number }>(workspaceId, "/users/me");
    for (const range of buildMercadoLivreMonthlyRanges(dateFrom, dateTo)) {
      const result = await syncRange(workspaceId, seller.id, range, options?.maxPages);
      processed += result.processed;
      pages += result.pages;
      total += result.total;
    }
    const completedAt = new Date();
    await Promise.all([
      persistSyncState(workspaceId, "ACTIVE", {
        lastSyncAt: completedAt.toISOString(),
        lastSyncError: null,
        ordersProcessed: processed,
        syncDateFrom: dateFrom,
        syncDateTo: dateTo,
      }),
      prisma.cliente.update({ where: { id: workspaceId }, data: { ultimoSyncAt: completedAt } }),
    ]);
    return { ok: true, processed, pages, total, dateFrom, dateTo, error: null };
  } catch (error) {
    const message = friendlyMercadoLivreError(error);
    await persistSyncState(workspaceId, "SYNC_ERROR", {
      lastSyncError: message,
      ordersProcessed: processed,
      syncDateFrom: dateFrom,
      syncDateTo: dateTo,
    }).catch(() => null);
    return { ok: false, processed, pages, total, dateFrom, dateTo, error: message };
  }
}
