"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricGrid, MetricTile } from "@/components/ui";
import { ChannelDisconnected } from "@/components/clientes/ChannelDisconnected";
import { orderStatusLabel } from "@/lib/commerce-attribution/order-status";

type OlistResponse = {
  connected: boolean;
  label?: string | null;
  kpis: {
    orders: number;
    gmvCents: number;
    matchedWoo: number;
    matchedMl?: number;
    erpOnly?: number;
    matchRate: number;
    avgTicketCents: number;
    totalListed?: number;
  };
  byStatus: Array<{ status: string; orders: number; gmvCents: number }>;
  orders: Array<{
    id: string;
    externalId: string;
    status: string | null;
    totalCents: number | null;
    buyerName: string | null;
    occurredAt: string | null;
    wooExternalId: string | null;
    mlExternalId?: string | null;
    matchedProvider?: string | null;
    numeroEcommerce: string | null;
    trackingCode: string | null;
    leadId: string | null;
  }>;
  dualCustomers: Array<{
    contactId: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusText(status: string | null | undefined) {
  if (!status || status === "unknown") return "Sem status";
  return orderStatusLabel(status) ?? status;
}

export function OlistPanel({
  clienteId,
  dateRange,
  canConfigure = false,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  canConfigure?: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["olist-erp", clienteId, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
      });
      const res = await fetch(`/api/clientes/${clienteId}/olist?${params}`);
      if (!res.ok) throw new Error("Falha ao carregar Olist");
      return res.json() as Promise<OlistResponse>;
    },
    enabled: !!clienteId,
  });

  if (isLoading) {
    return (
      <div className="rel-card p-8 text-center type-fine-print text-[var(--muted-foreground)]">
        Carregando Olist ERP…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rel-card p-8 text-center type-fine-print text-negative">
        Não foi possível carregar os dados da Olist.
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <ChannelDisconnected
        title="Olist ERP não conectado"
        description="Conecte o Token API da Olist para cruzar pedidos do ERP com a loja e o CRM."
        actionHref={canConfigure ? `/config/conexoes?workspaceId=${clienteId}` : null}
        actionLabel="Conectar Olist"
      />
    );
  }

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Pedidos (receita)" value={data.kpis.orders.toLocaleString("pt-BR")} />
        <MetricTile label="GMV" value={formatBrl(data.kpis.gmvCents)} />
        <MetricTile label="Ticket médio" value={formatBrl(data.kpis.avgTicketCents)} />
        <MetricTile
          label="Casados (Woo + ML)"
          value={`${data.kpis.matchedWoo + (data.kpis.matchedMl ?? 0)}`}
          detail={`${data.kpis.matchRate}% · Woo ${data.kpis.matchedWoo} · ML ${data.kpis.matchedMl ?? 0}${
            data.kpis.erpOnly != null ? ` · só ERP ${data.kpis.erpOnly}` : ""
          }`}
        />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rel-card overflow-hidden !p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">Funil no ERP</p>
          </div>
          {data.byStatus.length === 0 ? (
            <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
              Sem pedidos no período.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.byStatus.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="type-caption text-[var(--foreground)]">{statusText(row.status)}</p>
                    <p className="type-fine-print text-[var(--muted-foreground)]">
                      {row.orders} pedido{row.orders === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="tabular-nums type-caption-strong text-[var(--foreground)]">
                    {formatBrl(row.gmvCents)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rel-card overflow-hidden !p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">
              Clientes nos dois sistemas
            </p>
          </div>
          {data.dualCustomers.length === 0 ? (
            <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
              Nenhum cruzamento Woo ↔ Olist no período.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.dualCustomers.map((c) => (
                <li key={c.contactId} className="px-4 py-3">
                  <p className="type-caption text-[var(--foreground)]">{c.name}</p>
                  <p className="type-fine-print text-[var(--muted-foreground)]">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rel-card overflow-hidden !p-0">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">Pedidos Olist</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-[var(--border)] type-fine-print text-[var(--muted-foreground)]">
                <th className="px-4 py-2 font-medium">Pedido</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Origem</th>
                <th className="px-4 py-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                    Sem pedidos no período.
                  </td>
                </tr>
              ) : (
                data.orders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--divider-soft)]">
                    <td className="px-4 py-3 type-caption text-[var(--foreground)]">
                      #{order.externalId}
                      {order.occurredAt ? (
                        <span className="block type-fine-print text-[var(--muted-foreground)]">
                          {new Date(order.occurredAt).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 type-caption text-[var(--foreground)]">
                      {order.buyerName || "—"}
                    </td>
                    <td className="px-4 py-3 type-fine-print text-[var(--muted-foreground)]">
                      {statusText(order.status)}
                    </td>
                    <td className="px-4 py-3 type-fine-print text-[var(--muted-foreground)]">
                      {order.matchedProvider === "MERCADO_LIVRE" || order.mlExternalId
                        ? `ML #${order.mlExternalId || order.numeroEcommerce || "—"}`
                        : order.wooExternalId || order.numeroEcommerce
                          ? `Woo #${order.wooExternalId || order.numeroEcommerce}`
                          : "só ERP"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums type-caption-strong text-[var(--foreground)]">
                      {formatBrl(order.totalCents ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
