"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  type TooltipProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  Globe,
  Landmark,
  MessageSquareMore,
  ReceiptText,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PainelResumo = {
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  onFacebookLeads: number;
  websiteLeads: number;
  messagingConversationsStarted: number;
  contacts: number;
  purchases: number;
  faturamento: number;
  cpl: number;
  cpa: number;
  roas: number;
  ticketMedio: number;
  ctr: number;
  taxaVendaLead: number;
  taxaVendaClique: number;
};

type PainelSerie = {
  periodo: string;
  investimento: number;
  leads: number;
  purchases: number;
  faturamento: number;
  cpl: number;
  cpa: number;
  roas: number;
  ticketMedio: number;
};

type CampanhaCPV = {
  nome: string;
  investimento: number;
  vendas: number;
  faturamento: number;
  custoporVenda: number;
  ticketMedio: number;
};

type PainelData = {
  periodo: string;
  agrupamento?: "semanal" | "mensal" | "diario";
  resumo: PainelResumo;
  series: PainelSerie[];
  campanhas: CampanhaCPV[];
  leadMix: {
    onFacebookLeads: number;
    websiteLeads: number;
    messagingConversationsStarted: number;
    contacts: number;
  };
};

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatPercentage(value: number, decimals = 2) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function ResortChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const chartPoint = payload[0]?.payload as
    | {
        Investimento?: number;
        Faturamento?: number;
        Vendas?: number;
      }
    | undefined;

  const invest = Number(chartPoint?.Investimento ?? 0);
  const fat = Number(chartPoint?.Faturamento ?? 0);
  const pct = fat > 0 ? (invest / fat) * 100 : 0;

  return (
    <div
      className="rounded-[14px] border px-4 py-3"
      style={{
        background: "linear-gradient(180deg, rgba(22,22,28,0.98), rgba(14,14,18,0.98))",
        borderColor: "rgba(255, 106, 0, 0.18)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.38)",
      }}
    >
      <p className="mb-2 text-sm font-extrabold text-[#f5f5f5]">{label}</p>
      <div className="space-y-2 text-[13px]">
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-[#ff7f1f]">Faturamento</span>
          <span className="font-extrabold text-[#ff7f1f]">
            {formatCurrency(fat)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-medium text-[var(--foreground)]/80">Investimento</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatCurrency(invest)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-medium text-[var(--foreground)]/80">Vendas</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatInteger(Number(chartPoint?.Vendas ?? 0))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-white/10 pt-2">
          <span className="font-medium text-[var(--foreground)]/60 text-[11px]">Invest. / Fat.</span>
          <span className={`font-bold text-[11px] ${pct < 10 ? "text-emerald-400" : pct < 15 ? "text-amber-400" : "text-red-400"}`}>
            {formatPercentage(pct, 1)}
            <span className="ml-1 opacity-60">{pct < 10 ? "✓" : "↑"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ResortKpi({
  title,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-[var(--border)] bg-[var(--card)]">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {title}
          </p>
          <p
            className={`mt-1 text-xl font-extrabold leading-none tabular-nums ${
              accent ? "text-[var(--primary)]" : "text-[var(--foreground)]"
            }`}
          >
            {value}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: "ok" | "warn" | "danger" | "neutral";
}) {
  const valueColor =
    highlight === "ok"
      ? "text-emerald-400"
      : highlight === "warn"
        ? "text-amber-400"
        : highlight === "danger"
          ? "text-red-400"
          : "text-[var(--foreground)]";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)] leading-snug">{sub}</p>
    </div>
  );
}

export function HotelFazendaSaoJoaoPanel({
  data,
  canalLabel,
  onAgrupamentoChange,
}: {
  data: PainelData;
  canalLabel: string;
  onAgrupamentoChange?: (ag: "diario" | "semanal") => void;
}) {
  const isMensal = data.agrupamento === "mensal";
  const isDiario = data.agrupamento === "diario";
  const latestFiveSeries = data.series.slice(-5);
  const receitaPorLead = data.resumo.leads > 0 ? data.resumo.faturamento / data.resumo.leads : 0;

  const pctInvestFaturamento =
    data.resumo.faturamento > 0
      ? (data.resumo.investimento / data.resumo.faturamento) * 100
      : 0;
  const pctHighlight: "ok" | "warn" | "danger" =
    pctInvestFaturamento < 10 ? "ok" : pctInvestFaturamento < 15 ? "warn" : "danger";

  const chartData = data.series.map((item) => ({
    periodo: item.periodo,
    Investimento: Number(item.investimento.toFixed(2)),
    Faturamento: Number(item.faturamento.toFixed(2)),
    Vendas: item.purchases,
  }));
  const topFaturamentoWeek = [...data.series].sort((a, b) => b.faturamento - a.faturamento)[0];
  const topRoasWeek = [...data.series].sort((a, b) => b.roas - a.roas)[0];
  const topSalesWeek = [...data.series].sort((a, b) => b.purchases - a.purchases)[0];

  return (
    <section className="space-y-6">
      {/* ── KPI row ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ResortKpi
          title="Faturamento"
          value={formatCurrency(data.resumo.faturamento)}
          sub={`${data.periodo} selecionados`}
          icon={BadgeDollarSign}
          accent
        />
        <ResortKpi
          title="Investimento"
          value={formatCurrency(data.resumo.investimento)}
          sub="Mídia total no período"
          icon={Landmark}
        />
        <ResortKpi
          title="Vendas"
          value={formatInteger(data.resumo.purchases)}
          sub={`Canal ${canalLabel}`}
          icon={ShoppingCart}
        />
        <ResortKpi
          title="ROAS"
          value={`${data.resumo.roas.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}x`}
          sub="Receita por real investido"
          icon={TrendingUp}
        />
        <ResortKpi
          title="Custo por venda"
          value={formatCurrency(data.resumo.cpa)}
          sub="Investimento ÷ vendas"
          icon={Target}
        />
      </div>

      {/* ── Chart + Funil side-by-side ── */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Chart */}
        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                  Performance de receita {isMensal ? "mensal" : isDiario ? "diária" : "semanal"}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {isMensal
                    ? "Agrupado por mês · Linha = faturamento (eixo esq.) · Barras = investimento (eixo dir.)"
                    : isDiario
                      ? "Agrupado por dia · Linha = faturamento (eixo esq.) · Barras = investimento (eixo dir.)"
                      : "Agrupado por semana · Linha = faturamento (eixo esq.) · Barras = investimento (eixo dir.)"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isMensal && onAgrupamentoChange && (
                  <div className="flex overflow-hidden rounded-lg border border-[var(--border)] text-xs">
                    <button
                      onClick={() => onAgrupamentoChange("diario")}
                      className={`px-2.5 py-1.5 font-semibold transition-colors ${isDiario ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"}`}
                    >
                      Diário
                    </button>
                    <button
                      onClick={() => onAgrupamentoChange("semanal")}
                      className={`px-2.5 py-1.5 font-semibold transition-colors ${!isDiario ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"}`}
                    >
                      Semanal
                    </button>
                  </div>
                )}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <ReceiptText className="h-4 w-4" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                <span className="h-2 w-2 rounded-full bg-[rgba(255,106,0,0.55)]" />
                Investimento em mídia (barras)
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                Faturamento gerado (linha)
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/8 px-3 py-1 text-[11px] font-medium text-[var(--foreground)]">
                {formatInteger(data.resumo.purchases)} vendas no período
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.45} />
                  <XAxis
                    dataKey="periodo"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={isDiario && chartData.length > 14 ? Math.ceil(chartData.length / 14) - 1 : 0}
                    angle={isDiario && chartData.length > 14 ? -45 : 0}
                    textAnchor={isDiario && chartData.length > 14 ? "end" : "middle"}
                    height={isDiario && chartData.length > 14 ? 50 : 30}
                  />
                  {/* Left axis: faturamento */}
                  <YAxis
                    yAxisId="fat"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$ ${Number(v / 1000).toFixed(0)}k`}
                    width={56}
                  />
                  {/* Right axis: investimento (smaller scale) */}
                  <YAxis
                    yAxisId="inv"
                    orientation="right"
                    stroke="rgba(255,106,0,0.4)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$ ${Number(v / 1000).toFixed(0)}k`}
                    width={52}
                  />
                  <Tooltip content={<ResortChartTooltip />} />
                  <Bar
                    yAxisId="inv"
                    dataKey="Investimento"
                    fill="rgba(255, 106, 0, 0.42)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    yAxisId="fat"
                    type="monotone"
                    dataKey="Faturamento"
                    stroke="#ff7f1f"
                    strokeWidth={3.2}
                    dot={{ fill: "#ff7f1f", r: 4.5, strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      fill: "#ff7f1f",
                      stroke: "rgba(255,255,255,0.16)",
                      strokeWidth: 2,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {isMensal ? "Maior receita mensal" : isDiario ? "Maior receita diária" : "Melhor semana de receita"}
                </p>
                <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
                  {topFaturamentoWeek ? formatCurrency(topFaturamentoWeek.faturamento) : "—"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {topFaturamentoWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {isMensal ? "Melhor ROAS mensal" : isDiario ? "Melhor ROAS diário" : "Melhor ROAS semanal"}
                </p>
                <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
                  {topRoasWeek
                    ? `${topRoasWeek.roas.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}x`
                    : "—"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {topRoasWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {isMensal ? "Pico de vendas mensal" : isDiario ? "Pico de vendas diário" : "Pico de vendas semanais"}
                </p>
                <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
                  {topSalesWeek ? formatInteger(topSalesWeek.purchases) : "—"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {topSalesWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funil & Eficiência */}
        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                  Funil & Eficiência
                </h3>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Conversão, custo e saúde financeira da operação.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard
              label="Ticket médio por venda"
              value={formatCurrency(data.resumo.ticketMedio)}
              sub="Faturamento ÷ número de vendas no período"
            />
            <MetricCard
              label="Conversão lead → venda"
              value={formatPercentage(data.resumo.taxaVendaLead)}
              sub={`De cada 100 leads, ${data.resumo.taxaVendaLead.toFixed(1)} viraram reservas`}
            />
            <MetricCard
              label="CTR — taxa de clique"
              value={formatPercentage(data.resumo.ctr)}
              sub="% das impressões que geraram um clique no anúncio"
            />
            {/* New: % investido do faturamento */}
            <div className={`rounded-2xl border p-4 ${
              pctHighlight === "ok"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : pctHighlight === "warn"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Investimento / Faturamento
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  pctHighlight === "ok"
                    ? "text-emerald-400 bg-emerald-500/15"
                    : pctHighlight === "warn"
                      ? "text-amber-400 bg-amber-500/15"
                      : "text-red-400 bg-red-500/15"
                }`}>
                  {pctHighlight === "ok" ? "✓ Dentro da meta" : "↑ Acima da meta"}
                </span>
              </div>
              <p className={`text-xl font-bold tabular-nums ${
                pctHighlight === "ok"
                  ? "text-emerald-400"
                  : pctHighlight === "warn"
                    ? "text-amber-400"
                    : "text-red-400"
              }`}>
                {formatPercentage(pctInvestFaturamento, 1)}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pctHighlight === "ok" ? "bg-emerald-500" : pctHighlight === "warn" ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(pctInvestFaturamento / 20 * 100, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                Meta: manter abaixo de 10% do faturamento
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Lead mix cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Leads via Site
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
                {formatInteger(data.leadMix.websiteLeads)}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                Clicaram no anúncio e preencheram no site
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Leads Instantâneos
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
                {formatInteger(data.leadMix.onFacebookLeads)}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                Formulário nativo dentro do Meta/Facebook
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <MessageSquareMore className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Conversas Iniciadas
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
                {formatInteger(data.leadMix.messagingConversationsStarted)}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                Contatos via WhatsApp ou Messenger direto
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <BadgeDollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Receita por Lead
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
                {formatCurrency(receitaPorLead)}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                Faturamento ÷ total de leads gerados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Weekly breakdown table ── */}
      {latestFiveSeries.length > 0 && (
        <Card className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <CardHeader className="border-b border-[var(--border)]/60 px-6 pb-5 pt-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] sm:text-2xl">
                  Resultado comercial
                  <span className="ml-2 bg-[linear-gradient(90deg,var(--accent),var(--primary))] bg-clip-text text-transparent">
                    {isMensal ? "Mês a mês" : isDiario ? "Dia a dia" : "Semana a semana"}
                  </span>
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Foco em receita, vendas e eficiência para o resort.
                </p>
              </div>
              <span className="rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground)]">
                {latestFiveSeries.length} {isMensal ? "meses" : isDiario ? "dias" : "semanas"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate [border-spacing:0_10px]">
                <thead>
                  <tr>
                    <th className="w-[220px] px-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                      Métrica
                    </th>
                    {latestFiveSeries.map((item, index) => {
                      const isLatest = index === latestFiveSeries.length - 1;
                      return (
                        <th
                          key={item.periodo}
                          className={`px-4 text-center ${
                            isLatest ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                                isLatest ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                              }`}
                            >
                              {isLatest ? "Atual" : isDiario ? "Dia" : isMensal ? "Mês" : "Semana"}
                            </span>
                            <span className="text-sm font-semibold whitespace-nowrap">{item.periodo}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Investimento", render: (item: PainelSerie) => formatCurrency(item.investimento) },
                    { label: "Leads", render: (item: PainelSerie) => formatInteger(item.leads) },
                    { label: "Vendas", render: (item: PainelSerie) => formatInteger(item.purchases) },
                    { label: "Faturamento", render: (item: PainelSerie) => formatCurrency(item.faturamento) },
                    {
                      label: "ROAS",
                      render: (item: PainelSerie) =>
                        `${item.roas.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}x`,
                    },
                    {
                      label: "Invest./Faturamento",
                      render: (item: PainelSerie) => {
                        const p = item.faturamento > 0 ? (item.investimento / item.faturamento) * 100 : 0;
                        return formatPercentage(p, 1);
                      },
                    },
                    { label: "CPL", render: (item: PainelSerie) => formatCurrency(item.cpl) },
                    { label: "Custo por venda", render: (item: PainelSerie) => formatCurrency(item.cpa) },
                    { label: "Ticket médio", render: (item: PainelSerie) => formatCurrency(item.ticketMedio) },
                  ].map((metric, metricIdx) => (
                    <tr key={metric.label}>
                      <td className="rounded-l-2xl bg-white/[0.03] px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">
                          {metric.label}
                        </p>
                      </td>
                      {latestFiveSeries.map((item, index) => {
                        const isLatest = index === latestFiveSeries.length - 1;
                        const rawValue = metric.label === "Invest./Faturamento"
                          ? (item.faturamento > 0 ? (item.investimento / item.faturamento) * 100 : 0)
                          : null;
                        const pctColor =
                          rawValue !== null
                            ? rawValue < 10
                              ? "text-emerald-400"
                              : rawValue < 15
                                ? "text-amber-400"
                                : "text-red-400"
                            : null;
                        return (
                          <td
                            key={`${metric.label}-${item.periodo}`}
                            className={`px-4 py-4 text-center ${
                              isLatest
                                ? "bg-[linear-gradient(180deg,rgba(255,106,0,0.12),rgba(255,106,0,0.05))]"
                                : metricIdx % 2 === 0
                                  ? "bg-white/[0.03]"
                                  : "bg-white/[0.015]"
                            }`}
                          >
                            <span className={`text-sm font-bold tabular-nums ${pctColor ?? "text-[var(--foreground)]"}`}>
                              {metric.render(item)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
