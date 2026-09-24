"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCcw, Store } from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";

type EcommerceResponse = {
  provider: string;
  connected: boolean;
  available: boolean;
  storeLabel: string | null;
  catalogCount?: number;
  providers?: {
    WOOCOMMERCE: { connected: boolean; label: string | null };
    SHOPIFY: { connected: boolean; label: string | null };
    TRAY: { connected: boolean; label: string | null };
    NUVEMSHOP: { connected: boolean; label: string | null };
  };
  kpis: {
    orders: number;
    gmvCents: number;
    avgTicketCents: number;
    withPhonePct: number;
    products?: number;
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
    provider?: string;
  }>;
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function providerLabel(p: string | undefined) {
  if (p === "SHOPIFY") return "Shopify";
  if (p === "TRAY") return "Tray";
  if (p === "NUVEMSHOP") return "Nuvemshop";
  if (p === "WOOCOMMERCE") return "WooCommerce";
  return p || "—";
}

export function EcommercePanel({
  clienteId,
  dateRange,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
}) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState("ALL");
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ecommerce", clienteId, provider, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider,
        from: dateRange.from,
        to: dateRange.to,
      });
      const res = await fetch(`/api/clientes/${clienteId}/ecommerce?${params}`);
      if (!res.ok) throw new Error("Falha ao carregar e-commerce");
      return res.json() as Promise<EcommerceResponse>;
    },
    enabled: !!clienteId,
  });

  async function syncShopify() {
    setSyncing(true);
    try {
      await fetch("/api/atrako/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: clienteId }),
      });
      await qc.invalidateQueries({ queryKey: ["ecommerce", clienteId] });
    } finally {
      setSyncing(false);
    }
  }

  async function syncTray() {
    setSyncing(true);
    try {
      await fetch("/api/atrako/tray/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: clienteId }),
      });
      await qc.invalidateQueries({ queryKey: ["ecommerce", clienteId] });
    } finally {
      setSyncing(false);
    }
  }

  async function syncNuvemshop() {
    setSyncing(true);
    try {
      await fetch("/api/atrako/nuvemshop/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: clienteId }),
      });
      await qc.invalidateQueries({ queryKey: ["ecommerce", clienteId] });
    } finally {
      setSyncing(false);
    }
  }

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
          Conecte Shopify, Tray, Nuvemshop ou WooCommerce em Integrações para ver pedidos e GMV
          aqui.
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
      <div className="flex flex-wrap items-center gap-3">
        <PillSelect
          size="toolbar"
          value={provider}
          onChange={setProvider}
          options={[
            { value: "ALL", label: "Todas as lojas" },
            { value: "SHOPIFY", label: "Shopify" },
            { value: "TRAY", label: "Tray" },
            { value: "NUVEMSHOP", label: "Nuvemshop" },
            { value: "WOOCOMMERCE", label: "WooCommerce" },
          ]}
          aria-label="Provedor e-commerce"
        />
        {data.storeLabel ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">{data.storeLabel}</p>
        ) : null}
        {data.providers?.SHOPIFY?.connected ? (
          <button
            type="button"
            onClick={() => syncShopify()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--border)] px-3 py-1.5 type-fine-print text-[var(--foreground)] active:scale-95 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Sincronizar Shopify
          </button>
        ) : null}
        {data.providers?.TRAY?.connected ? (
          <button
            type="button"
            onClick={() => syncTray()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--border)] px-3 py-1.5 type-fine-print text-[var(--foreground)] active:scale-95 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Sincronizar Tray
          </button>
        ) : null}
        {data.providers?.NUVEMSHOP?.connected ? (
          <button
            type="button"
            onClick={() => syncNuvemshop()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--border)] px-3 py-1.5 type-fine-print text-[var(--foreground)] active:scale-95 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Sincronizar Nuvemshop
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Pedidos", value: String(data.kpis.orders) },
          { label: "GMV", value: formatBrl(data.kpis.gmvCents) },
          { label: "Ticket médio", value: formatBrl(data.kpis.avgTicketCents) },
          { label: "Com telefone", value: `${data.kpis.withPhonePct}%` },
          {
            label: "Produtos",
            value: String(data.kpis.products ?? data.catalogCount ?? 0),
          },
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
                  <th className="px-4 py-3 font-semibold">Loja</th>
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
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {providerLabel(order.provider)}
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
