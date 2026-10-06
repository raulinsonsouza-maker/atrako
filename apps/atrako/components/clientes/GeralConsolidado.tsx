"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CartRecoveryMetrics, RepurchaseMetrics } from "@/lib/commerce/customer-metrics";

type Consolidado = {
  clientes?: RepurchaseMetrics | null;
  recuperacao?: CartRecoveryMetrics | null;
  /** "anuncios" quando não há loja e as vendas vêm das compras atribuídas pelos anúncios. */
  fonteVendas?: "lojas" | "anuncios";
  ecommerce?: boolean;
  /** Origem filtrada (mesma chave de `origens[].id`); null = todas. */
  origem?: string | null;
  /** Canal de mídia cujo investimento conta para a origem filtrada (META, GOOGLE). */
  midiaDaOrigem?: string | null;
  serie?: Array<{ data: string; receitaCents: number; pedidos: number }>;
  serieAgrupamento?: "dia" | "semana";
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

const MEDIA_LABELS: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads" };

/** Geral de loja: resultado real da loja + de onde vieram as vendas (atribuição cruzada). */
function EcommerceGeral({
  data,
  origem,
  onOrigem,
  fetching,
}: {
  data: Consolidado;
  origem: string | null;
  onOrigem: (id: string | null) => void;
  fetching: boolean;
}) {
  const { totais, canaisMidia, canaisVenda } = data;
  const origens = data.origens ?? [];
  const meta = data.meta;
  const totalCents = origens.reduce((s, o) => s + o.receitaCents, 0);
  const totalPedidosOrigens = origens.reduce((s, o) => s + o.pedidos, 0);
  const semOrigem = origens.find((o) => o.id === "unknown");
  const origemLabel = origem ? origens.find((o) => o.id === origem)?.label ?? "Origem selecionada" : null;
  const midiaLabel = origem
    ? data.midiaDaOrigem
      ? MEDIA_LABELS[data.midiaDaOrigem] ?? data.midiaDaOrigem
      : null
    : canaisMidia.map((c) => c.label).join(" + ");
  const semMidia = Boolean(origem && !data.midiaDaOrigem);

  return (
    <section className={`space-y-4 transition-opacity ${fetching ? "opacity-60" : ""}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Receita"
          value={brl(totais.receita)}
          hint={`${totais.pedidos.toLocaleString("pt-BR")} pedidos pagos${origemLabel ? ` · ${origemLabel}` : ""}`}
        />
        <Kpi
          label="Investimento"
          value={semMidia ? "—" : brl(totais.investimento)}
          hint={semMidia ? "origem sem custo de mídia" : midiaLabel || undefined}
        />
        <Kpi
          label={origem ? "Retorno da origem" : "Retorno geral"}
          value={roasText(totais.roas)}
          tone={roasTone(totais.roas)}
        />
        <Kpi
          label="Custo por pedido"
          value={totais.pedidos > 0 && totais.investimento > 0 ? brl(totais.investimento / totais.pedidos) : "—"}
          hint={totais.pedidos > 0 ? `ticket ${brl(totais.ticketMedio)}` : undefined}
        />
      </div>

      <VendasSerie data={data} origemLabel={origemLabel} />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-caption-strong text-[var(--foreground)]">De onde vieram as vendas</p>
          {origem ? (
            <button
              type="button"
              onClick={() => onOrigem(null)}
              className="type-caption text-[var(--primary)] underline-offset-2 hover:underline"
            >
              Ver todas as origens
            </button>
          ) : canaisVenda.length > 1 ? (
            <p className="type-fine-print text-[var(--muted-foreground)]">
              {canaisVenda.map((c) => `${c.label} ${brl(c.receitaCents / 100)}`).join(" · ")}
            </p>
          ) : null}
        </div>

        {origens.length === 0 ? (
          <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">Nenhuma venda no período.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {origens.map((o) => {
              const share = pct(o.receitaCents, totalCents);
              const muted = o.id === "unknown";
              const selected = origem === o.id;
              const dimmed = Boolean(origem) && !selected;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onOrigem(selected ? null : o.id)}
                    title={selected ? "Ver todas as origens" : `Filtrar a tela por ${o.label}`}
                    className={`grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)] ${
                      selected ? "bg-[var(--divider-soft)]" : "hover:bg-[var(--divider-soft)]"
                    } ${dimmed ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`truncate ${selected ? "type-caption-strong" : "type-caption"} ${
                        muted && !selected ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"
                      }`}
                    >
                      {o.label}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--divider-soft)]">
                      <div
                        className={`h-full rounded-full ${
                          selected || o.id === "meta_ads"
                            ? "bg-[var(--primary)]"
                            : muted
                              ? "bg-[var(--border)]"
                              : "bg-muted-foreground/40"
                        }`}
                        style={{ width: `${Math.max(2, share)}%` }}
                      />
                    </div>
                    <span className="type-caption tabular-nums text-[var(--foreground)]">
                      {brl(o.receitaCents / 100)}
                      <span className="ml-2 inline-block w-16 text-right text-[var(--muted-foreground)]">
                        {o.pedidos} · {share}%
                      </span>
                    </span>
                  </button>
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

        {semOrigem && semOrigem.pedidos === totalPedidosOrigens ? (
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
  const ages = r?.byAge.filter((b) => b.cents > 0) ?? [];
  const note =
    c && c.unidentified.count > 0 ? `${num(c.unidentified.count)} pedidos sem contato ficam fora da recompra` : null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="type-caption-strong text-[var(--foreground)]">Clientes e recuperação</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {c ? (
          <>
            <Kpi
              label="Receita recorrente"
              value={centsBrl(c.repeatOrders.cents)}
              hint={`${pctText(c.repeatShare)} da receita`}
            />
            <Kpi label="Clientes novos" value={num(c.newBuyers)} hint={centsBrl(c.firstOrders.cents)} />
            <Kpi
              label="Recorrentes"
              value={num(c.returningBuyers)}
              hint={c.avgGapDays != null ? `voltam em ~${num(c.avgGapDays)} dias` : `${pctText(c.returningShare)} dos compradores`}
            />
          </>
        ) : null}
        {r ? (
          <Kpi
            label="Carrinho recuperado"
            value={centsBrl(r.recovered.cents)}
            hint={`${num(r.recovered.count)} ${r.recovered.count === 1 ? "pedido" : "pedidos"}`}
          />
        ) : null}
      </div>

      {r && r.recovered.cents > 0 ? (
        <div className="mt-4 grid gap-3 border-t border-[var(--divider-soft)] pt-4 sm:grid-cols-3">
          <SplitBar
            title="Recuperação"
            parts={[
              { label: "Mensagem", cents: r.byMessage.cents },
              { label: "Sozinho", cents: r.alone.cents },
            ]}
          />
          <SplitBar
            title="Quem voltou"
            parts={[
              { label: "Cliente", cents: r.fromCustomers.cents },
              { label: "Novo", cents: r.fromNew.cents },
            ]}
          />
          {ages.length ? (
            <SplitBar title="Pagou em" parts={ages.map((b) => ({ label: AGE_SHORT[b.key] ?? b.label, cents: b.cents }))} />
          ) : null}
        </div>
      ) : null}

      {note ? <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">{note}</p> : null}
    </div>
  );
}

const AGE_SHORT: Record<string, string> = { d30: "30d", d60: "60d", d90: "90d", d180: "6m" };
const SPLIT_TONES = ["var(--primary)", "color-mix(in srgb, var(--primary) 45%, transparent)", "color-mix(in srgb, var(--primary) 22%, transparent)", "var(--border)"];

/** Proporção em uma barra: título, barra segmentada e legenda com valores. */
function SplitBar({ title, parts }: { title: string; parts: Array<{ label: string; cents: number }> }) {
  const total = parts.reduce((s, p) => s + p.cents, 0);
  return (
    <div>
      <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{title}</p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--divider-soft)]">
        {total > 0
          ? parts.map((p, i) =>
              p.cents > 0 ? (
                <div key={p.label} style={{ width: `${(p.cents / total) * 100}%`, background: SPLIT_TONES[i] }} />
              ) : null,
            )
          : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p, i) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 type-fine-print text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full" style={{ background: SPLIT_TONES[i] }} />
            {p.label}
            <span className="tabular-nums text-[var(--foreground)]">{centsBrl(p.cents)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function VendasSerie({ data, origemLabel }: { data: Consolidado; origemLabel: string | null }) {
  const serie = data.serie ?? [];
  if (serie.length < 2) return null;
  const semanal = data.serieAgrupamento === "semana";
  const rows = serie.map((s) => {
    const [, m, d] = s.data.split("-");
    return { periodo: `${d}/${m}`, receita: s.receitaCents / 100, pedidos: s.pedidos };
  });
  const tickEvery = rows.length > 16 ? Math.ceil(rows.length / 16) - 1 : 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-caption-strong text-[var(--foreground)]">
          {semanal ? "Vendas por semana" : "Vendas por dia"}
        </p>
        <p className="type-fine-print text-[var(--muted-foreground)]">{origemLabel ?? "Todas as origens"}</p>
      </div>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
            <XAxis
              dataKey="periodo"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={tickEvery}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))}
            />
            <Tooltip
              cursor={{ fill: "var(--divider-soft)" }}
              labelFormatter={(label: string) => (semanal ? `Semana de ${label}` : label)}
              formatter={(value: number, _name: string, item: { payload?: { pedidos?: number } }) => [
                `${brl(Number(value))} · ${item.payload?.pedidos ?? 0} pedidos`,
                "Receita",
              ]}
              {...chartTooltip}
            />
            <Bar dataKey="receita" name="Receita" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
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
  const [origem, setOrigem] = useState<string | null>(null);
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["cliente-consolidado", clienteId, query, origem],
    queryFn: async () => {
      const qs = origem ? `${query}&origem=${encodeURIComponent(origem)}` : query;
      const res = await fetch(`/api/clientes/${clienteId}/consolidado?${qs}`);
      if (!res.ok) throw new Error("Falha ao carregar visão geral");
      return (await res.json()) as Consolidado;
    },
    placeholderData: keepPreviousData,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 type-caption text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Somando todos os canais…
      </div>
    );
  }

  if (data.ecommerce && data.fonteVendas !== "anuncios" && data.origens) {
    return <EcommerceGeral data={data} origem={origem} onOrigem={setOrigem} fetching={isPlaceholderData} />;
  }

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
