"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { MetricGrid, MetricTile, SegmentedControl } from "@/components/ui";
import { ChannelDisconnected } from "@/components/clientes/ChannelDisconnected";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/useIsMobile";
import { bucketYmd, diasEntre, rotuloEixo, rotuloTooltip, type ChartAgrupamento } from "@/lib/chart-bucket";
import { mobileTickInterval } from "@/lib/chart-mobile";

type MarketplaceSub = "ml" | "shopee" | "tiktok" | "magalu";

const SYNCABLE_SUBS: MarketplaceSub[] = ["ml", "shopee", "tiktok"];

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
  tiktok: "TikTok Shop",
  magalu: "Magalu",
};

const PROVIDER_QUERY: Record<MarketplaceSub, string> = {
  ml: "MERCADO_LIVRE",
  shopee: "SHOPEE",
  tiktok: "TIKTOK_SHOP",
  magalu: "MAGALU",
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const REPUTATION_LABEL: Record<string, string> = {
  "5_green": "verde",
  "4_light_green": "verde-clara",
  "3_yellow": "amarela",
  "2_orange": "laranja",
  "1_red": "vermelha",
};

const POWER_SELLER_LABEL: Record<string, string> = {
  platinum: "Platinum",
  gold: "Ouro",
  silver: "Prata",
};

function sellerSummary(seller: NonNullable<MarketplaceResponse["seller"]>) {
  const parts: string[] = [];
  if (seller.nickname) parts.push(seller.nickname);
  const reputation = seller.reputationLevel ? REPUTATION_LABEL[seller.reputationLevel] : null;
  if (reputation) parts.push(`reputação ${reputation}`);
  const medal = seller.powerSellerStatus ? POWER_SELLER_LABEL[seller.powerSellerStatus] : null;
  if (medal) parts.push(`Mercado Líder ${medal}`);
  if (seller.visitsLast30 != null) {
    parts.push(`${seller.visitsLast30.toLocaleString("pt-BR")} visitas em 30 dias`);
  }
  return parts.join(" · ");
}

type SeriePoint = { date: string; orders: number; gmvCents: number; netCents: number };

/** Meses ou dias do período, inclusive os sem venda, para o eixo não pular buracos. */
function periodKeys(from: string, to: string, agrupamento: "dia" | "mes") {
  const start = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  if (agrupamento === "mes") {
    start.setUTCDate(1);
    end.setUTCDate(1);
  }
  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && keys.length < 400) {
    keys.push(cursor.toISOString().slice(0, 10));
    if (agrupamento === "mes") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function marketplaceRows(series: SeriePoint[], from: string, to: string) {
  const mensal = diasEntre(from, to) > 180;
  const agrupamento: ChartAgrupamento = mensal ? "mes" : "dia";
  const buckets = new Map<string, { orders: number; gmvCents: number; netCents: number }>();
  for (const row of series) {
    const key = bucketYmd(row.date, agrupamento);
    const current = buckets.get(key) ?? { orders: 0, gmvCents: 0, netCents: 0 };
    current.orders += row.orders;
    current.gmvCents += row.gmvCents;
    current.netCents += row.netCents;
    buckets.set(key, current);
  }
  const keys = periodKeys(from, to, agrupamento);
  const years = new Set(keys.map((key) => key.slice(0, 4)));
  const multiYear = years.size > 1;
  return {
    mensal,
    rows: keys.map((key) => {
      const row = buckets.get(key) ?? { orders: 0, gmvCents: 0, netCents: 0 };
      return {
        periodo: rotuloEixo(key, agrupamento, multiYear),
        rotulo: rotuloTooltip(key, agrupamento),
        receita: row.gmvCents / 100,
        pedidos: row.orders,
        liquido: row.netCents / 100,
      };
    }),
  };
}

const chartTooltip = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "none",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function MarketplaceSerie({
  series,
  from,
  to,
}: {
  series: SeriePoint[];
  from: string;
  to: string;
}) {
  const isMobile = useIsMobile();
  const grafico = marketplaceRows(series, from, to);
  if (!grafico.rows.some((row) => row.receita > 0 || row.pedidos > 0)) return null;
  const tickEvery = isMobile
    ? mobileTickInterval(grafico.rows.length)
    : grafico.rows.length > 12
      ? Math.ceil(grafico.rows.length / 12) - 1
      : 0;

  return (
    <div className="rel-card p-5">
      <p className="type-caption-strong text-[var(--foreground)]">
        {grafico.mensal ? "Vendas por mês" : "Vendas por dia"}
      </p>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={grafico.rows}>
            <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
            <XAxis
              dataKey="periodo"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted-foreground)"
              interval={tickEvery}
            />
            <YAxis
              fontSize={11}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted-foreground)"
              width={56}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v)))}
            />
            <Tooltip
              cursor={{ fill: "var(--divider-soft)" }}
              labelFormatter={(_label: string, payload: ReadonlyArray<{ payload?: { rotulo?: string } }>) =>
                payload[0]?.payload?.rotulo ?? _label
              }
              formatter={(value: number, _name: string, item: { payload?: { pedidos?: number; liquido?: number } }) => {
                const pedidos = item.payload?.pedidos ?? 0;
                const liquido = item.payload?.liquido;
                const depois =
                  liquido != null && Math.abs(liquido - Number(value)) >= 0.01
                    ? ` · líquido ${liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                    : "";
                return [
                  `${Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ${pedidos} pedidos${depois}`,
                  "Receita",
                ];
              }}
              {...chartTooltip}
            />
            <Bar dataKey="receita" name="Receita" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    paid: "Pago",
    confirmed: "Confirmado",
    payment_required: "Aguardando pagamento",
    payment_in_process: "Pagamento em processo",
    cancelled: "Cancelado",
    invalid: "Inválido",
    UNPAID: "Aguardando pagamento",
    ON_HOLD: "Em espera",
    AWAITING_SHIPMENT: "Aguardando envio",
    PARTIALLY_SHIPPING: "Envio parcial",
    AWAITING_COLLECTION: "Aguardando coleta",
    IN_TRANSIT: "Em trânsito",
    DELIVERED: "Entregue",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
    unknown: "Outros",
  };
  return map[status] ?? status;
}

export function MarketplacePanel({
  clienteId,
  dateRange,
  sub,
  onSubChange,
  canConfigure = false,
  availableSubs = null,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  sub: MarketplaceSub;
  onSubChange: (sub: MarketplaceSub) => void;
  /** Dono ou admin do workspace: pode abrir o conector. */
  canConfigure?: boolean;
  /** Operador: só os marketplaces já conectados. Null mantém todos. */
  availableSubs?: Array<"ml" | "shopee" | "tiktok"> | null;
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
    enabled: !!clienteId && SYNCABLE_SUBS.includes(sub),
  });

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="Marketplace"
        value={sub}
        onChange={onSubChange}
        options={(["ml", "shopee", "tiktok", "magalu"] as const)
          .filter((key) => {
            if (key === "magalu") return canConfigure;
            if (!availableSubs) return true;
            return availableSubs.includes(key);
          })
          .map((key) => ({
            value: key,
            label: SUB_LABELS[key],
          }))}
      />

      {sub === "magalu" ? (
        <div className="rel-card p-8 text-center">
          <Store className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          <p className="mt-3 type-body text-[var(--foreground)]">{SUB_LABELS[sub]}</p>
          <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
            Em breve — mesmo padrão do Mercado Livre.
          </p>
        </div>
      ) : isLoading ? (
        <div className="rel-card p-8 text-center type-fine-print text-[var(--muted-foreground)]">
          Carregando vendas do canal…
        </div>
      ) : isError ? (
        <div className="rel-card p-8 text-center type-fine-print text-negative">
          Não foi possível carregar os dados de {SUB_LABELS[sub]}.
        </div>
      ) : !data?.connected ? (
        <ChannelDisconnected
          title={`${SUB_LABELS[sub]} não conectado`}
          description="Conecte a conta do vendedor para importar pedidos, produtos e leads."
          actionHref={canConfigure ? `/config/conexoes?workspaceId=${clienteId}` : null}
          actionLabel={`Conectar ${SUB_LABELS[sub]}`}
        />
      ) : data.connection.status === "SYNCING" ? (
        <div className="rel-card p-8 text-center type-fine-print text-[var(--ink)]">
          Sincronizando o histórico de {SUB_LABELS[sub]}. Os pedidos aparecem ao terminar.
        </div>
      ) : data.connection.lastSyncError ? (
        <div className="rel-card p-6 text-center">
          <p className="type-body text-red-700">Falha na sincronização</p>
          <p className="mt-1 type-fine-print text-[var(--danger)]">{data.connection.lastSyncError}</p>
        </div>
      ) : (
        <>
          {data.seller && sub === "ml" && sellerSummary(data.seller) ? (
            <p className="type-fine-print text-[var(--muted-foreground)]">{sellerSummary(data.seller)}</p>
          ) : null}

          <MetricGrid>
            <MetricTile label="Pedidos" value={data.kpis.orders.toLocaleString("pt-BR")} />
            <MetricTile label="Receita" value={formatBrl(data.kpis.gmvCents)} />
            <MetricTile label="Ticket médio" value={formatBrl(data.kpis.avgTicketCents)} />
            <MetricTile
              label="Líquido"
              value={formatBrl(data.kpis.netCents)}
              detail={`taxas ${formatBrl(data.kpis.feesCents)} · frete ${formatBrl(data.kpis.shippingCostCents)}`}
            />
          </MetricGrid>

          {data.series.length > 0 ? (
            <MarketplaceSerie series={data.series} from={dateRange.from} to={dateRange.to} />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rel-card overflow-hidden !p-0">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">
                  Produtos mais vendidos
                </p>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                  Ainda sem itens no período. Novos pedidos passam a gravar produtos automaticamente.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[480px] w-full type-caption">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
                        <th className="px-4 py-3 font-semibold">Produto</th>
                        <th className="px-4 py-3 font-semibold text-right">Unid.</th>
                        <th className="px-4 py-3 font-semibold text-right">Pedidos</th>
                        <th className="px-4 py-3 font-semibold text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.key} className="border-b border-border/60">
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

            <div className="rel-card overflow-hidden !p-0">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">
                  Status dos pedidos
                </p>
              </div>
              {data.byStatus.length === 0 ? (
                <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                  Sem pedidos no período.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.byStatus.map((row) => (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="type-caption text-[var(--foreground)]">{statusLabel(row.status)}</p>
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
              {data.byShipping?.length ? (
                <div className="border-t border-[var(--divider-soft)] px-4 py-3">
                  <p className="type-fine-print text-[var(--muted-foreground)]">Envio</p>
                  <p className="mt-1 type-caption text-[var(--foreground)]">
                    {data.byShipping.map((row) => `${row.label} ${row.orders.toLocaleString("pt-BR")}`).join(" · ")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rel-card overflow-hidden !p-0">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">
                Pedidos recentes
              </p>
              <p className="type-fine-print text-[var(--muted-foreground)]">Últimos 10 do período.</p>
            </div>
            {data.orders.length === 0 ? (
              <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
                Nenhum pedido no período.
              </p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="min-w-[1100px] w-full type-caption">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[var(--border)] bg-[var(--canvas)] text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
                      <th className="px-4 py-3 type-caption-strong">Pedido</th>
                      <th className="px-4 py-3 type-caption-strong">Produtos</th>
                      <th className="px-4 py-3 type-caption-strong">Comprador</th>
                      <th className="px-4 py-3 type-caption-strong">Status</th>
                      <th className="px-4 py-3 text-right type-caption-strong">Valor</th>
                      {sub === "ml" ? <th className="px-4 py-3 text-right type-caption-strong">Taxas</th> : null}
                      {sub === "ml" ? <th className="px-4 py-3 text-right type-caption-strong">Frete</th> : null}
                      {sub === "ml" ? <th className="px-4 py-3 text-right type-caption-strong">Líquido</th> : null}
                      <th className="px-4 py-3 type-caption-strong">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.slice(0, 10).map((order) => (
                      <tr key={order.id} className="border-b border-border/60">
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
                        <td className="px-4 py-3 text-right tabular-nums type-caption-strong text-[var(--foreground)]">
                          {order.totalCents != null ? formatBrl(order.totalCents) : "—"}
                        </td>
                        {sub === "ml" ? <td className="px-4 py-3 text-right tabular-nums">{formatBrl(order.saleFeeCents ?? 0)}</td> : null}
                        {sub === "ml" ? <td className="px-4 py-3 text-right tabular-nums">{formatBrl(order.shippingCostCents ?? 0)}</td> : null}
                        {sub === "ml" ? <td className="px-4 py-3 text-right tabular-nums type-caption-strong">{formatBrl(order.netCents ?? 0)}</td> : null}
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
