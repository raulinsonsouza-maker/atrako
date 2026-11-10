/**
 * Sync Olist ERP → MarketplaceOrder (+ match Woo).
 */

import { prisma } from "@/lib/db";
import { resolveOlistCredentials, touchOlistConnection } from "./client";
import { ingestOlistOrder } from "./ingest-order";
import { listOlistOrders } from "./orders";
import { listOlistContacts } from "./contacts";
import { upsertPersonAndLead } from "@/lib/atrako/person";

export async function syncOlistWorkspace(
  workspaceId: string,
  options?: { daysBack?: number; maxPages?: number; syncContacts?: boolean },
) {
  const resolved = await resolveOlistCredentials(workspaceId);
  if (!resolved) throw new Error("Olist ERP não conectado");

  const daysBack = Math.max(1, options?.daysBack ?? 90);
  const maxPages = Math.max(1, options?.maxPages ?? 15);
  const dataFinal = new Date();
  const dataInicial = new Date(Date.now() - daysBack * 86_400_000);

  const { orders, pages } = await listOlistOrders(workspaceId, {
    dataInicial,
    dataFinal,
    maxPages,
  });

  let processed = 0;
  let matchedWoo = 0;
  let errors = 0;

  for (const summary of orders) {
    try {
      const result = await ingestOlistOrder({
        workspaceId,
        orderId: summary.id,
        order: summary,
        fetchDetail: true,
      });
      processed += 1;
      if (result.matchedWoo) matchedWoo += 1;
      // Tiny/Olist Token API: evita burst (≈1 req detalhe por pedido).
      await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      errors += 1;
      console.error(
        "[olist-sync]",
        workspaceId,
        summary.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  let contactsProcessed = 0;
  if (options?.syncContacts) {
    try {
      const { contacts } = await listOlistContacts(workspaceId, { maxPages: 3 });
      for (const c of contacts) {
        if (!c.email && !c.phone) continue;
        await upsertPersonAndLead({
          workspaceId,
          name: c.name,
          email: c.email,
          phone: c.phone,
          source: "olist",
          metadata: {
            channel: "erp",
            provider: "OLIST_ERP",
            olistContactId: c.id,
            cpfCnpj: c.cpfCnpj,
          },
        }).catch(() => null);
        contactsProcessed += 1;
      }
    } catch (err) {
      console.error("[olist-contacts]", err instanceof Error ? err.message : err);
    }
  }

  await touchOlistConnection(resolved.connectionId);

  return {
    processed,
    pages,
    matchedWoo,
    errors,
    contactsProcessed,
    listed: orders.length,
  };
}

/** Sync incremental de todos workspaces com Olist ativo (cron horário). */
export async function syncOlistTodosClientes(options?: { daysBack?: number; maxPages?: number }) {
  const daysBack = Math.max(1, options?.daysBack ?? 3);
  const maxPages = Math.max(1, options?.maxPages ?? 5);

  const connections = await prisma.workspaceConnection.findMany({
    where: { provider: "OLIST_ERP", status: "ACTIVE" },
    select: { clienteId: true },
  });

  let workspaces = 0;
  let processed = 0;
  let matchedWoo = 0;
  let errors = 0;

  for (const conn of connections) {
    workspaces += 1;
    try {
      const result = await syncOlistWorkspace(conn.clienteId, { daysBack, maxPages });
      processed += result.processed;
      matchedWoo += result.matchedWoo;
      errors += result.errors;
    } catch (err) {
      errors += 1;
      console.error("[olist-hourly]", conn.clienteId, err instanceof Error ? err.message : err);
    }
  }

  return { workspaces, processed, matchedWoo, errors };
}
