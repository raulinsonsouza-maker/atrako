/**
 * Sync / reconciliação Tray → metadata, pedidos, produtos.
 */

import { prisma } from "@/lib/db";
import {
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { getTrayConnectionMeta, trayFetch } from "./client";
import {
  ingestTrayHubOrder,
  upsertTrayCatalogProduct,
} from "./ingest-order";
import {
  getTrayOrderComplete,
  listTrayOrders,
} from "./orders";

export type TraySyncResult = {
  store: { name: string | null; storeId: string | null } | null;
  orders: { imported: number; updated: number };
  products: { imported: number };
  errors: string[];
};

export async function syncTrayWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number },
): Promise<TraySyncResult> {
  const conn = await getTrayConnectionMeta(workspaceId);
  if (!conn) throw new Error("Tray não conectado");

  const daysBack = options?.daysBack ?? 90;
  const maxPages = options?.maxPages ?? 8;
  const errors: string[] = [];
  const result: TraySyncResult = {
    store: null,
    orders: { imported: 0, updated: 0 },
    products: { imported: 0 },
    errors,
  };

  try {
    const info = await trayFetch<{
      Store?: { name?: string; id?: string | number };
      name?: string;
      id?: string | number;
    }>(workspaceId, "/info").catch(() => null);

    const storeName =
      info?.Store?.name ||
      info?.name ||
      conn.label ||
      conn.storeHost ||
      "Tray";
    const storeId = String(
      info?.Store?.id ?? info?.id ?? conn.storeId ?? "",
    );
    result.store = { name: storeName, storeId: storeId || null };

    const existing = await getWorkspaceConnection(workspaceId, "TRAY");
    const prevMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "TRAY",
      label: storeName,
      credentials: existing?.credentials ?? conn.credentials,
      metadata: {
        ...prevMeta,
        storeId,
        storeHost: conn.storeHost,
        apiAddress: conn.apiAddress,
        storeName,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    errors.push(`store: ${err instanceof Error ? err.message : "failed"}`);
  }

  // Orders
  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const dateFrom = since.toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);
    const dateFilter = `${dateFrom},${dateTo} 23:59:59`;

    for (let page = 1; page <= maxPages; page++) {
      const { orders, paging } = await listTrayOrders(workspaceId, {
        page,
        limit: 50,
        date: dateFilter,
      });
      if (!orders.length) break;

      for (const summary of orders) {
        try {
          const id = summary.id;
          if (id == null) continue;
          const complete = await getTrayOrderComplete(workspaceId, id);
          const r = await ingestTrayHubOrder({
            workspaceId,
            order: complete,
          });
          if (r.created) result.orders.imported += 1;
          else result.orders.updated += 1;

          // catalog from line items
          for (const sold of complete.ProductsSold ?? []) {
            const p =
              sold && typeof sold === "object" && "ProductsSold" in sold
                ? (sold as { ProductsSold?: { product_id?: string | number; original_name?: string; name?: string; reference?: string; price?: string | number } }).ProductsSold
                : (sold as {
                    product_id?: string | number;
                    original_name?: string;
                    name?: string;
                    reference?: string;
                    price?: string | number;
                  });
            if (!p?.product_id) continue;
            const price =
              typeof p.price === "number"
                ? Math.round(p.price * 100)
                : Math.round(Number(String(p.price ?? 0).replace(",", ".")) * 100);
            await upsertTrayCatalogProduct({
              workspaceId,
              productId: String(p.product_id),
              title: p.original_name || p.name || `Produto ${p.product_id}`,
              sku: p.reference ?? null,
              priceCents: Number.isFinite(price) ? price : null,
              raw: p,
            });
            result.products.imported += 1;
          }
        } catch (err) {
          errors.push(`order: ${err instanceof Error ? err.message : "failed"}`);
        }
      }

      const total = paging?.total ?? 0;
      const limit = paging?.limit ?? 50;
      if (page * limit >= total) break;
      if (orders.length < limit) break;
    }
  } catch (err) {
    errors.push(`orders: ${err instanceof Error ? err.message : "failed"}`);
  }

  await prisma.workspaceConnection
    .updateMany({
      where: { clienteId: workspaceId, provider: "TRAY" },
      data: { lastSyncedAt: new Date() },
    })
    .catch(() => null);

  return result;
}
