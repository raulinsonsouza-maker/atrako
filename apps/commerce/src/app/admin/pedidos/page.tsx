import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

const statusTone: Record<string, "default" | "success" | "danger" | "accent"> = {
  PENDING: "accent",
  APPROVED: "success",
  REJECTED: "danger",
  REFUNDED: "default",
  CANCELLED: "default",
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="stack-lg">
      <PageHeader title="Pedidos" description="Lista dos pedidos mais recentes." />
      <Panel>
        {orders.length === 0 ? (
          <EmptyState title="Nenhum pedido" description="As vendas aparecerão aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">E-mail</th>
                  <th className="py-2 pr-3 font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--border)]">
                    <td className="py-3 pr-3">{order.email}</td>
                    <td className="py-3 pr-3">{formatBRL(order.totalCents)}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={statusTone[order.status] ?? "default"}>
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {order.createdAt.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="text-[var(--ink)] no-underline font-semibold underline-offset-2 hover:underline decoration-[var(--accent)]"
                      >
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
