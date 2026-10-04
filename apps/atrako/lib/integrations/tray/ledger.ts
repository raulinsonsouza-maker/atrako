import { prisma } from "@/lib/db";
import { upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import { isTrayPaidStatus, type TrayOrder } from "./orders";

/**
 * Garante uma receita no Caixa para cada pedido Tray pago já gravado.
 * Mesma idempotencyKey do evento `payment.paid` (`ledger:tray-paid-…`), sem duplicar.
 */
export async function backfillTrayLedger(workspaceId: string): Promise<{ entries: number }> {
  const orders = await prisma.marketplaceOrder.findMany({
    where: { clienteId: workspaceId, provider: "TRAY" },
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

  let entries = 0;
  for (const o of orders) {
    const raw = o.rawPayload as { order?: TrayOrder } | null;
    if (!raw?.order || !isTrayPaidStatus(raw.order)) continue;
    if (!o.totalCents) continue;
    await upsertLedgerEntry({
      clienteId: workspaceId,
      type: "INCOME",
      amount: o.totalCents / 100,
      currency: o.currency ?? "BRL",
      occurredAt: o.occurredAt ?? new Date(),
      source: "tray",
      sourceRef: o.id,
      idempotencyKey: `ledger:tray-paid-${workspaceId}-${o.externalId}`,
      leadId: o.leadId,
      contact: o.buyerEmail,
      provider: "TRAY",
      description: `Tray #${o.externalId}`,
    });
    entries += 1;
  }
  return { entries };
}
