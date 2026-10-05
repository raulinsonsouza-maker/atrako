/**
 * Sync / reconciliação TikTok Shop → metadata da loja, produtos, pedidos.
 */

import { prisma } from "@/lib/db";
import {
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { getTiktokShopConnectionMeta } from "./client";
import { ingestTiktokShopOrder, upsertTiktokShopCatalogProduct } from "./ingest-order";
import {
  getTiktokShopAuthorizedShopsForWorkspace,
  searchTiktokShopOrders,
  searchTiktokShopProducts,
} from "./orders";

export type TiktokShopSyncResult = {
  shop: { name: string | null; shopId: string | null } | null;
  orders: { imported: number; updated: number };
  products: { imported: number };
  errors: string[];
};

export async function syncTiktokShopWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number },
): Promise<TiktokShopSyncResult> {
  const conn = await getTiktokShopConnectionMeta(workspaceId);
  if (!conn) throw new Error("TikTok Shop não conectado");

  const daysBack = options?.daysBack ?? 90;
  const maxPages = options?.maxPages ?? 8;
  const errors: string[] = [];
  const result: TiktokShopSyncResult = {
    shop: null,
    orders: { imported: 0, updated: 0 },
    products: { imported: 0 },
    errors,
  };

  try {
    const shops = await getTiktokShopAuthorizedShopsForWorkspace(workspaceId);
    const shop =
      shops.find((s) => s.id && String(s.id) === String(conn.shopId ?? "")) ?? shops[0];
    const shopName = shop?.name || conn.label || "TikTok Shop";
    const shopId = shop?.id ? String(shop.id) : conn.shopId ?? null;
    result.shop = { name: shopName, shopId };

    const existing = await getWorkspaceConnection(workspaceId, "TIKTOK_SHOP");
    const prevMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const credentials = (existing?.credentials ?? conn.credentials) as Record<string, unknown>;
    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "TIKTOK_SHOP",
      label: shopName,
      credentials: {
        ...credentials,
        shopId,
        shopCipher: shop?.cipher ?? credentials.shopCipher ?? null,
      },
      metadata: {
        ...prevMeta,
        shopId,
        shopName,
        region: shop?.region ?? prevMeta.region ?? null,
        sellerType: shop?.seller_type ?? prevMeta.sellerType ?? null,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    errors.push(`shop: ${err instanceof Error ? err.message : "failed"}`);
  }

  try {
    let pageToken = "";
    for (let page = 0; page < maxPages; page++) {
      const listed = await searchTiktokShopProducts(workspaceId, { pageToken, pageSize: 50 });
      for (const product of listed.products ?? []) {
        await upsertTiktokShopCatalogProduct({ workspaceId, product });
        result.products.imported += 1;
      }
      pageToken = listed.next_page_token || "";
      if (!pageToken) break;
    }
  } catch (err) {
    errors.push(`products: ${err instanceof Error ? err.message : "failed"}`);
  }

  try {
    const updateTimeLt = Math.floor(Date.now() / 1000);
    const updateTimeGe = updateTimeLt - daysBack * 24 * 60 * 60;
    let pageToken = "";
    for (let page = 0; page < maxPages; page++) {
      const listed = await searchTiktokShopOrders(workspaceId, {
        updateTimeGe,
        updateTimeLt,
        pageToken,
        pageSize: 50,
      });
      for (const order of listed.orders ?? []) {
        try {
          const r = await ingestTiktokShopOrder({
            workspaceId,
            order,
            shopId: result.shop?.shopId ?? conn.shopId,
          });
          if (r.created) result.orders.imported += 1;
          else result.orders.updated += 1;
        } catch (err) {
          errors.push(`order ${order.id}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
      pageToken = listed.next_page_token || "";
      if (!pageToken) break;
    }
  } catch (err) {
    errors.push(`orders: ${err instanceof Error ? err.message : "failed"}`);
  }

  await prisma.workspaceConnection
    .updateMany({
      where: { clienteId: workspaceId, provider: "TIKTOK_SHOP" },
      data: { lastSyncedAt: new Date() },
    })
    .catch(() => null);

  return result;
}
