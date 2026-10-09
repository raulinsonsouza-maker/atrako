"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricGrid, MetricTile, SectionCard, SegmentedControl } from "@/components/ui";
import { ChannelDisconnected } from "@/components/clientes/ChannelDisconnected";
import { orderStatusLabel } from "@/lib/commerce-attribution/order-status";
import { bucketYmd, diasEntre, rotuloEixo, rotuloTooltip } from "@/lib/chart-bucket";

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
    excludedOrders: number;
    excludedCents: number;
    products?: number;
  };
  series: Array<{ date: string; orders: number; gmvCents: number }>;
  byStatus: Array<{ status: string; orders: number; gmvCents: number }>;
  byStore: Array<{ provider: string; orders: number; gmvCents: number }>;
  topProducts: Array<{
    key: string;
    title: string;
    sku: string | null;
    quantity: number;
    revenueCents: number;
    orders: number;
  }>;
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

function statusText(status: string | null | undefined) {
  if (!status || status === "unknown") return "Sem status";
  return orderStatusLabel(status) ?? status;
}

function plainText(value: string) {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function ecommerceSerie(series: Array<{ date: string; orders: number; gmvCents: number }>) {
  const ordered = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0]?.date ?? "";
  const last = ordered[ordered.length - 1]?.date ?? "";
  const mensal = ordered.length > 1 && diasEntre(first, last) > 180;
  if (!mensal) {
    return {
      mensal: false,
      rows: ordered.map((row) => ({
        ...row,
        periodo: rotuloEixo(row.date, "dia", false),
        rotulo: rotuloTooltip(row.date, "dia"),
      })),
    };
  }
  const buckets = new Map<string, { orders: number; gmvCents: number }>();
  for (const row of ordered) {
    const key = bucketYmd(row.date, "mes");
    const current = buckets.get(key) ?? { orders: 0, gmvCents: 0 };
    current.orders += row.orders;
    current.gmvCents += row.gmvCents;
    buckets.set(key, current);
  }
  const years = new Set([...buckets.keys()].map((key) => key.slice(0, 4)));
  const multiYear = years.size > 1;
  return {
    mensal: true,
    rows: [...buckets.entries()].map(([key, row]) => ({
      date: key,
      ...row,
      periodo: rotuloEixo(key, "mes", multiYear),
      rotulo: rotuloTooltip(key, "mes"),
    })),
  };
}

function EcommerceSerie({ series }: { series: Array<{ date: string; orders: number; gmvCents: number }> }) {
  const grafico = ecommerceSerie(series);
  return (
    <SectionCard title={grafico.mensal ? "Evolução mensal de vendas" : "Evolução diária de vendas"}>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={grafico.rows}>
            <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
            <XAxis dataKey="periodo" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
            <YAxis yAxisId="money" tickFormatter={(v) => `R$${Math.round(Number(v) / 100)}`} fontSize={11} />
            <YAxis yAxisId="orders" orientation="right" allowDecimals={false} fontSize={11} />
            <Tooltip
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.rotulo ?? _label}
              formatter={(value, name) => (name === "Pedidos" ? [value, name] : [formatBrl(Number(value)), name])}
            />
            <Area yAxisId="money" type="monotone" dataKey="gmvCents" name="GMV" fill="var(--primary)" stroke="var(--primary)" fillOpacity={0.16} />
            <Bar yAxisId="orders" dataKey="orders" name="Pedidos" fill="var(--chart-spend)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
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
  canConfigure = false,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  /** Dono ou admin do workspace: pode abrir o conector. */
  canConfigure?: boolean;
}) {
  const [provider, setProvider] = useState("ALL");

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

  if (isLoading) {
    return (
      <div className="rel-card p-8 text-center type-fine-print text-[var(--muted-foreground)]">
        Carregando pedidos…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rel-card p-8 text-center type-fine-print text-negative">
        Não foi possível carregar os dados do e-commerce.
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <ChannelDisconnected
        title="Loja não conectada"
        description="Conecte Shopify, Tray, Nuvemshop ou WooCommerce para ver pedidos e GMV aqui."
        actionHref={canConfigure ? `/config/conexoes?workspaceId=${clienteId}` : null}
        actionLabel="Conectar loja"
      />
    );
  }

  const connectedKeys = (["SHOPIFY", "TRAY", "NUVEMSHOP", "WOOCOMMERCE"] as const).filter(
    (key) => data.providers?.[key]?.connected,
  );
  const storeOptions = [
    ...(connectedKeys.length > 1 ? [{ value: "ALL", label: "Todas" }] : []),
    ...connectedKeys.map((key) => ({ value: key, label: providerLabel(key) })),
  ];
  const selected = storeOptions.some((opt) => opt.value === provider)
    ? provider
    : storeOptions[0]?.value ?? "ALL";

  return (
    <div className="space-y-4">
      {storeOptions.length > 0 ? (
        <SegmentedControl
          aria-label="Loja"
          value={selected}
          onChange={setProvider}
          options={storeOptions}
        />
      ) : null}

      <MetricGrid>
        <MetricTile label="Pedidos" value={data.kpis.orders.toLocaleString("pt-BR")} />
        <MetricTile label="GMV" value={formatBrl(data.kpis.gmvCents)} />
        <MetricTile label="Ticket médio" value={formatBrl(data.kpis.avgTicketCents)} />
        <MetricTile
          label="Fora da receita"
          value={data.kpis.excludedOrders.toLocaleString("pt-BR")}
          detail={formatBrl(data.kpis.excludedCents)}
        />
      </MetricGrid>

      {data.series.length > 0 ? <EcommerceSerie series={data.series} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rel-card overflow-hidden !p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">Status dos pedidos</p>
          </div>
          {data.byStatus.length === 0 ? (
            <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
              Sem pedidos no período.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {Object.values(
                data.byStatus.reduce<Record<string, { label: string; orders: number; gmvCents: number }>>((acc, row) => {
                  const label = statusText(row.status);
                  const current = acc[label] ?? { label, orders: 0, gmvCents: 0 };
                  current.orders += row.orders;
                  current.gmvCents += row.gmvCents;
                  acc[label] = current;
                  return acc;
                }, {}),
              )
                .sort((a, b) => b.gmvCents - a.gmvCents || b.orders - a.orders)
                .map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="type-caption text-[var(--foreground)]">{row.label}</p>
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
            <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">Produtos mais vendidos</p>
            {data.catalogCount ? (
              <p className="type-fine-print text-[var(--muted-foreground)]">
                {data.catalogCount.toLocaleString("pt-BR")} no catálogo
              </p>
            ) : null}
          </div>
          {data.topProducts.length === 0 ? (
            <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
              Ainda sem itens no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[420px] w-full type-caption">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
                    <th className="px-4 py-3 type-caption-strong">Produto</th>
                    <th className="px-4 py-3 text-right type-caption-strong">Unid.</th>
                    <th className="px-4 py-3 text-right type-caption-strong">Pedidos</th>
                    <th className="px-4 py-3 text-right type-caption-strong">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((item) => (
                    <tr key={item.key} className="border-b border-border/60">
                      <td className="px-4 py-3">
                        <div className="line-clamp-2 text-[var(--foreground)]">{plainText(item.title)}</div>
                        {item.sku ? (
                          <div className="type-fine-print text-[var(--muted-foreground)]">{item.sku}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums type-caption-strong">{item.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--muted-foreground)]">{item.orders}</td>
                      <td className="px-4 py-3 text-right tabular-nums type-caption-strong">{formatBrl(item.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {data.byStore.length > 1 ? (
        <div className="rel-card overflow-hidden !p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">Por loja</p>
          </div>
          <ul className="divide-y divide-border/60">
            {data.byStore.map((row) => (
              <li key={row.provider} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="type-caption text-[var(--foreground)]">{providerLabel(row.provider)}</p>
                  <p className="type-fine-print text-[var(--muted-foreground)]">
                    {row.orders} pedido{row.orders === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="tabular-nums type-caption-strong text-[var(--foreground)]">{formatBrl(row.gmvCents)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rel-card overflow-hidden !p-0">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="type-micro-legal uppercase text-[var(--muted-foreground)]">Últimos pedidos</p>
          <p className="type-fine-print text-[var(--muted-foreground)]">Amostra dos 10 mais recentes no período.</p>
        </div>
        {data.orders.length === 0 ? (
          <p className="px-4 py-8 text-center type-fine-print text-[var(--muted-foreground)]">
            Nenhum pedido no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full type-caption">
              <thead>
                <tr className="border-b border-[var(--border)] text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
                  <th className="px-4 py-3 type-caption-strong">Pedido</th>
                  <th className="px-4 py-3 type-caption-strong">Loja</th>
                  <th className="px-4 py-3 type-caption-strong">Comprador</th>
                  <th className="px-4 py-3 type-caption-strong">Status</th>
                  <th className="px-4 py-3 text-right type-caption-strong">Valor</th>
                  <th className="px-4 py-3 type-caption-strong">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/60">
                    <td className="px-4 py-3 tabular-nums text-[var(--foreground)]">
                      #{order.externalId}
                      {order.leadId ? (
                        <Link href="/crm" className="ml-2 text-[var(--primary)] hover:underline">
                          Lead
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{providerLabel(order.provider)}</td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--foreground)]">{order.buyerName || "—"}</div>
                      <div className="type-fine-print text-[var(--muted-foreground)]">
                        {order.buyerPhone || order.buyerEmail || "Sem contato"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{statusText(order.status)}</td>
                    <td className="px-4 py-3 text-right tabular-nums type-caption-strong text-[var(--foreground)]">
                      {order.totalCents != null ? formatBrl(order.totalCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {order.occurredAt ? new Date(order.occurredAt).toLocaleDateString("pt-BR") : "—"}
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
