/**
 * Completa pedidos de loja importados antes de itens/origem existirem, a partir do
 * `rawPayload` já gravado (sem chamar a loja). Idempotente: só toca o que falta.
 */

import { prisma } from "@/lib/db";
import type { WooOrder } from "@/lib/integrations/woocommerce/orders";
import { orderDay, reconcileOrderSources, type ReconcileResult } from "./reconcile";

const SITE_PROVIDERS = ["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"];
const BATCH = 100;

export async function backfillWooOrderItems(clienteId: string): Promise<number> {
  const { syncWooOrderItems } = await import("@/lib/integrations/woocommerce/ingest-order");
  let filled = 0;
  let cursor: string | undefined;
  for (;;) {
    const orders = await prisma.marketplaceOrder.findMany({
      where: {
        clienteId,
        provider: "WOOCOMMERCE",
        items: { none: {} },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, rawPayload: true },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    if (!orders.length) break;
    for (const o of orders) {
      const woo = (o.rawPayload as { order?: WooOrder } | null)?.order;
      if (!woo?.line_items?.length) continue;
      await syncWooOrderItems(clienteId, o.id, woo);
      filled++;
    }
    cursor = orders[orders.length - 1].id;
  }
  return filled;
}

/** Pedidos sem `MarketplaceOrderSource`, de qualquer data, entram na conciliação. */
export async function reconcileMissingOrderSources(clienteId: string): Promise<ReconcileResult | null> {
  const missing = await prisma.marketplaceOrder.findMany({
    where: {
      clienteId,
      provider: { in: SITE_PROVIDERS },
      source: null,
      OR: [{ status: null }, { status: { notIn: ["checkout-draft", "trash"] } }],
    },
    select: { provider: true, rawPayload: true, occurredAt: true, createdAt: true },
  });
  if (!missing.length) return null;
  const days = missing.map(orderDay).sort();
  return reconcileOrderSources(clienteId, { dateFrom: days[0], dateTo: days[days.length - 1] });
}

export async function backfillOrderDetails(clienteId: string) {
  const items = await backfillWooOrderItems(clienteId);
  const sources = await reconcileMissingOrderSources(clienteId);
  return { items, sources: sources?.orders ?? 0 };
}
