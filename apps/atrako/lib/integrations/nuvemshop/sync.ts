/**
 * Sync Nuvemshop → store metadata, pedidos, produtos.
 */

import { prisma } from "@/lib/db";
import {
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { nuvemshopFetch, resolveNuvemshopConnection } from "./client";
import {
  ingestNuvemshopHubOrder,
  upsertNuvemshopCatalogProduct,
} from "./ingest-order";
import { listNuvemshopOrders, listNuvemshopProducts } from "./orders";

export type NuvemshopSyncResult = {
  store: { name: string | null; storeId: string | null } | null;
  orders: { imported: number; updated: number };
  products: { imported: number };
  errors: string[];
};

export async function syncNuvemshopWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number },
): Promise<NuvemshopSyncResult> {
  const conn = await resolveNuvemshopConnection(workspaceId);
  if (!conn) throw new Error("Nuvemshop não conectado");

  const daysBack = options?.daysBack ?? 90;
  const maxPages = options?.maxPages ?? 8;
  const errors: string[] = [];
  const result: NuvemshopSyncResult = {
    store: null,
    orders: { imported: 0, updated: 0 },
    products: { imported: 0 },
    errors,
  };

  try {
    const store = await nuvemshopFetch<{
      name?: string;
      id?: number | string;
      original_domain?: string;
      url_with_protocol?: string;
    }>(workspaceId, "/store");
    const storeName = store?.name || `Nuvemshop #${conn.storeId}`;
    result.store = {
      name: storeName,
      storeId: String(store?.id ?? conn.storeId),
    };

    const existing = await getWorkspaceConnection(workspaceId, "NUVEMSHOP");
    const prevMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "NUVEMSHOP",
      label: storeName,
      credentials: existing?.credentials ?? {
        storeId: conn.storeId,
        accessToken: conn.accessToken,
      },
      metadata: {
        ...prevMeta,
        storeId: conn.storeId,
        storeName,
        domain: store?.original_domain ?? store?.url_with_protocol ?? null,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    errors.push(`store: ${err instanceof Error ? err.message : "failed"}`);
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const createdAtMin = since.toISOString();

    for (let page = 1; page <= maxPages; page++) {
      const orders = await listNuvemshopOrders(workspaceId, {
        page,
        perPage: 50,
        createdAtMin,
      });
      if (!orders.length) break;
      for (const order of orders) {
        try {
          const r = await ingestNuvemshopHubOrder({ workspaceId, order });
          if (r.created) result.orders.imported += 1;
          else result.orders.updated += 1;
        } catch (err) {
          errors.push(`order: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
      if (orders.length < 50) break;
    }
  } catch (err) {
    errors.push(`orders: ${err instanceof Error ? err.message : "failed"}`);
  }

  try {
    for (let page = 1; page <= maxPages; page++) {
      const products = await listNuvemshopProducts(workspaceId, {
        page,
        perPage: 50,
      });
      if (!products.length) break;
      for (const p of products) {
        try {
          const id = p.id != null ? String(p.id) : null;
          if (!id) continue;
          const variants = Array.isArray(p.variants) ? p.variants : [];
          const first = variants[0] as
            | { sku?: string; price?: string | number }
            | undefined;
          const priceRaw = first?.price ?? p.price;
          const priceCents =
            priceRaw != null
              ? Math.round(
                  Number(String(priceRaw).replace(",", ".")) * 100,
                )
              : null;
          await upsertNuvemshopCatalogProduct({
            workspaceId,
            productId: id,
            title: String(p.name ?? p.title ?? `Produto ${id}`),
            sku: first?.sku ? String(first.sku) : null,
            priceCents: Number.isFinite(priceCents) ? priceCents : null,
            status: p.published != null ? String(p.published) : null,
            raw: p,
          });
          result.products.imported += 1;
        } catch {
          // skip
        }
      }
      if (products.length < 50) break;
    }
  } catch (err) {
    errors.push(`products: ${err instanceof Error ? err.message : "failed"}`);
  }

  await prisma.workspaceConnection
    .updateMany({
      where: { clienteId: workspaceId, provider: "NUVEMSHOP" },
      data: { lastSyncedAt: new Date() },
    })
    .catch(() => null);

  return result;
}
