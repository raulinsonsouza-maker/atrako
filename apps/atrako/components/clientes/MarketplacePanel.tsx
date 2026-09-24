"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";

type MarketplaceSub = "ml" | "shopee" | "magalu";

type MarketplaceResponse = {
  provider: string;
  connected: boolean;
  available: boolean;
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
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 type-fine-print text-[var(--muted-foreground)]">
            Compradores deste canal entram no{" "}
            <Link href="/crm" className="text-[var(--primary)] hover:underline">
              CRM
            </Link>{" "}
            com origem <span className="text-[var(--foreground)]">{SUB_LABELS[sub]}</span>
            {data.kpis.recoverable > 0
              ? ` — ${data.kpis.recoverable} com telefone elegíveis a WhatsApp/promoções.`
              : "."}
          </div>

          {data.seller ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Conta
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {data.seller.nickname || "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {data.seller.powerSellerStatus
                    ? `Mercado Líder: ${data.seller.powerSellerStatus}`
                    : "Reputação do vendedor"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Reputação
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                  {data.seller.reputationLevel || "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  +{Math.round((data.seller.ratingsPositive ?? 0) * 100)}% / −
                  {Math.round((data.seller.ratingsNegative ?? 0) * 100)}%
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Visitas (30d)
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                  {(data.seller.visitsLast30 ?? 0).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {data.seller.transactionsTotal != null
                    ? `${data.seller.transactionsTotal.toLocaleString("pt-BR")} vendas hist.`
                    : "Anúncios da conta"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Margem líquida*
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                  {formatBrl(data.kpis.netCents)}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {data.kpis.marginPct}% · GMV − taxas − frete
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Pedidos", value: String(data.kpis.orders) },
              { label: "GMV", value: formatBrl(data.kpis.gmvCents) },
              { label: "Ticket médio", value: formatBrl(data.kpis.avgTicketCents) },
              { label: "Taxas ML", value: formatBrl(data.kpis.feesCents) },
              { label: "Frete (custo)", value: formatBrl(data.kpis.shippingCostCents) },
              {
                label: "Recuperáveis WA",
                value: `${data.kpis.recoverable}`,
                hint: `${data.kpis.withPhonePct}% com telefone`,
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
                {"hint" in kpi && kpi.hint ? (
                  <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{kpi.hint}</p>
                ) : null}
              </div>
            ))}
          </div>

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
                <table className="min-w-[860px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      <th className="px-4 py-3 font-semibold">Pedido</th>
                      <th className="px-4 py-3 font-semibold">Produtos</th>
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
