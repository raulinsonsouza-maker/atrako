"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CartRecoveryMetrics, RepurchaseMetrics } from "@/lib/commerce/customer-metrics";
import { channelColor } from "@/lib/commerce-attribution/channel-color";
import { useIsMobile } from "@/hooks/useIsMobile";
import { rotuloEixo, rotuloTooltip, type ChartAgrupamento } from "@/lib/chart-bucket";
import { mobileTickInterval } from "@/lib/chart-mobile";
import { MetricTile } from "@/components/ui";

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
};

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const roasText = (roas: number | null | undefined) => (roas != null ? `${roas.toLocaleString("pt-BR")}x` : "—");

const MEDIA_LABELS: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads" };

/** Loja própria: o pedido nasce nela e a origem é como o cliente chegou. */
const STORE_PROVIDERS = new Set(["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"]);
/** Chaves de `orderOriginKey` quando o pedido é da loja (não marketplace nem checkout). */
const TRAFFIC_ORIGINS = new Set([
  "meta_ads",
  "google_ads",
  "instagram",
  "facebook",
  "google_organic",
  "email",
  "whatsapp",
  "direct",
  "referral",
  "admin",
  "other",
  "unknown",
]);
const MARKETPLACES = new Set(["MERCADO_LIVRE", "SHOPEE", "TIKTOK_SHOP"]);

type OrigemVenda = { id: string; label: string; pedidos: number; receitaCents: number };

/** Geral de loja: resultado real + onde a venda entrou (loja, marketplace) e como o cliente chegou. */
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
  const totalCents = origens.reduce((s, o) => s + o.receitaCents, 0);
  const totalPedidosOrigens = origens.reduce((s, o) => s + o.pedidos, 0);
  const semOrigem = origens.find((o) => o.id === "unknown");
  const lojasDoPeriodo = canaisVenda.filter((c) => STORE_PROVIDERS.has(c.id));
  const lojasSig = lojasDoPeriodo.map((l) => `${l.id}:${l.label}:${l.receitaCents}:${l.pedidos}`).join("|");
  const [lojas, setLojas] = useState(lojasDoPeriodo);
  const [lojasSigVista, setLojasSigVista] = useState(origem ? "" : lojasSig);
  if (!origem && !fetching && lojasSig !== lojasSigVista) {
    setLojas(lojasDoPeriodo);
    setLojasSigVista(lojasSig);
  }
  const origemLabel = origem ? origens.find((o) => o.id === origem)?.label ?? "Origem selecionada" : null;
  const midiaLabel = origem
    ? data.midiaDaOrigem
      ? MEDIA_LABELS[data.midiaDaOrigem] ?? data.midiaDaOrigem
      : null
    : canaisMidia.map((c) => c.label).join(" + ");
  const semMidia = Boolean(origem && !data.midiaDaOrigem);

  return (
    <section className={`space-y-4 transition-opacity ${fetching ? "opacity-60" : ""}`}>
      <div className="rel-kpi-grid">
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

      <VendasPorLugar
        origens={origens}
        lojas={lojas}
        totalCents={totalCents}
        origem={origem}
        onOrigem={onOrigem}
        semOrigem={Boolean(semOrigem && semOrigem.pedidos === totalPedidosOrigens)}
      />

      {data.clientes || data.recuperacao ? (
        <ClientesERecuperacao clientes={data.clientes ?? null} recuperacao={data.recuperacao ?? null} />
      ) : null}
    </section>
  );
}

function VendasPorLugar({
  origens,
  lojas,
  totalCents,
  origem,
  onOrigem,
  semOrigem,
}: {
  origens: OrigemVenda[];
  lojas: OrigemVenda[];
  totalCents: number;
  origem: string | null;
  onOrigem: (id: string | null) => void;
  semOrigem: boolean;
}) {
  const chegada = origens.filter((o) => TRAFFIC_ORIGINS.has(o.id));
  const lugares = origens.filter((o) => !TRAFFIC_ORIGINS.has(o.id));
  const temLoja = chegada.length > 0;
  const titulo = temLoja && lugares.length === 0 ? "Como chegaram" : "Onde vendeu";
  const lojaCents = chegada.reduce((s, o) => s + o.receitaCents, 0);
  const nomeLoja = lojas.length === 1 ? lojas[0].label : lojas.length > 1 ? "Lojas" : "Loja";
  const lugarTitulo =
    lugares.length < 2 ? null : lugares.every((o) => MARKETPLACES.has(o.id)) ? "Marketplaces" : "Outros pontos de venda";

  return (
    <div className="rel-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-caption-strong text-[var(--foreground)]">{titulo}</p>
        {origem ? (
          <button
            type="button"
            onClick={() => onOrigem(null)}
            className="type-caption text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Ver todas
          </button>
        ) : temLoja && lugares.length === 0 && lojas.length === 1 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">{lojas[0].label}</p>
        ) : null}
      </div>

      {origens.length === 0 ? (
        <p className="mt-3 type-fine-print text-[var(--muted-foreground)]">Nenhuma venda no período.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {temLoja ? (
            <div>
              {lugares.length > 0 ? (
                <div className="flex items-baseline justify-between gap-3 px-2">
                  <p className="type-caption-strong text-[var(--foreground)]">{nomeLoja}</p>
                  <ValorOrigem cents={lojaCents} share={pct(lojaCents, totalCents)} />
                </div>
              ) : null}
              {lugares.length > 0 && lojas.length > 1 ? (
                <ul className="mt-1">
                  {lojas.map((loja) => (
                    <li key={loja.id} className="flex items-baseline justify-between gap-3 px-2 py-1">
                      <span className="type-caption text-[var(--foreground)]">{loja.label}</span>
                      <span className="type-caption tabular-nums text-[var(--foreground)]">{brl(loja.receitaCents / 100)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {lugares.length > 0 ? (
                <p className="px-2 pb-1 pt-3 type-fine-print text-[var(--muted-foreground)]">
                  {lojas.length > 1 ? "Como o cliente chegou, somando as lojas" : "Como o cliente chegou"}
                </p>
              ) : null}
              <ul className="space-y-1">
                {chegada.map((o) => (
                  <OrigemButton
                    key={o.id}
                    row={o}
                    share={pct(o.receitaCents, totalCents)}
                    selected={origem === o.id}
                    dimmed={Boolean(origem) && origem !== o.id}
                    nested={lugares.length > 0}
                    onPick={() => onOrigem(origem === o.id ? null : o.id)}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {lugares.length > 0 ? (
            <div className={temLoja ? "border-t border-[var(--divider-soft)] pt-4" : undefined}>
              {lugarTitulo ? <p className="px-2 pb-1 type-fine-print text-[var(--muted-foreground)]">{lugarTitulo}</p> : null}
              <ul className="space-y-1">
                {lugares.map((o) => (
                  <OrigemButton
                    key={o.id}
                    row={o}
                    share={pct(o.receitaCents, totalCents)}
                    selected={origem === o.id}
                    dimmed={Boolean(origem) && origem !== o.id}
                    nested={false}
                    onPick={() => onOrigem(origem === o.id ? null : o.id)}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {semOrigem ? (
        <p className="mt-4 type-fine-print text-[var(--muted-foreground)]">
          A origem dos pedidos é calculada na próxima sincronização.
        </p>
      ) : null}
    </div>
  );
}

function ValorOrigem({ cents, share, pedidos }: { cents: number; share: number; pedidos?: number }) {
  return (
    <span className="shrink-0 type-caption tabular-nums text-[var(--foreground)]">
      {brl(cents / 100)}
      {pedidos != null ? <span className="text-[var(--muted-foreground)]"> · {pedidos.toLocaleString("pt-BR")}</span> : null}
      <span className="text-[var(--muted-foreground)]"> · {share}%</span>
    </span>
  );
}

function OrigemButton({
  row,
  share,
  selected,
  dimmed,
  nested,
  onPick,
}: {
  row: OrigemVenda;
  share: number;
  selected: boolean;
  dimmed: boolean;
  nested: boolean;
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
        title={selected ? "Ver todas" : `Filtrar por ${row.label}`}
        className={`w-full rounded-[var(--radius-xs)] py-1.5 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)] ${
          nested ? "pl-5 pr-2" : "px-2"
        } ${selected ? "bg-[var(--divider-soft)]" : "hover:bg-[var(--divider-soft)]"} ${dimmed ? "opacity-50" : ""}`}
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
          </span>
          <ValorOrigem cents={row.receitaCents} share={share} pedidos={row.pedidos} />
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
  const note =
    c && c.unidentified.count > 0 ? `${num(c.unidentified.count)} pedidos sem contato ficam fora da recompra` : null;
  return (
    <div className="rel-card p-5">
      <p className="type-caption-strong text-[var(--foreground)]">Clientes e recuperação</p>

      <div className="rel-kpi-grid mt-4">
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
      <p className="type-fine-print uppercase text-[var(--muted-foreground)]">{title}</p>
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
  labelStyle: { color: "var(--foreground)", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function VendasSerie({ data, origemLabel }: { data: Consolidado; origemLabel: string | null }) {
  const isMobile = useIsMobile();
  const serie = data.serie ?? [];
  if (serie.length < 2) return null;
  const agrupamento = data.serieAgrupamento ?? "dia";
  const years = new Set(serie.map((row) => row.data.slice(0, 4)));
  const multiYear = years.size > 1;
  const rows = serie.map((row) => ({
    periodo: rotuloEixo(row.data, agrupamento, multiYear),
    rotulo: rotuloTooltip(row.data, agrupamento),
    receita: row.receitaCents / 100,
    pedidos: row.pedidos,
  }));
  const tickEvery = isMobile ? mobileTickInterval(rows.length) : rows.length > 16 ? Math.ceil(rows.length / 16) - 1 : 0;
  const titulo = agrupamento === "mes" ? "Vendas por mês" : agrupamento === "semana" ? "Vendas por semana" : "Vendas por dia";

  return (
    <div className="rel-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-caption-strong text-[var(--foreground)]">{titulo}</p>
        <p className="type-fine-print text-[var(--muted-foreground)]">{origemLabel ?? "Todas as vendas"}</p>
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
              labelFormatter={(_label: string, payload: ReadonlyArray<{ payload?: { rotulo?: string } }>) =>
                payload[0]?.payload?.rotulo ?? _label
              }
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
