/**
 * Sync / reconciliação Shopee → shop metadata, produtos, pedidos.
 */

import { prisma } from "@/lib/db";
import {
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { getShopeeConnectionMeta } from "./client";
import {
  ingestShopeeOrder,
  upsertShopeeCatalogProduct,
} from "./ingest-order";
import {
  getShopeeItemBaseInfo,
  getShopeeOrderDetails,
  getShopeeOrderList,
  getShopeeShopInfo,
  getShopeeShopProfile,
  listShopeeItemIds,
} from "./orders";

export type ShopeeSyncResult = {
  shop: { name: string | null; shopId: string | null } | null;
  orders: { imported: number; updated: number };
  products: { imported: number };
  errors: string[];
};

export async function syncShopeeWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number },
): Promise<ShopeeSyncResult> {
  const conn = await getShopeeConnectionMeta(workspaceId);
  if (!conn) throw new Error("Shopee não conectado");

  const daysBack = options?.daysBack ?? 90;
  const maxPages = options?.maxPages ?? 8;
  const errors: string[] = [];
  const result: ShopeeSyncResult = {
    shop: null,
    orders: { imported: 0, updated: 0 },
    products: { imported: 0 },
    errors,
  };

  try {
    const [info, profile] = await Promise.all([
      getShopeeShopInfo(workspaceId).catch(() => null),
      getShopeeShopProfile(workspaceId).catch(() => null),
    ]);
    const shopName =
      info?.shop_name || profile?.shop_name || conn.label || "Shopee";
    const shopId = String(info?.shop_id ?? conn.shopId ?? "");
    result.shop = { name: shopName, shopId: shopId || null };

    const existing = await getWorkspaceConnection(workspaceId, "SHOPEE");
    const prevMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "SHOPEE",
      label: shopName,
      credentials: existing?.credentials ?? conn.credentials,
      metadata: {
        ...prevMeta,
        shopId,
        shopName,
        shopLogo: profile?.shop_logo ?? null,
        region: info?.region ?? null,
        shopStatus: info?.status ?? null,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    errors.push(`shop: ${err instanceof Error ? err.message : "failed"}`);
  }

  try {
    let offset = 0;
    for (let page = 0; page < maxPages; page++) {
      const listed = await listShopeeItemIds(workspaceId, offset, 50);
      const ids = (listed.item ?? []).map((i) => i.item_id).filter(Boolean);
      if (ids.length) {
        const base = await getShopeeItemBaseInfo(workspaceId, ids);
        for (const item of base.item_list ?? []) {
          await upsertShopeeCatalogProduct({ workspaceId, item });
          result.products.imported += 1;
        }
      }
      if (!listed.has_next_page) break;
      offset = listed.next_offset ?? offset + ids.length;
      if (!ids.length) break;
    }
  } catch (err) {
    errors.push(`products: ${err instanceof Error ? err.message : "failed"}`);
  }

  try {
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - daysBack * 24 * 60 * 60;
    let cursor = "";
    for (let page = 0; page < maxPages; page++) {
      const listed = await getShopeeOrderList(workspaceId, {
        timeFrom,
        timeTo,
        cursor,
        pageSize: 40,
        timeRangeField: "update_time",
      });
      const sns = (listed.order_list ?? [])
        .map((o) => o.order_sn)
        .filter((s): s is string => Boolean(s));
      if (sns.length) {
        const details = await getShopeeOrderDetails(workspaceId, sns);
        for (const order of details) {
          try {
            const r = await ingestShopeeOrder({
              workspaceId,
              order,
              shopId: conn.shopId,
            });
            if (r.created) result.orders.imported += 1;
            else result.orders.updated += 1;
          } catch (err) {
            errors.push(
              `order ${order.order_sn}: ${err instanceof Error ? err.message : "failed"}`,
            );
          }
        }
      }
      if (!listed.more) break;
      cursor = listed.next_cursor || "";
      if (!cursor) break;
    }
  } catch (err) {
    errors.push(`orders: ${err instanceof Error ? err.message : "failed"}`);
  }

  await prisma.workspaceConnection
    .updateMany({
      where: { clienteId: workspaceId, provider: "SHOPEE" },
      data: { lastSyncedAt: new Date() },
    })
    .catch(() => null);

  return result;
}
