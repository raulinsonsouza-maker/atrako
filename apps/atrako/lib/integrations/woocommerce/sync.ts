import { ingestWooCommerceOrder } from "./ingest-order";
import { prisma } from "@/lib/db";
import { wcFetch, touchWooConnection } from "./client";
import { getWooOrder, isWooPaidOrder, type WooOrder } from "./orders";
import { backfillWooLedger } from "./ledger";

/** Statuses que no Atrako ainda podem virar pagamento no Woo (webhook/order.updated perdido). */
const WOO_STALE_UNPAID = ["pending", "on-hold", "failed"] as const;

export async function syncWooCommerceWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number },
) {
  const daysBack = Math.max(1, options?.daysBack ?? 90);
  const maxPages = Math.max(1, options?.maxPages ?? 5);
  const after = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  let processed = 0;
  let pages = 0;

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      after,
      per_page: "100",
      page: String(page),
      orderby: "date",
      order: "asc",
      status: "any",
    });
    const orders = await wcFetch<WooOrder[]>(workspaceId, `/orders?${params.toString()}`);
    pages++;
    if (!orders.length) break;

    for (const order of orders) {
      await ingestWooCommerceOrder({ workspaceId, order });
      processed++;
    }
    if (orders.length < 100) break;
  }

  await backfillWooLedger(workspaceId).catch((err) =>
    console.error("[woo-ledger]", err instanceof Error ? err.message : err),
  );

  const connection = await prisma.workspaceConnection.findUnique({
    where: { clienteId_provider: { clienteId: workspaceId, provider: "WOOCOMMERCE" } },
    select: { id: true },
  });
  if (connection) await touchWooConnection(connection.id);

  return { processed, pages };
}

/**
 * Reconsulta no Woo os pedidos que o Atrako ainda tem como não pagos.
 * Cobre o caso em que o webhook de `order.updated` (Pix/boleto pago) não chegou
 * e o lead ficou em Carrinho abandonado apesar da compra.
 */
export async function reconcileUnpaidWooOrders(options?: {
  workspaceId?: string;
  daysBack?: number;
  limitPerWorkspace?: number;
}) {
  const daysBack = Math.max(1, options?.daysBack ?? 21);
  const limitPerWorkspace = Math.max(1, Math.min(200, options?.limitPerWorkspace ?? 80));
  const since = new Date(Date.now() - daysBack * 86_400_000);

  const connections = await prisma.workspaceConnection.findMany({
    where: {
      provider: "WOOCOMMERCE",
      status: "ACTIVE",
      ...(options?.workspaceId ? { clienteId: options.workspaceId } : {}),
    },
    select: { clienteId: true },
  });

  let checked = 0;
  let updated = 0;
  let paid = 0;
  let errors = 0;

  for (const conn of connections) {
    const rows = await prisma.marketplaceOrder.findMany({
      where: {
        clienteId: conn.clienteId,
        provider: "WOOCOMMERCE",
        occurredAt: { gte: since },
        status: { in: [...WOO_STALE_UNPAID] },
      },
      orderBy: { occurredAt: "desc" },
      take: limitPerWorkspace,
      select: { id: true, externalId: true, status: true },
    });

    for (const row of rows) {
      checked += 1;
      try {
        const woo = await getWooOrder(conn.clienteId, row.externalId);
        const remote = (woo.status ?? "").toLowerCase();
        const local = (row.status ?? "").toLowerCase();
        const becamePaid = isWooPaidOrder(woo);
        if (!becamePaid && remote === local) continue;
        await ingestWooCommerceOrder({ workspaceId: conn.clienteId, order: woo });
        updated += 1;
        if (becamePaid) paid += 1;
      } catch (err) {
        errors += 1;
        console.error(
          "[woo-reconcile]",
          conn.clienteId,
          row.externalId,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return { workspaces: connections.length, checked, updated, paid, errors };
}

/** Todos os workspaces com Woo ativo — usado no cron horário. */
export async function reconcileUnpaidWooTodosClientes() {
  return reconcileUnpaidWooOrders({ daysBack: 21, limitPerWorkspace: 80 });
}