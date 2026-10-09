"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag } from "lucide-react";
import { describeOrderOrigin, type OrderSourceView } from "@/lib/commerce-attribution/describe";
import { MetricTile } from "@/components/ui";

type VendasMeta = {
  meta: { purchases: number; valueCents: number; clickPurchases: number; viewPurchases: number };
  identified: { orders: number; valueCents: number; countedByMeta: number; tracked: number; matched: number };
  semPar: number;
  byCampaign: Array<{
    campaignId: string;
    campaignName: string;
    metaPurchases: number;
    metaValueCents: number;
    orders: number;
    valueCents: number;
  }>;
  orders: Array<{
    id: string;
    externalId: string;
    leadId: string | null;
    buyerName: string | null;
    totalCents: number;
    status: string | null;
    occurredAt: string;
    items: string[];
    source: OrderSourceView | null;
  }>;
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <MetricTile label={label} value={value} detail={hint} />;
}

/** Quem comprou por qual anúncio: compras do Meta conciliadas com os pedidos da loja. */
export function MetaVendasIdentificadas({ clienteId, query }: { clienteId: string; query: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-vendas-meta", clienteId, query],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/vendas-meta?${query}`);
      if (!res.ok) throw new Error("Falha ao carregar vendas do Meta");
      return (await res.json()) as VendasMeta;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rel-card p-5 type-caption text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Cruzando compras do Meta com os pedidos da loja…
      </div>
    );
  }
  if (!data.meta.purchases && !data.identified.orders) return null;

  const coverage = data.meta.purchases ? Math.round((data.identified.countedByMeta / data.meta.purchases) * 100) : null;

  return (
    <section className="space-y-4 rounded-[2rem] border border-[var(--border)] bg-[var(--canvas)] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--chart-current)] text-[var(--primary)]">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <h3 className="type-tagline text-[var(--foreground)]">Vendas do Meta na loja</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Compras no Meta" value={`${data.meta.purchases} · ${brl(data.meta.valueCents)}`} />
        <Kpi
          label="Encontradas na loja"
          value={`${data.identified.countedByMeta}${coverage != null ? ` · ${coverage}%` : ""}`}
        />
        <Kpi
          label="Receita na loja"
          value={brl(data.identified.valueCents)}
          hint={`${data.identified.orders} ${data.identified.orders === 1 ? "pedido" : "pedidos"}`}
        />
      </div>

      {data.byCampaign.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="type-fine-print uppercase text-[var(--muted-foreground)]">
                <th className="px-3 py-2 font-semibold">Campanha</th>
                <th className="px-3 py-2 text-right font-semibold">Compras no Meta</th>
                <th className="px-3 py-2 text-right font-semibold">Pedidos na loja</th>
                <th className="px-3 py-2 text-right font-semibold">Receita na loja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider-soft)]">
              {data.byCampaign.map((c) => (
                <tr key={c.campaignId || "sem-campanha"} className="type-caption">
                  <td className="px-3 py-2.5 text-[var(--foreground)]">{c.campaignName || "Campanha não identificada"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--muted-foreground)]">
                    {c.metaPurchases} · {brl(c.metaValueCents)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--foreground)]">{c.orders}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--primary)]">{brl(c.valueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data.orders.length ? (
        <ul className="divide-y divide-[var(--divider-soft)] rounded-2xl border border-[var(--border)]">
          {data.orders.map((o) => {
            const origin = describeOrderOrigin(o.source);
            return (
              <li key={o.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0 space-y-0.5">
                  <p className="type-caption-strong text-[var(--foreground)]">
                    {o.leadId ? (
                      <Link href={`/crm/leads/${o.leadId}`} className="hover:text-[var(--primary)]">
                        {o.buyerName ?? "Cliente"}
                      </Link>
                    ) : (
                      o.buyerName ?? "Cliente"
                    )}
                    <span className="font-normal text-[var(--muted-foreground)]">
                      {" "}
                      · Pedido #{o.externalId} · {new Date(o.occurredAt).toLocaleDateString("pt-BR")}
                    </span>
                  </p>
                  <p className="truncate type-fine-print text-[var(--muted-foreground)]">{o.items.join(", ") || "Itens não informados"}</p>
                  <p className="type-fine-print text-[var(--foreground)]">
                    {origin.title}
                    {origin.detail ? <span className="text-[var(--muted-foreground)]"> · {origin.detail}</span> : null}
                  </p>
                  {origin.lastVisit ? <p className="type-micro-legal text-[var(--muted-foreground)]">{origin.lastVisit}</p> : null}
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <p className="type-body-strong tabular-nums text-[var(--foreground)]">{brl(o.totalCents)}</p>
                  {origin.badge ? (
                    <span className="rel-badge type-micro-legal" data-tone={origin.badge.tone}>
                      {origin.badge.label}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
