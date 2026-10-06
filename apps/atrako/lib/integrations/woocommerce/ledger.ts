import { prisma } from "@/lib/db";
import { upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import { isWooPaidOrder, isWooRefundedOrder, wooModifiedAt, wooPaidAt, type WooOrder } from "./orders";

type StoredOrder = {
  id: string;
  externalId: string;
  totalCents: number | null;
  currency: string | null;
  occurredAt: Date | null;
  leadId: string | null;
  buyerEmail: string | null;
};

/**
 * Reflete um pedido Woo no Caixa: pago → receita; reembolsado → receita + reembolso;
 * cancelado depois de pago → receita cancelada. Idempotente por pedido.
 */
export async function syncWooOrderLedger(workspaceId: string, order: StoredOrder, wooOrder: WooOrder) {
  if (!order.totalCents) return;
  const incomeKey = `ledger:woo-paid-${workspaceId}-${order.externalId}`;
  const refunded = isWooRefundedOrder(wooOrder);
  const paidAt = wooPaidAt(wooOrder);
  const base = {
    clienteId: workspaceId,
    amount: order.totalCents / 100,
    currency: order.currency ?? "BRL",
    source: "woocommerce",
    sourceRef: order.id,
    leadId: order.leadId,
    contact: order.buyerEmail,
    provider: "WOOCOMMERCE",
  };

  if (isWooPaidOrder(wooOrder) || (refunded && paidAt)) {
    await upsertLedgerEntry({
      ...base,
      type: "INCOME",
      occurredAt: paidAt ?? order.occurredAt ?? new Date(),
      idempotencyKey: incomeKey,
      description: `WooCommerce #${order.externalId}`,
    });
    if (refunded) {
      await upsertLedgerEntry({
        ...base,
        type: "REFUND",
        occurredAt: wooModifiedAt(wooOrder) ?? new Date(),
        idempotencyKey: `ledger:woo-refund-${workspaceId}-${order.externalId}`,
        description: `Reembolso WooCommerce #${order.externalId}`,
      });
    }
    return;
  }

  await prisma.workspaceLedgerEntry.updateMany({
    where: { clienteId: workspaceId, idempotencyKey: incomeKey, status: { not: "CANCELED" } },
    data: { status: "CANCELED" },
  });
}

/** Garante o Caixa para todos os pedidos Woo já importados (inclusive os de antes desta rotina). */
export async function backfillWooLedger(workspaceId: string): Promise<{ orders: number }> {
  const orders = await prisma.marketplaceOrder.findMany({
    where: { clienteId: workspaceId, provider: "WOOCOMMERCE" },
    select: {
      id: true,
      externalId: true,
      totalCents: true,
      currency: true,
      occurredAt: true,
      leadId: true,
      buyerEmail: true,
      rawPayload: true,
    },
  });
  for (const o of orders) {
    const raw = o.rawPayload as { order?: WooOrder } | null;
    if (!raw?.order) continue;
    await syncWooOrderLedger(workspaceId, o, raw.order);
  }
  return { orders: orders.length };
}
