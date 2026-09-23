import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { OrderActions } from "./OrderActions";

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      coupon: true,
      user: true,
    },
  });

  if (!order) notFound();

  return (
    <div className="stack-lg">
      <PageHeader
        title={`Pedido ${order.id.slice(0, 8)}…`}
        description={order.createdAt.toLocaleString("pt-BR")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="stack">
          <div className="cluster justify-between">
            <h2 className="m-0 text-[var(--text-lg)]">Resumo</h2>
            <Badge tone={order.status === "APPROVED" ? "success" : "default"}>
              {statusLabel[order.status] ?? order.status}
            </Badge>
          </div>
          <dl className="m-0 grid gap-2 text-[var(--text-sm)]">
            <div className="cluster justify-between">
              <dt className="text-[var(--muted)] m-0">E-mail</dt>
              <dd className="m-0">{order.email}</dd>
            </div>
            <div className="cluster justify-between">
              <dt className="text-[var(--muted)] m-0">Nome</dt>
              <dd className="m-0">{order.name ?? "—"}</dd>
            </div>
            <div className="cluster justify-between">
              <dt className="text-[var(--muted)] m-0">Subtotal</dt>
              <dd className="m-0">{formatBRL(order.subtotalCents)}</dd>
            </div>
            <div className="cluster justify-between">
              <dt className="text-[var(--muted)] m-0">Desconto</dt>
              <dd className="m-0">{formatBRL(order.discountCents)}</dd>
            </div>
            <div className="cluster justify-between">
              <dt className="text-[var(--muted)] m-0">Total</dt>
              <dd className="m-0 font-semibold">{formatBRL(order.totalCents)}</dd>
            </div>
            {order.coupon ? (
              <div className="cluster justify-between">
                <dt className="text-[var(--muted)] m-0">Cupom</dt>
                <dd className="m-0">{order.coupon.code}</dd>
              </div>
            ) : null}
            {order.mpOrderId ? (
              <div className="cluster justify-between">
                <dt className="text-[var(--muted)] m-0">MP Order</dt>
                <dd className="m-0 font-mono text-[var(--text-xs)]">{order.mpOrderId}</dd>
              </div>
            ) : null}
          </dl>
          <OrderActions orderId={order.id} canRefund={order.status === "APPROVED"} />
        </Panel>

        <Panel className="stack">
          <h2 className="m-0 text-[var(--text-lg)]">Itens</h2>
          <ul className="m-0 p-0 list-none stack-sm">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="cluster justify-between text-[var(--text-sm)] border-b border-[var(--border)] pb-2"
              >
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatBRL(item.priceCents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {(order.utmSource || order.utmCampaign) && (
            <div className="text-[var(--text-sm)] text-[var(--muted)]">
              UTM: {[order.utmSource, order.utmMedium, order.utmCampaign]
                .filter(Boolean)
                .join(" / ")}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
