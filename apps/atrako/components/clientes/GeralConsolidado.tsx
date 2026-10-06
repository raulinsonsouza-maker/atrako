"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { CartRecoveryMetrics, RepurchaseMetrics } from "@/lib/commerce/customer-metrics";

type Consolidado = {
  clientes?: RepurchaseMetrics | null;
  recuperacao?: CartRecoveryMetrics | null;
  /** "anuncios" quando não há loja e as vendas vêm das compras atribuídas pelos anúncios. */
  fonteVendas?: "lojas" | "anuncios";
  ecommerce?: boolean;
  totais: {
    receita: number;
    pedidos: number;
    ticketMedio: number;
    investimento: number;
    roas: number | null;
    leadsCrm: number;
    leadsMidia: number;
    roasSemRelacionamento?: number | null;
  };
  relacionamento?: {
    receitaAtribuida: number;
    pedidosAtribuidos: number;
    receitaInfluenciada: number;
    pedidosInfluenciados: number;
    custoWhatsApp: number;
    participacao: number | null;
  };
  canaisVenda: Array<{ id: string; label: string; pedidos: number; receitaCents: number }>;
  canaisMidia: Array<{
    id: string;
    label: string;
    investimento: number;
    leads: number;
    compras: number;
    receitaAtribuida: number;
  }>;
  cancelados?: number;
  /** Receita por origem do pedido (anúncio, orgânico, direto, marketplace…). */
  origens?: Array<{ id: string; label: string; pedidos: number; receitaCents: number }>;
  meta?: {
    investimento: number;
    comprasReportadas: number;
    valorReportado: number;
    identificadas: number;
    pedidos: number;
    receita: number;
    roas: number | null;
  } | null;
};

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const roasText = (roas: number | null | undefined) => (roas != null ? `${roas.toLocaleString("pt-BR")}x` : "—");

/** Geral de loja: resultado real da loja + de onde vieram as vendas (atribuição cruzada). */
function EcommerceGeral({ data }: { data: Consolidado }) {
  const { totais, canaisMidia, canaisVenda } = data;
  const origens = data.origens ?? [];
  const meta = data.meta;
  const totalCents = origens.reduce((s, o) => s + o.receitaCents, 0);
  const semOrigem = origens.find((o) => o.id === "unknown");
  const midiaLabel = canaisMidia.map((c) => c.label).join(" + ");

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Receita"
          value={brl(totais.receita)}
          hint={`${totais.pedidos.toLocaleString("pt-BR")} pedidos pagos`}
        />
        <Kpi label="Investimento" value={brl(totais.investimento)} hint={midiaLabel || undefined} />
        <Kpi label="Retorno geral" value={roasText(totais.roas)} tone={roasTone(totais.roas)} />
        <Kpi
          label="Custo por pedido"
          value={totais.pedidos > 0 && totais.investimento > 0 ? brl(totais.investimento / totais.pedidos) : "—"}
          hint={totais.pedidos > 0 ? `ticket ${brl(totais.ticketMedio)}` : undefined}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-caption-strong text-[var(--foreground)]">De onde vieram as vendas</p>
          {canaisVenda.length > 1 ? (
            <p className="type-fine-print text-[var(--muted-foreground)]">
              {canaisVenda.map((c) => `${c.label} ${brl(c.receitaCents / 100)}`).join(" · ")}
            </p>
          ) : null}
        </div>

        {origens.length === 0 ? (
          <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">Nenhuma venda no período.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {origens.map((o) => {
              const share = pct(o.receitaCents, totalCents);
              const muted = o.id === "unknown";
              return (
                <li key={o.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                  <span className={`truncate type-caption ${muted ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}>
                    {o.label}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--divider-soft)]">
                    <div
                      className={`h-full rounded-full ${o.id === "meta_ads" ? "bg-[var(--primary)]" : muted ? "bg-[var(--border)]" : "bg-muted-foreground/40"}`}
                      style={{ width: `${Math.max(2, share)}%` }}
                    />
                  </div>
                  <span className="type-caption tabular-nums text-[var(--foreground)]">
                    {brl(o.receitaCents / 100)}
                    <span className="ml-2 inline-block w-16 text-right text-[var(--muted-foreground)]">
                      {o.pedidos} · {share}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {meta ? (
          <div className="mt-5 grid gap-4 border-t border-[var(--divider-soft)] pt-4 sm:grid-cols-3">
            <div>
              <p className="type-fine-print text-[var(--muted-foreground)]">Compras no Meta</p>
              <p className="mt-1 type-body-strong tabular-nums text-[var(--foreground)]">
                {meta.comprasReportadas} · {brl(meta.valorReportado)}
              </p>
            </div>
            <div>
              <p className="type-fine-print text-[var(--muted-foreground)]">Confirmadas na loja</p>
              <p className="mt-1 type-body-strong tabular-nums text-[var(--foreground)]">
                {meta.pedidos} · {brl(meta.receita)}
              </p>
            </div>
            <div>
              <p className="type-fine-print text-[var(--muted-foreground)]">Retorno do Meta</p>
              <p className={`mt-1 type-body-strong tabular-nums ${meta.roas != null && meta.roas >= 1 ? "text-positive" : meta.roas != null && meta.roas > 0 ? "text-negative" : "text-[var(--foreground)]"}`}>
                {roasText(meta.roas)}
              </p>
            </div>
          </div>
        ) : null}

        {semOrigem && semOrigem.pedidos === totais.pedidos ? (
          <p className="mt-4 type-fine-print text-[var(--muted-foreground)]">
            A origem dos pedidos é calculada na próxima sincronização.
          </p>
        ) : null}
      </div>

      {data.clientes || data.recuperacao ? (
        <ClientesERecuperacao clientes={data.clientes ?? null} recuperacao={data.recuperacao ?? null} />
      ) : null}
    </section>
  );
}

const centsBrl = (cents: number) => brl(cents / 100);
const pctText = (ratio: number | null | undefined) =>
  ratio != null ? `${Math.round(ratio * 100)}%` : "—";
const num = (n: number) => n.toLocaleString("pt-BR");

function ClientesERecuperacao({
  clientes: c,
  recuperacao: r,
}: {
  clientes: RepurchaseMetrics | null;
  recuperacao: CartRecoveryMetrics | null;
}) {
  const ageLine = r?.byAge.filter((b) => b.count > 0) ?? [];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="type-caption-strong text-[var(--foreground)]">Clientes e recuperação</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {c ? (
          <>
            <Kpi
              label="Receita de quem voltou"
              value={centsBrl(c.repeatOrders.cents)}
              hint={`${num(c.repeatOrders.count)} pedidos · ${pctText(c.repeatShare)} da receita`}
            />
            <Kpi
              label="Clientes novos"
              value={num(c.newBuyers)}
              hint={`primeira compra · ${centsBrl(c.firstOrders.cents)}`}
            />
            <Kpi
              label="Compradores recorrentes"
              value={num(c.returningBuyers)}
              hint={`${pctText(c.returningShare)} dos compradores${
                c.avgGapDays != null ? ` · voltam em ~${num(c.avgGapDays)} dias` : ""
              }`}
            />
          </>
        ) : null}
        {r ? (
          <Kpi
            label="Carrinho recuperado"
            value={centsBrl(r.recovered.cents)}
            hint={`${num(r.recovered.count)} pagos no período · ${num(r.cohortRecovered)} dos ${num(r.abandoned.count)} abandonados no período`}
          />
        ) : null}
      </div>

      {r && r.recovered.count > 0 ? (
        <div className="mt-4 space-y-1 border-t border-[var(--divider-soft)] pt-4">
          <p className="type-fine-print text-[var(--muted-foreground)]">
            Pela mensagem <span className="tabular-nums text-[var(--foreground)]">{centsBrl(r.byMessage.cents)}</span>
            {" · "}voltaram sozinhos <span className="tabular-nums text-[var(--foreground)]">{centsBrl(r.alone.cents)}</span>
          </p>
          <p className="type-fine-print text-[var(--muted-foreground)]">
            De clientes <span className="tabular-nums text-[var(--foreground)]">{centsBrl(r.fromCustomers.cents)}</span>
            {" · "}de novos <span className="tabular-nums text-[var(--foreground)]">{centsBrl(r.fromNew.cents)}</span>
          </p>
          {ageLine.length ? (
            <p className="type-fine-print text-[var(--muted-foreground)]">
              Pagou{" "}
              {ageLine.map((b, i) => (
                <span key={b.key}>
                  {i > 0 ? " · " : ""}
                  {b.label} <span className="tabular-nums text-[var(--foreground)]">{centsBrl(b.cents)}</span>
                </span>
              ))}{" "}
              depois do abandono
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 type-fine-print text-[var(--muted-foreground)]">
        Recompra conta a partir do histórico importado da loja
        {c && c.unidentified.count > 0
          ? ` · ${num(c.unidentified.count)} pedidos sem contato identificado ficam fora`
          : ""}
        .
      </p>
    </div>
  );
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function roasTone(roas: number | null | undefined): "positive" | "negative" | undefined {
  if (roas == null || roas <= 0) return undefined;
  return roas >= 1 ? "positive" : "negative";
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
}) {
  const valueColor =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-[var(--foreground)]";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className={`mt-2 type-tagline tabular-nums ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

export function GeralConsolidado({
  clienteId,
  query,
}: {
  clienteId: string;
  /** Mesmos params de período do resumo (periodo, dataInicio, dataFim). */
  query: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-consolidado", clienteId, query],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/consolidado?${query}`);
      if (!res.ok) throw new Error("Falha ao carregar visão geral");
      return (await res.json()) as Consolidado;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 type-caption text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Somando todos os canais…
      </div>
    );
  }

  if (data.ecommerce && data.fonteVendas !== "anuncios" && data.origens) return <EcommerceGeral data={data} />;

  const { totais, canaisVenda, canaisMidia, relacionamento: rel } = data;
  const vendasDosAnuncios = data.fonteVendas === "anuncios";
  const showRel = Boolean(rel && (rel.pedidosAtribuidos > 0 || rel.pedidosInfluenciados > 0 || rel.custoWhatsApp > 0));
  const maxReceita = Math.max(1, ...canaisVenda.map((c) => c.receitaCents));

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Receita"
          value={brl(totais.receita)}
          hint={vendasDosAnuncios ? "Compras pelos anúncios" : undefined}
        />
        <Kpi
          label="Pedidos"
          value={totais.pedidos.toLocaleString("pt-BR")}
          hint={`ticket ${brl(totais.ticketMedio)}`}
        />
        <Kpi
          label="Leads"
          value={totais.leadsCrm.toLocaleString("pt-BR")}
          hint={`${totais.leadsMidia.toLocaleString("pt-BR")} pelos anúncios`}
        />
        <Kpi label="Investimento" value={brl(totais.investimento)} />
        <Kpi
          label="ROAS geral"
          value={totais.roas != null ? `${totais.roas.toLocaleString("pt-BR")}x` : "—"}
          tone={roasTone(totais.roas)}
        />
        <Kpi
          label="Custo por pedido"
          value={
            totais.pedidos > 0 && totais.investimento > 0
              ? brl(totais.investimento / totais.pedidos)
              : "—"
          }
        />
      </div>

      {showRel && rel ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            label="Receita via relacionamento"
            value={brl(rel.receitaAtribuida)}
            hint={`${rel.pedidosAtribuidos.toLocaleString("pt-BR")} pedidos${
              rel.participacao != null ? ` · ${rel.participacao.toLocaleString("pt-BR")}% da receita` : ""
            }`}
          />
          <Kpi
            label="Influenciada por mensagem"
            value={brl(rel.receitaInfluenciada)}
            hint={`${rel.pedidosInfluenciados.toLocaleString("pt-BR")} pedidos`}
          />
          <Kpi
            label="ROAS só da mídia"
            value={totais.roasSemRelacionamento != null ? `${totais.roasSemRelacionamento.toLocaleString("pt-BR")}x` : "—"}
            tone={roasTone(totais.roasSemRelacionamento)}
          />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Vendas por canal
          </p>
          {canaisVenda.length === 0 ? (
            <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">
              Nenhuma venda no período.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {canaisVenda.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-caption-strong text-[var(--foreground)]">{c.label}</span>
                    <span className="type-caption tabular-nums text-[var(--foreground)]">
                      {brl(c.receitaCents / 100)}
                      <span className="ml-2 text-[var(--muted-foreground)]">
                        {c.pedidos.toLocaleString("pt-BR")} pedidos
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.max(2, (c.receitaCents / maxReceita) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Mídia por canal
          </p>
          {canaisMidia.length === 0 ? (
            <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">
              Nenhum investimento em anúncios no período.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {canaisMidia.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="type-caption-strong text-[var(--foreground)]">{c.label}</span>
                  <span className="type-caption tabular-nums text-[var(--foreground)]">
                    {brl(c.investimento)}
                    <span className="ml-2 text-[var(--muted-foreground)]">
                      {data.ecommerce
                        ? `${c.compras.toLocaleString("pt-BR")} compras · ${brl(c.receitaAtribuida)}`
                        : `${c.leads.toLocaleString("pt-BR")} leads`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
