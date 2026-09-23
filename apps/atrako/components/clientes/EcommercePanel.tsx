"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";

type EcommerceResponse = {
  provider: string;
  connected: boolean;
  available: boolean;
  storeLabel: string | null;
  kpis: {
    orders: number;
    gmvCents: number;
    avgTicketCents: number;
    withPhonePct: number;
  };
  orders: Array<{
    id: string;
    externalId: string;
    status: string | null;
    totalCents: number | null;
    currency: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    buyerPhone: string | null;
    contactId: string | null;
    leadId: string | null;
    occurredAt: string | null;
  }>;
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function EcommercePanel({
  clienteId,
  dateRange,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ecommerce", clienteId, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: "WOOCOMMERCE",
        from: dateRange.from,
        to: dateRange.to,
      });
      const res = await fetch(`/api/clientes/${clienteId}/ecommerce?${params}`);
      if (!res.ok) throw new Error("Falha ao carregar e-commerce");
      return res.json() as Promise<EcommerceResponse>;
    },
    enabled: !!clienteId,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center type-fine-print text-[var(--muted-foreground)]">
        Carregando pedidos…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center type-fine-print text-red-400">
        Não foi possível carregar os dados do e-commerce.
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <Store className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" strokeWidth={1.5} />
        <p className="mt-3 type-body text-[var(--foreground)]">Loja não conectada</p>
        <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
          Conecte o WooCommerce em Integrações para ver pedidos e GMV aqui.
        </p>
        <Link
          href={`/config/conexoes?workspaceId=${clienteId}`}
          className="mt-4 inline-flex rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-button-utility text-[var(--primary-foreground)] active:scale-95"
        >
          Conectar loja
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.storeLabel ? (
        <p className="type-fine-print text-[var(--muted-foreground)]">
          {data.storeLabel} · WooCommerce
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pedidos", value: String(data.kpis.orders) },
          { label: "GMV", value: formatBrl(data.kpis.gmvCents) },
          { label: "Ticket médio", value: formatBrl(data.kpis.avgTicketCents) },
          { label: "Com telefone", value: `${data.kpis.withPhonePct}%` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Pedidos recentes
          </p>
        </div>
        {data.orders.length === 0 ? (
          <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
            Nenhum pedido no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  <th className="px-4 py-3 font-semibold">Pedido</th>
                  <th className="px-4 py-3 font-semibold">Comprador</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--border)]/60">
                    <td className="px-4 py-3 tabular-nums text-[var(--foreground)]">
                      #{order.externalId}
                      {order.leadId ? (
                        <Link
                          href="/crm"
                          className="ml-2 text-[var(--primary)] hover:underline"
                        >
                          Lead
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--foreground)]">
                        {order.buyerName || "—"}
                      </div>
                      <div className="type-fine-print text-[var(--muted-foreground)]">
                        {order.buyerPhone || order.buyerEmail || "Sem contato"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {order.status || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--foreground)]">
                      {order.totalCents != null ? formatBrl(order.totalCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {order.occurredAt
                        ? new Date(order.occurredAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
