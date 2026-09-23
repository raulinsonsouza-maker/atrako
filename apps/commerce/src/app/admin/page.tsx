import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/PageHeader";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

async function approvedRevenueSince(since: Date) {
  const agg = await prisma.order.aggregate({
    where: { status: "APPROVED", approvedAt: { gte: since } },
    _sum: { totalCents: true },
  });
  return agg._sum.totalCents ?? 0;
}

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

export default async function AdminDashboardPage() {
  const today = startOfDay(new Date());
  const [orderCount, revToday, rev7d, rev30d, recentOrders, utmRows] = await Promise.all([
    prisma.order.count(),
    approvedRevenueSince(today),
    approvedRevenueSince(daysAgo(7)),
    approvedRevenueSince(daysAgo(30)),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: true },
    }),
    prisma.order.groupBy({
      by: ["utmSource"],
      where: { utmSource: { not: null } },
      _count: { utmSource: true },
      orderBy: { _count: { utmSource: "desc" } },
      take: 8,
    }),
  ]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Visão geral de pedidos e receita aprovada."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <p className="m-0 label-tech">Pedidos</p>
          <p className="admin-stat-value mt-3">{orderCount}</p>
        </Panel>
        <Panel>
          <p className="m-0 label-tech">Receita hoje</p>
          <p className="admin-stat-value mt-3">{formatBRL(revToday)}</p>
        </Panel>
        <Panel>
          <p className="m-0 label-tech">Receita 7 dias</p>
          <p className="admin-stat-value mt-3">{formatBRL(rev7d)}</p>
        </Panel>
        <Panel>
          <p className="m-0 label-tech">Receita 30 dias</p>
          <p className="admin-stat-value mt-3">{formatBRL(rev30d)}</p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2 stack">
          <h2 className="admin-section-title">Pedidos recentes</h2>
          {recentOrders.length === 0 ? (
            <EmptyState title="Nenhum pedido ainda" description="Quando houver vendas, elas aparecem aqui." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[var(--text-sm)]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-[var(--border)]">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/admin/pedidos/${order.id}`}
                          className="text-[var(--ink)] no-underline hover:underline decoration-[var(--accent)]"
                        >
                          {order.email}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">{formatBRL(order.totalCents)}</td>
                      <td className="py-3 pr-3">
                        <Badge tone={statusTone[order.status] ?? "default"}>
                          {statusLabel[order.status] ?? order.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-[var(--muted)]">
                        {order.createdAt.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="stack">
          <h2 className="admin-section-title">Top UTMs</h2>
          {utmRows.length === 0 ? (
            <p className="m-0 text-[var(--muted)] text-[var(--text-sm)]">Sem fontes UTM ainda.</p>
          ) : (
            <ul className="m-0 p-0 list-none stack-sm">
              {utmRows.map((row) => (
                <li
                  key={row.utmSource ?? "none"}
                  className="cluster justify-between text-[var(--text-sm)]"
                >
                  <span>{row.utmSource || "(vazio)"}</span>
                  <Badge>{row._count.utmSource}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
