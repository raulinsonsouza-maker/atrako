"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCcw, Store } from "lucide-react";
import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MarketplaceSub = "ml" | "shopee" | "magalu";

type MarketplaceResponse = {
  provider: string;
  connected: boolean;
  available: boolean;
  connection: {
    status: string;
    sellerConnected: boolean;
    lastSyncAt: string | null;
    lastWebhookAt: string | null;
    lastSyncError: string | null;
  };
  kpis: {
    orders: number;
    gmvCents: number;
    avgTicketCents: number;
    units: number;
    uniqueProducts: number;
    withPhonePct: number;
    recoverable: number;
    feesCents: number;
    shippingCostCents: number;
    netCents: number;
    marginPct: number;
  };
  seller: {
    nickname: string | null;
    reputationLevel: string | null;
    powerSellerStatus: string | null;
    transactionsTotal: number | null;
    ratingsPositive: number | null;
    ratingsNeutral: number | null;
    ratingsNegative: number | null;
    visitsLast30: number | null;
    capturedAt: string;
  } | null;
  byStatus: Array<{ status: string; orders: number; gmvCents: number }>;
  byShipping: Array<{ label: string; orders: number }>;
  series: Array<{ date: string; orders: number; gmvCents: number; netCents: number }>;
  topProducts: Array<{
    key: string;
    title: string;
    sku: string | null;
    externalItemId: string | null;
    quantity: number;
    revenueCents: number;
    orders: number;
  }>;
  orders: Array<{
    id: string;
    externalId: string;
    status: string | null;
    totalCents: number | null;
    saleFeeCents?: number | null;
    shippingCostCents?: number | null;
    netCents?: number | null;
    shippingLabel?: string;
    shippingStatus?: string | null;
    currency: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    buyerPhone: string | null;
    contactId: string | null;
    leadId: string | null;
    occurredAt: string | null;
    itemSummary?: string;
    items?: Array<{
      title: string;
      quantity: number;
      lineTotalCents: number;
    }>;
  }>;
};

const SUB_LABELS: Record<MarketplaceSub, string> = {
  ml: "Mercado Livre",
  shopee: "Shopee",
  magalu: "Magalu",
};

const PROVIDER_QUERY: Record<MarketplaceSub, string> = {
  ml: "MERCADO_LIVRE",
  shopee: "SHOPEE",
  magalu: "MAGALU",
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    paid: "Pago",
    confirmed: "Confirmado",
    payment_required: "Aguardando pagamento",
    payment_in_process: "Pagamento em processo",
    cancelled: "Cancelado",
    invalid: "Inválido",
    unknown: "Outros",
  };
  return map[status] ?? status;
}

export function MarketplacePanel({
  clienteId,
  dateRange,
  sub,
  onSubChange,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  sub: MarketplaceSub;
  onSubChange: (sub: MarketplaceSub) => void;
}) {
  const provider = PROVIDER_QUERY[sub];
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["marketplaces", clienteId, provider, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider,
        from: dateRange.from,
        to: dateRange.to,
      });
      const res = await fetch(`/api/clientes/${clienteId}/marketplaces?${params}`);
      if (!res.ok) throw new Error("Falha ao carregar marketplaces");
      return res.json() as Promise<MarketplaceResponse>;
    },
    enabled: !!clienteId && (sub === "ml" || sub === "shopee"),
  });

  async function syncMarketplace() {
    const endpoint = sub === "ml" ? "/api/atrako/mercadolivre/sync" : "/api/atrako/shopee/sync";
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: clienteId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível sincronizar.");
      await queryClient.invalidateQueries({ queryKey: ["marketplaces", clienteId] });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 self-start w-fit">
        {(["ml", "shopee", "magalu"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSubChange(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all sm:px-4 sm:py-2 ${
              sub === key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/20"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
            }`}
          >
            {SUB_LABELS[key]}
          </button>
        ))}
      </div>

      {data?.connected && (sub === "ml" || sub === "shopee") ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={syncMarketplace}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--border)] px-3 py-1.5 type-fine-print text-[var(--foreground)] disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Sincronizar {sub === "ml" ? "Mercado Livre" : "Shopee"}
          </button>
          {syncError ? <p role="alert" className="type-fine-print text-red-600">{syncError}</p> : null}
        </div>
      ) : null}

      {sub === "magalu" ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <Store className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          <p className="mt-3 type-body text-[var(--foreground)]">{SUB_LABELS[sub]}</p>
          <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
            Em breve — mesmo padrão do Mercado Livre.
          </p>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center type-fine-print text-[var(--muted-foreground)]">
          Carregando vendas do canal…
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center type-fine-print text-red-400">
          Não foi possível carregar os dados de {SUB_LABELS[sub]}.
        </div>
      ) : !data?.connected ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <Store className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          <p className="mt-3 type-body text-[var(--foreground)]">
            {SUB_LABELS[sub]} não conectado
          </p>
          <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
            Conecte a conta do vendedor para importar pedidos, produtos e leads.
          </p>
          <Link
            href={`/config/conexoes?workspaceId=${clienteId}`}
            className="mt-4 inline-flex rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-button-utility text-[var(--primary-foreground)] active:scale-95"
          >
            Conectar {SUB_LABELS[sub]}
          </Link>
        </div>
      ) : data.connection.status === "SYNCING" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center type-fine-print text-amber-900">
          Sincronizando o histórico do Mercado Livre. Os dados aparecerão após a conclusão.
        </div>
      ) : data.connection.lastSyncError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="type-body text-red-700">Falha na sincronização</p>
          <p className="mt-1 type-fine-print text-red-600">{data.connection.lastSyncError}</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 type-fine-print text-[var(--muted-foreground)]">
            Compradores deste canal são registrados no{" "}
            <Link href="/crm" className="text-[var(--primary)] hover:underline">
              CRM
            </Link>{" "}
            com origem <span className="text-[var(--foreground)]">{SUB_LABELS[sub]}</span>
            {data.kpis.recoverable > 0
              ? ` · ${data.kpis.recoverable} pedidos possuem contato disponibilizado pelo marketplace.`
              : "."}
          </div>

          {data.seller && sub === "ml" ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Vendedor Mercado Livre
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {data.seller.nickname || "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  Atualizado {data.connection.lastSyncAt
                    ? new Date(data.connection.lastSyncAt).toLocaleString("pt-BR")
                    : "ainda não sincronizado"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6 text-right sm:grid-cols-3">
                <div><p className="type-fine-print text-[var(--muted-foreground)]">Reputação</p><p className="font-semibold">{data.seller.reputationLevel || "—"}</p></div>
                <div><p className="type-fine-print text-[var(--muted-foreground)]">Mercado Líder</p><p className="font-semibold">{data.seller.powerSellerStatus || "—"}</p></div>
                <div><p className="type-fine-print text-[var(--muted-foreground)]">Visitas 30d</p><p className="font-semibold tabular-nums">{(data.seller.visitsLast30 ?? 0).toLocaleString("pt-BR")}</p></div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Pedidos", value: String(data.kpis.orders) },
              { label: "GMV", value: formatBrl(data.kpis.gmvCents) },
              { label: "Ticket médio", value: formatBrl(data.kpis.avgTicketCents) },
              { label: "Líquido estimado", value: formatBrl(data.kpis.netCents), hint: `${data.kpis.marginPct}% do GMV` },
              { label: "Taxas ML", value: formatBrl(data.kpis.feesCents) },
              { label: "Frete (custo)", value: formatBrl(data.kpis.shippingCostCents) },
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
                {"hint" in kpi && kpi.hint ? (
                  <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{kpi.hint}</p>
                ) : null}
              </div>
            ))}
          </div>

          {sub === "ml" && data.series.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Evolução diária de vendas
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} fontSize={11} />
                    <YAxis yAxisId="money" tickFormatter={(v) => `R$${Math.round(Number(v) / 100)}`} fontSize={11} />
                    <YAxis yAxisId="orders" orientation="right" allowDecimals={false} fontSize={11} />
                    <Tooltip formatter={(value, name) => name === "Pedidos" ? [value, name] : [formatBrl(Number(value)), name]} />
                    <Area yAxisId="money" type="monotone" dataKey="gmvCents" name="GMV" fill="var(--primary)" stroke="var(--primary)" fillOpacity={0.16} />
                    <Area yAxisId="money" type="monotone" dataKey="netCents" name="Líquido" fill="#10b981" stroke="#10b981" fillOpacity={0.08} />
                    <Bar yAxisId="orders" dataKey="orders" name="Pedidos" fill="#94a3b8" opacity={0.55} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Produtos mais vendidos
                </p>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                  Ainda sem itens no período. Novos pedidos passam a gravar produtos automaticamente.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[480px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        <th className="px-4 py-3 font-semibold">Produto</th>
                        <th className="px-4 py-3 font-semibold text-right">Unid.</th>
                        <th className="px-4 py-3 font-semibold text-right">Pedidos</th>
                        <th className="px-4 py-3 font-semibold text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.key} className="border-b border-[var(--border)]/60">
                          <td className="px-4 py-3">
                            <div className="text-[var(--foreground)] line-clamp-2">{p.title}</div>
                            <div className="type-fine-print text-[var(--muted-foreground)]">
                              {[p.sku, p.externalItemId].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {p.quantity}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--muted-foreground)]">
                            {p.orders}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {formatBrl(p.revenueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Status dos pedidos
                </p>
              </div>
              {data.byStatus.length === 0 ? (
                <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                  Sem pedidos no período.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]/60">
                  {data.byStatus.map((row) => (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-[var(--foreground)]">{statusLabel(row.status)}</p>
                        <p className="type-fine-print text-[var(--muted-foreground)]">
                          {row.orders} pedido{row.orders === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="tabular-nums text-sm font-semibold text-[var(--foreground)]">
                        {formatBrl(row.gmvCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Frete (Full / Flex / ME)
                </p>
              </div>
              {(data.byShipping?.length ?? 0) === 0 ? (
                <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                  Sem dados de envio ainda.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]/60">
                  {data.byShipping.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <p className="text-sm text-[var(--foreground)]">{row.label}</p>
                      <p className="tabular-nums text-sm font-semibold text-[var(--foreground)]">
                        {row.orders}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                <table className="min-w-[1100px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      <th className="px-4 py-3 font-semibold">Pedido</th>
                      <th className="px-4 py-3 font-semibold">Produtos</th>
                      <th className="px-4 py-3 font-semibold">Comprador</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Valor</th>
                      {sub === "ml" ? <th className="px-4 py-3 font-semibold text-right">Taxas</th> : null}
                      {sub === "ml" ? <th className="px-4 py-3 font-semibold text-right">Frete</th> : null}
                      {sub === "ml" ? <th className="px-4 py-3 font-semibold text-right">Líquido</th> : null}
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
                        <td className="px-4 py-3 max-w-[240px]">
                          <div className="line-clamp-2 text-[var(--foreground)]">
                            {order.itemSummary || "—"}
                          </div>
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
                          {statusLabel(order.status || "unknown")}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--foreground)]">
                          {order.totalCents != null ? formatBrl(order.totalCents) : "—"}
                        </td>
                        {sub === "ml" ? <td className="px-4 py-3 text-right tabular-nums">{formatBrl(order.saleFeeCents ?? 0)}</td> : null}
                        {sub === "ml" ? <td className="px-4 py-3 text-right tabular-nums">{formatBrl(order.shippingCostCents ?? 0)}</td> : null}
                        {sub === "ml" ? <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatBrl(order.netCents ?? 0)}</td> : null}
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
        </>
      )}
    </div>
  );
}

export type { MarketplaceSub };
