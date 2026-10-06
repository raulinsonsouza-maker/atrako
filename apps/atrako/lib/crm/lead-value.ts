import { prisma } from "@/lib/db";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";

/** Valor do card de cliente: soma dos pedidos pagos de loja do contato (todas as compras). */
export async function contactLifetimeCents(workspaceId: string, contactId: string | null | undefined): Promise<number> {
  if (!contactId) return 0;
  const orders = await prisma.marketplaceOrder.findMany({
    where: { clienteId: workspaceId, contactId },
    select: { status: true, totalCents: true },
  });
  return orders.reduce((sum, o) => (isRevenueOrder(o.status) ? sum + (o.totalCents ?? 0) : sum), 0);
}
