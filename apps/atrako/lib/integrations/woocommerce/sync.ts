import { ingestWooCommerceOrder } from "./ingest-order";
import { prisma } from "@/lib/db";
import { wcFetch, touchWooConnection } from "./client";
import type { WooOrder } from "./orders";
import { backfillWooLedger } from "./ledger";

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