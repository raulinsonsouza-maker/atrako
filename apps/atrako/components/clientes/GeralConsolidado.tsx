"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CartRecoveryMetrics, RepurchaseMetrics } from "@/lib/commerce/customer-metrics";
import { channelColor } from "@/lib/commerce-attribution/channel-color";
import { useIsMobile } from "@/hooks/useIsMobile";
import { bucketYmd, rotuloEixo, rotuloTooltip, type ChartAgrupamento } from "@/lib/chart-bucket";
import { formatCompactNumber, mobileTickInterval } from "@/lib/chart-mobile";
import { MetricTile, SegmentedControl } from "@/components/ui";

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
  serie?: Array<{ data: string; receitaCents: number; pedidos: number; investimento?: number }>;
  serieAgrupamento?: ChartAgrupamento;
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
  /** Cada ponto de venda com a conversão dele (loja: como chegou; marketplace: o próprio canal). */
  detalheCanais?: Array<{
    id: string;
    label: string;
    pedidos: number;
    receitaCents: number;
    origens: Array<{ id: string; label: string; pedidos: number; receitaCents: number }>;
  }>;
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
  /** Conferência por canal quando Olist confirma a venda. */
  conferencia?: {
    olistConnected: boolean;
    confirmed?: number;
    confirmedCents?: number;
    matchedWoo?: number;
    matchedMl?: number;
    erpOnly?: number;
    channelOnly?: number;
    channelOnlyCents?: number;
    matchRate?: number;
    canais?: Array<{ id: string; label: string; pedidos: number; receitaCents: number }>;
  };
};

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const roasText = (roas: number | null | undefined) => (roas != null ? `${roas.toLocaleString("pt-BR")}x` : "—");

const MEDIA_LABELS: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads" };

type OrigemVenda = { id: string; label: string; pedidos: number; receitaCents: number };

/** Geral de loja: KPIs → volume → canais/origens → clientes. Sem blocos duplicados. */
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
  const { totais, canaisMidia } = data;
  const origens = data.origens ?? [];
  const canais = data.detalheCanais ?? [];
  const totalCents = canais.reduce((s, c) => s + c.receitaCents, 0) || origens.reduce((s, o) => s + o.receitaCents, 0);
  const origemLabel = origem ? origens.find((o) => o.id === origem)?.label ?? "Origem" : null;
  const midiaLabel = origem
    ? data.midiaDaOrigem
      ? MEDIA_LABELS[data.midiaDaOrigem] ?? data.midiaDaOrigem
      : null
    : canaisMidia.map((c) => c.label).join(" + ") || undefined;
  const semMidia = Boolean(origem && !data.midiaDaOrigem);
  const pendentes = data.conferencia?.channelOnly ?? 0;

  return (
    <section className={`space-y-4 transition-opacity ${fetching ? "opacity-60" : ""}`}>
      <div className="rel-kpi-grid">
        <Kpi
          label="Receita"
          value={brl(totais.receita)}
          hint={`${totais.pedidos.toLocaleString("pt-BR")} pedidos`}
        />
        <Kpi
          label="Investimento"
          value={semMidia ? "—" : brl(totais.investimento)}
          hint={semMidia ? undefined : midiaLabel}
        />
        <Kpi label="Retorno" value={roasText(totais.roas)} tone={roasTone(totais.roas)} />
        <Kpi
          label="Custo / pedido"
          value={totais.pedidos > 0 && totais.investimento > 0 ? brl(totais.investimento / totais.pedidos) : "—"}
          hint={totais.pedidos > 0 ? `ticket ${brl(totais.ticketMedio)}` : undefined}
        />
      </div>

      <VendasSerie data={data} origemLabel={origemLabel} />

      <CanaisEOrigens canais={canais} totalCents={totalCents} origem={origem} onOrigem={onOrigem} />

      {pendentes > 0 ? (
        <p className="type-fine-print text-[var(--muted-foreground)]">
          {pendentes} pedido{pendentes === 1 ? "" : "s"} na loja/ML ainda sem NF na Olist
          {data.conferencia?.channelOnlyCents
            ? ` · ${brl(data.conferencia.channelOnlyCents / 100)}`
            : ""}
        </p>
      ) : null}

      {data.clientes || data.recuperacao ? (
        <ClientesERecuperacao clientes={data.clientes ?? null} recuperacao={data.recuperacao ?? null} />
      ) : null}
    </section>
  );
}

type CanalVenda = OrigemVenda & { origens: OrigemVenda[] };

const CANAL_FALLBACK: Record<string, string> = {
  loja: "var(--channel-direct)",
  mercadolivre: "var(--channel-mercado-livre)",
  pdv: "var(--channel-referral)",
};

function canalTone(id: string) {
  return channelColor(id) ?? CANAL_FALLBACK[id] ?? "var(--primary)";
}

/** Um card: barra de canais + origens do canal ativo. */
function CanaisEOrigens({
  canais,
  totalCents,
  origem,
  onOrigem,
}: {
  canais: CanalVenda[];
  totalCents: number;
  origem: string | null;
  onOrigem: (id: string | null) => void;
}) {
  const ids = canais.map((c) => c.id).join("|");
  const forced = origem && canais.some((c) => c.id === origem) ? origem : "";
  const [canalId, setCanalId] = useState(canais[0]?.id ?? "");
  const [sig, setSig] = useState("");
  const nextSig = `${ids}#${forced}`;
  if (nextSig !== sig) {
    setSig(nextSig);
    setCanalId(forced || (canais.some((c) => c.id === canalId) ? canalId : canais[0]?.id ?? ""));
  }
  const ativo = canais.find((c) => c.id === canalId) ?? canais[0];
  const origensAtivas =
    ativo?.origens?.length && ativo.origens.length > 0
      ? ativo.origens
      : ativo
        ? [{ id: ativo.id, label: ativo.label, pedidos: ativo.pedidos, receitaCents: ativo.receitaCents }]
        : [];
  const baseOrigem = origensAtivas.reduce((s, o) => s + o.receitaCents, 0) || totalCents;

  if (canais.length === 0) {
    return (
      <div className="rel-card p-5">
        <p className="type-caption-strong text-[var(--foreground)]">Vendas</p>
        <p className="mt-2 type-fine-print text-[var(--muted-foreground)]">Nenhuma venda no período.</p>
      </div>
    );
  }

  return (
    <div className="rel-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption-strong text-[var(--foreground)]">Vendas</p>
        {origem ? (
          <button
            type="button"
            onClick={() => onOrigem(null)}
            className="type-caption text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Limpar filtro
          </button>
        ) : null}
      </div>

      {/* Barra visual dos canais */}
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[var(--divider-soft)]">
        {canais.map((c) => {
          const share = totalCents > 0 ? (c.receitaCents / totalCents) * 100 : 0;
          if (share <= 0) return null;
          return (
            <button
              key={c.id}
              type="button"
              title={`${c.label} · ${pct(c.receitaCents, totalCents)}%`}
              aria-pressed={canalId === c.id}
              onClick={() => setCanalId(c.id)}
              className={`h-full transition-[filter] ${canalId === c.id ? "" : "opacity-70 hover:opacity-100"}`}
              style={{ width: `${Math.max(share, 1.5)}%`, background: canalTone(c.id) }}
            />
          );
        })}
      </div>

      <div className={`mt-3 grid gap-2 ${canais.length >= 3 ? "sm:grid-cols-3" : canais.length === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {canais.map((c) => {
          const share = pct(c.receitaCents, totalCents);
          const active = canalId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCanalId(c.id)}
              className={`rounded-[var(--radius-xs)] border px-3 py-3 text-left transition active:scale-[0.99] ${
                active
                  ? "border-[var(--primary)] bg-[var(--divider-soft)]"
                  : "border-[var(--hairline)] hover:bg-[var(--divider-soft)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: canalTone(c.id) }} />
                <span className="type-caption-strong text-[var(--foreground)]">{c.label}</span>
                <span className="ml-auto type-micro-legal tabular-nums text-[var(--muted-foreground)]">{share}%</span>
              </span>
              <span className="mt-1 block type-tagline tabular-nums text-[var(--foreground)]">
                {brl(c.receitaCents / 100)}
              </span>
              <span className="type-micro-legal text-[var(--muted-foreground)]">
                {c.pedidos.toLocaleString("pt-BR")} pedidos
              </span>
            </button>
          );
        })}
      </div>

      {origensAtivas.length > 0 ? (
        <ul className="mt-5 space-y-1 border-t border-[var(--divider-soft)] pt-4">
          {origensAtivas.map((o) => (
            <OrigemButton
              key={o.id}
              row={o}
              share={pct(o.receitaCents, baseOrigem)}
              selected={origem === o.id}
              dimmed={Boolean(origem) && origem !== o.id}
              onPick={() => onOrigem(origem === o.id ? null : o.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ValorOrigem({ cents, share }: { cents: number; share: number }) {
  return (
    <span className="shrink-0 type-caption tabular-nums text-[var(--foreground)]">
      {brl(cents / 100)}
      <span className="text-[var(--muted-foreground)]"> · {share}%</span>
    </span>
  );
}

function OrigemButton({
  row,
  share,
  selected,
  dimmed,
  onPick,
}: {
  row: OrigemVenda;
  share: number;
  selected: boolean;
  dimmed: boolean;
  onPick: () => void;
}) {
  const color = channelColor(row.id) ?? "var(--border)";
  const muted = row.id === "unknown";
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onPick}
        title={selected ? "Limpar filtro" : `Filtrar · ${row.label}`}
        className={`w-full rounded-[var(--radius-xs)] px-2 py-2 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)] ${
          selected ? "bg-[var(--divider-soft)]" : "hover:bg-[var(--divider-soft)]"
        } ${dimmed ? "opacity-45" : ""}`}
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            <span
              className={`truncate ${selected ? "type-caption-strong" : "type-caption"} ${
                muted && !selected ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"
              }`}
            >
              {row.label}
            </span>
            <span className="type-micro-legal tabular-nums text-[var(--muted-foreground)]">
              {row.pedidos.toLocaleString("pt-BR")}
            </span>
          </span>
          <ValorOrigem cents={row.receitaCents} share={share} />
        </span>
        <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[var(--divider-soft)]">
          <span className="h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, background: color }} />
        </span>
      </button>
    </li>
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
  const hasRecovery = Boolean(r && r.recovered.cents > 0);
  return (
    <div className="rel-card p-5">
      <p className="type-caption-strong text-[var(--foreground)]">Clientes</p>
      <div className="rel-kpi-grid mt-4">
        {c ? (
          <>
            <Kpi label="Recorrente" value={centsBrl(c.repeatOrders.cents)} hint={pctText(c.repeatShare)} />
            <Kpi label="Novos" value={num(c.newBuyers)} hint={centsBrl(c.firstOrders.cents)} />
            <Kpi
              label="Que voltam"
              value={num(c.returningBuyers)}
              hint={c.avgGapDays != null ? `~${num(c.avgGapDays)} dias` : pctText(c.returningShare)}
            />
          </>
        ) : null}
        {r ? (
          <Kpi label="Recuperado" value={centsBrl(r.recovered.cents)} hint={`${num(r.recovered.count)} ped.`} />
        ) : null}
      </div>

      {hasRecovery ? (
        <div className="mt-4 grid gap-4 border-t border-[var(--divider-soft)] pt-4 sm:grid-cols-3">
          <SplitBar
            title="Como"
            parts={[
              { label: "Msg", cents: r!.byMessage.cents },
              { label: "Só", cents: r!.alone.cents },
            ]}
          />
          <SplitBar
            title="Quem"
            parts={[
              { label: "Cliente", cents: r!.fromCustomers.cents },
              { label: "Novo", cents: r!.fromNew.cents },
            ]}
          />
          {ages.length ? (
            <SplitBar title="Quando" parts={ages.map((b) => ({ label: AGE_SHORT[b.key] ?? b.label, cents: b.cents }))} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const AGE_SHORT: Record<string, string> = { d30: "30d", d60: "60d", d90: "90d", d180: "6m" };
const SPLIT_TONES = [
  "var(--primary)",
  "color-mix(in srgb, var(--primary) 45%, transparent)",
  "color-mix(in srgb, var(--primary) 22%, transparent)",
  "var(--border)",
];

function SplitBar({ title, parts }: { title: string; parts: Array<{ label: string; cents: number }> }) {
  const total = parts.reduce((s, p) => s + p.cents, 0);
  return (
    <div>
      <p className="type-micro-legal uppercase tracking-wide text-[var(--muted-foreground)]">{title}</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[var(--divider-soft)]">
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
          <span key={p.label} className="inline-flex items-center gap-1.5 type-micro-legal text-[var(--muted-foreground)]">
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
  labelStyle: { color: "var(--foreground)", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function VendasSerie({ data, origemLabel }: { data: Consolidado; origemLabel: string | null }) {
  const isMobile = useIsMobile();
  const serie = data.serie ?? [];
  const serverAgrupamento = data.serieAgrupamento ?? "dia";
  const canToggle = serverAgrupamento === "dia";
  const [modo, setModo] = useState<"diario" | "semanal">("diario");
  const agrupamento: ChartAgrupamento = canToggle && modo === "semanal" ? "semana" : serverAgrupamento;

  const rows = useMemo(() => {
    if (serie.length === 0) return [];
    const buckets = new Map<
      string,
      { data: string; receitaCents: number; pedidos: number; investimento: number }
    >();
    for (const row of serie) {
      const key = bucketYmd(row.data, agrupamento);
      const cur = buckets.get(key) ?? { data: key, receitaCents: 0, pedidos: 0, investimento: 0 };
      cur.receitaCents += row.receitaCents;
      cur.pedidos += row.pedidos;
      cur.investimento += row.investimento ?? 0;
      buckets.set(key, cur);
    }
    const ordered = [...buckets.values()].sort((a, b) => a.data.localeCompare(b.data));
    const years = new Set(ordered.map((row) => row.data.slice(0, 4)));
    const multiYear = years.size > 1;
    const isDiario = agrupamento === "dia";
    return ordered.map((row) => {
      const investimento = Math.round(row.investimento * 100) / 100;
      const faturamento = row.receitaCents / 100;
      const compras = row.pedidos;
      return {
        periodo:
          agrupamento === "semana"
            ? (() => {
                const start = new Date(`${row.data}T00:00:00Z`);
                const end = new Date(start.getTime() + 6 * 86_400_000);
                const fmt = (d: Date) =>
                  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
                return `${fmt(start)}-${fmt(end)}`;
              })()
            : rotuloEixo(row.data, agrupamento, multiYear),
        rotulo: rotuloTooltip(row.data, agrupamento),
        Investimento: investimento,
        Faturamento: faturamento,
        Compras: compras,
        "Custo/Compra": compras > 0 ? Math.round((investimento / compras) * 100) / 100 : 0,
        angleDaily: isDiario && ordered.length > 14,
      };
    });
  }, [serie, agrupamento]);

  if (rows.length < 2) return null;

  const isDiario = agrupamento === "dia";
  const isMensal = agrupamento === "mes";
  const periodoLabel = isMensal ? "mês" : isDiario ? "dia" : "semana";
  const tickEvery = isMobile
    ? mobileTickInterval(rows.length)
    : isDiario && rows.length > 14
      ? Math.ceil(rows.length / 14) - 1
      : 0;

  return (
    <div className="rel-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-caption-strong text-[var(--foreground)]">
          Volume
          <span className="ml-2 type-fine-print font-normal text-[var(--muted-foreground)]">
            por {periodoLabel}
            {origemLabel ? ` · ${origemLabel}` : ""}
          </span>
        </p>
        {canToggle ? (
          <SegmentedControl
            aria-label="Agrupamento"
            value={modo}
            onChange={setModo}
            options={[
              { value: "diario", label: "Diário" },
              { value: "semanal", label: "Semanal" },
            ]}
          />
        ) : null}
      </div>
      <div className="mt-4 h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
            <XAxis
              dataKey="periodo"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={tickEvery}
              angle={!isMobile && isDiario && rows.length > 14 ? -45 : 0}
              textAnchor={!isMobile && isDiario && rows.length > 14 ? "end" : "middle"}
              height={!isMobile && isDiario && rows.length > 14 ? 50 : 30}
            />
            <YAxis
              yAxisId="left"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 40 : 60}
              tickFormatter={isMobile ? formatCompactNumber : (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 32 : 48}
              allowDecimals={false}
              tickFormatter={isMobile ? formatCompactNumber : undefined}
            />
            <YAxis yAxisId="cpl" hide />
            <Tooltip
              cursor={{ fill: "var(--divider-soft)" }}
              labelFormatter={(_label: string, payload: ReadonlyArray<{ payload?: { rotulo?: string } }>) =>
                payload[0]?.payload?.rotulo ?? _label
              }
              formatter={(value: number, name: string) => {
                if (name === "Investimento" || name === "Faturamento" || name === "Custo/Compra") {
                  return [brl(Number(value)), name];
                }
                return [Number(value).toLocaleString("pt-BR"), name];
              }}
              {...chartTooltip}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="Investimento" fill="var(--chart-spend)" radius={[6, 6, 0, 0]} />
            <Bar yAxisId="left" dataKey="Faturamento" fill="var(--chart-plan)" radius={[6, 6, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Compras"
              stroke="var(--chart-result)"
              strokeWidth={2.5}
              dot={{ fill: "var(--chart-result)", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0, fill: "var(--chart-result)" }}
            />
            <Line
              yAxisId="cpl"
              dataKey="Custo/Compra"
              stroke="transparent"
              dot={false}
              activeDot={false}
              legendType="none"
            />
          </ComposedChart>
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
  return <MetricTile label={label} value={value} detail={hint} tone={tone} />;
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
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ["cliente-consolidado", clienteId, query, origem],
    queryFn: async () => {
      const qs = origem ? `${query}&origem=${encodeURIComponent(origem)}` : query;
      const res = await fetch(`/api/clientes/${clienteId}/consolidado?${qs}`);
      if (!res.ok) throw new Error("Falha ao carregar visão geral");
      return (await res.json()) as Consolidado;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  if (isError) {
    return (
      <div className="rel-card p-5 type-caption text-[var(--muted-foreground)]">
        Não foi possível somar os canais. Entre de novo para testar esta conta.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rel-card p-5 type-caption text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Somando todos os canais…
      </div>
    );
  }

  if (data.ecommerce && data.fonteVendas !== "anuncios" && data.origens) {
    return (
      <EcommerceGeral
        data={data}
        origem={origem}
        onOrigem={setOrigem}
        fetching={isPlaceholderData}
      />
    );
  }

  const { totais, canaisVenda, canaisMidia, relacionamento: rel } = data;
  const vendasDosAnuncios = data.fonteVendas === "anuncios";
  const showRel = Boolean(rel && (rel.pedidosAtribuidos > 0 || rel.pedidosInfluenciados > 0 || rel.custoWhatsApp > 0));
  const maxReceita = Math.max(1, ...canaisVenda.map((c) => c.receitaCents));

  return (
    <section className="space-y-4">
      <div className="rel-kpi-grid">
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
        <div className="rel-kpi-grid">
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
        <div className="rel-card p-4">
          <p className="type-fine-print uppercase text-[var(--muted-foreground)]">
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

        <div className="rel-card p-4">
          <p className="type-fine-print uppercase text-[var(--muted-foreground)]">
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
