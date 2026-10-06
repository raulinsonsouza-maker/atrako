/**
 * Completa pedidos de loja importados antes de itens/origem existirem, a partir do
 * `rawPayload` já gravado (sem chamar a loja). Idempotente: só toca o que falta.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { saveContactLocation } from "@/lib/commerce/contact-location";
import { orderLocation } from "@/lib/commerce/order-details";
import { trayOrderOccurredAt, type TrayOrder } from "@/lib/integrations/tray/orders";
import { wooOrderOccurredAt, type WooOrder } from "@/lib/integrations/woocommerce/orders";
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

function storeOccurredAt(provider: string, rawPayload: unknown): Date | null {
  const order = (rawPayload as { order?: unknown } | null)?.order;
  if (!order || typeof order !== "object") return null;
  if (provider === "WOOCOMMERCE") return wooOrderOccurredAt(order as WooOrder);
  const tray = order as TrayOrder;
  return provider === "TRAY" && (tray.date || tray.modified) ? trayOrderOccurredAt(tray) : null;
}

/**
 * Corrige `occurredAt` gravado lendo a hora da loja no fuso do servidor. Carrinhos e lançamentos
 * derivados desse horário andam o mesmo deslocamento. Idempotente: pedido correto não muda.
 */
export async function backfillOrderTimes(clienteId: string): Promise<number> {
  let fixed = 0;
  let cursor: string | undefined;
  for (;;) {
    const orders = await prisma.marketplaceOrder.findMany({
      where: { clienteId, provider: { in: ["WOOCOMMERCE", "TRAY"] }, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, provider: true, externalId: true, occurredAt: true, rawPayload: true },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    if (!orders.length) break;
    for (const o of orders) {
      const correct = storeOccurredAt(o.provider, o.rawPayload);
      if (!correct || !o.occurredAt) continue;
      const delta = correct.getTime() - o.occurredAt.getTime();
      if (Math.abs(delta) < 1000) continue;
      const shift = (col: string) => Prisma.sql`${Prisma.raw(`"${col}"`)} + (${delta}::double precision * interval '1 millisecond')`;
      const orderRef = `${o.provider}:${o.externalId}`;
      await prisma.$transaction([
        prisma.marketplaceOrder.update({ where: { id: o.id }, data: { occurredAt: correct } }),
        prisma.$executeRaw`UPDATE "AbandonedCart" SET "abandonedAt" = ${shift("abandonedAt")}, "recoveredAt" = ${shift("recoveredAt")}
          WHERE "clienteId" = ${clienteId} AND provider = ${o.provider} AND kind = 'order' AND "externalId" = ${`order:${o.externalId}`}`,
        prisma.$executeRaw`UPDATE "AbandonedCart" SET "recoveredAt" = ${shift("recoveredAt")}
          WHERE "clienteId" = ${clienteId} AND "recoveredOrderId" = ${orderRef} AND "externalId" <> ${`order:${o.externalId}`}`,
        prisma.workspaceLedgerEntry.updateMany({
          where: { clienteId, idempotencyKey: `ledger:tray-paid-${clienteId}-${o.externalId}`, provider: "TRAY" },
          data: { occurredAt: correct },
        }),
      ]);
      fixed++;
    }
    cursor = orders[orders.length - 1].id;
  }
  return fixed;
}

/** Cidade/UF do último pedido com endereço vai para o contato. */
export async function backfillContactLocations(clienteId: string): Promise<number> {
  const orders = await prisma.marketplaceOrder.findMany({
    where: { clienteId, provider: { in: ["WOOCOMMERCE", "TRAY"] }, contactId: { not: null } },
    select: { contactId: true, provider: true, rawPayload: true },
    orderBy: { occurredAt: "desc" },
  });
  const seen = new Set<string>();
  let saved = 0;
  for (const o of orders) {
    if (seen.has(o.contactId!)) continue;
    const loc = orderLocation(o.provider, o.rawPayload);
    if (!loc) continue;
    seen.add(o.contactId!);
    await saveContactLocation(o.contactId, loc, { overwrite: true });
    saved++;
  }
  return saved;
}

export async function backfillOrderDetails(clienteId: string) {
  const items = await backfillWooOrderItems(clienteId);
  const sources = await reconcileMissingOrderSources(clienteId);
  return { items, sources: sources?.orders ?? 0 };
}
