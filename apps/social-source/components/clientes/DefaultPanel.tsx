"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { DollarSign, Target, TrendingUp, Users, Zap, BarChart3, ShoppingCart, ReceiptText, Repeat2, MousePointerClick, MessageCircle, Eye, Activity } from "lucide-react";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accentValue,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accentValue?: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-2xl border-[var(--border)] transition-all hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.05]" />
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {title}
          </p>
          <p
            className={`mt-1 text-2xl font-extrabold tabular-nums leading-none ${
              accentValue ? "text-[var(--primary)]" : "text-[var(--foreground)]"
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

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">{title}</h2>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p>
    </div>
  );
}

type MetricRow = { investimento: number; leads: number; conversas?: number; impressoes: number; cliques: number; purchases?: number };

type MetricDefinition = {
  label: string;
  description: string;
  value: (s: MetricRow) => number;
  format: (value: number) => string;
  isSubRow?: boolean;
};

type DefaultPanelProps = {
  resumo: {
    investimento: number;
    leads: number;
    cpl: number;
    cpm: number;
    periodo?: string;
    purchases?: number;
    valorConversao?: number;
    custoPorCompra?: number;
    roas?: number;
    ticketMedio?: number;
    cliques?: number;
    impressoes?: number;
    conversasMensagem?: number;
    leadsForm?: number;
    profileVisits?: number;
    custoPorVisita?: number;
    conversasB2b?: number;
    custoPorConversaB2b?: number;
  };
  chartData: Record<string, string | number>[];
  /** Nome da série de conversões/leads no gráfico (ex.: "Conversões" no Google). */
  chartConversionKey?: string;
  latestFiveSeries: (MetricRow & { periodo: string })[];
  metricDefinitions: MetricDefinition[];
  dateFilter: { label: string };
  canal: string;
  canalLabels: Record<string, string>;
  formatCurrency: (value: number) => string;
  /** Quando true, troca labels de Leads/CPL para Conversas/Custo por Conversa */
  conversasMode?: boolean;
  /** Quando true, troca labels de Leads/CPL para Compras/Custo por Compra */
  comprasMode?: boolean;
  /** Quando true, troca labels de Leads/CPL para Visitas/Custo por Visita */
  visitasMode?: boolean;
  /** Quando true (e-commerce no Google), exibe ROAS, compras, faturamento e ticket médio */
  ecommerceGoogleMode?: boolean;
  /** "diario", "semanal" (padrão) ou "mensal" — controla títulos do gráfico e da tabela */
  agrupamento?: "diario" | "semanal" | "mensal";
  /** Callback para alternar agrupamento (não disponível em modo mensal) */
  onAgrupamentoChange?: (ag: "diario" | "semanal") => void;
  /** Chave de faturamento no chartData (ex.: "Faturamento"). Quando definido, adiciona linha verde ao gráfico. */
  chartRevenueKey?: string;
  /** Quando true (Clínica e Spa), exibe 2ª linha de KPIs com Cliques e Taxa Conversa (engajamento). */
  conversasEngajamentoMode?: boolean;
  /** Quando true (Miguel Imóveis), exibe KPIs de Resultados totais + 2ª linha com breakdown Conversas vs Cadastros. */
  miguelImoveisMode?: boolean;
  /** Quando true (Miguel Imóveis canal Google), substitui CPM por Cliques e exibe linha extra com CTR e Taxa de Conversão. */
  miguelGoogleMode?: boolean;
  /** Quando true (Academy Americana), exibe linha extra de engajamento com Visitas ao Perfil e Custo por Visita. */
  academyEngajamentoMode?: boolean;
  /** Quando true (Kombucha da Cá), usa labels de "Carrinho" e mostra card secundário de Conversas B2B. */
  kombuchaMode?: boolean;
  /** Quando true (Be Blue School), usa labels de "View de LP" e mostra custo por view de LP. */
  lpViewsMode?: boolean;
};

export function DefaultPanel({
  resumo,
  chartData,
  chartConversionKey = "Leads",
  latestFiveSeries,
  metricDefinitions,
  dateFilter,
  canal,
  canalLabels,
  formatCurrency,
  conversasMode = false,
  comprasMode = false,
  visitasMode = false,
  ecommerceGoogleMode = false,
  agrupamento = "semanal",
  onAgrupamentoChange,
  chartRevenueKey,
  conversasEngajamentoMode = false,
  miguelImoveisMode = false,
  miguelGoogleMode = false,
  academyEngajamentoMode = false,
  kombuchaMode = false,
  lpViewsMode = false,
}: DefaultPanelProps) {
  const isMensal = agrupamento === "mensal";
  const isDiario = agrupamento === "diario";
  const latestPeriod = latestFiveSeries[latestFiveSeries.length - 1]?.periodo;
  const cplLabel = visitasMode ? "Custo/Visita" : comprasMode ? "Custo/Compra" : miguelImoveisMode ? "Custo/Result." : conversasMode ? "Custo/Conv." : kombuchaMode ? "Custo/Carrinho" : lpViewsMode ? "Custo/View LP" : "CPL";

  const purchases = resumo.purchases ?? 0;
  const valorConversao = resumo.valorConversao ?? 0;
  const custoPorCompra = resumo.custoPorCompra ?? 0;
  const roas = resumo.roas ?? 0;
  const ticketMedio = resumo.ticketMedio ?? 0;

  return (
    <>
      {/* KPI cards — modo e-commerce (Granarolo, D'or) */}
      {ecommerceGoogleMode ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title={canal === "google" ? "Investimento Google" : canal === "meta" ? "Investimento Meta" : "Investimento Total"}
              value={formatCurrency(resumo.investimento)}
              sub={`${resumo.periodo ?? ""} selecionados`}
              icon={DollarSign}
            />
            <KpiCard
              title="Compras no Site"
              value={purchases.toLocaleString("pt-BR")}
              sub={canal === "geral" ? "Pedidos atribuídos (Google + Meta) no período" : canal === "meta" ? "Pedidos atribuídos às campanhas Meta no período" : "Pedidos atribuídos às campanhas Google no período"}
              icon={ShoppingCart}
            />
            <KpiCard
              title="Custo por Compra"
              value={custoPorCompra > 0 ? formatCurrency(custoPorCompra) : "—"}
              sub="Investimento ÷ compras atribuídas"
              icon={Target}
              accentValue
            />
            <KpiCard
              title="ROAS"
              value={roas > 0 ? `${roas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}
              sub="Retorno sobre investimento em anúncios (receita ÷ custo)"
              icon={Repeat2}
            />
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <KpiCard
              title="Faturamento (Valor Conv.)"
              value={valorConversao > 0 ? formatCurrency(valorConversao) : "—"}
              sub={canal === "geral" ? "Receita de compras atribuída (Google + Meta) no período" : canal === "meta" ? "Receita de compras atribuída às campanhas Meta no período" : "Receita de compras atribuída às campanhas Google no período"}
              icon={ReceiptText}
            />
            <KpiCard
              title="Ticket Médio"
              value={ticketMedio > 0 ? formatCurrency(ticketMedio) : "—"}
              sub="Valor médio por pedido (faturamento ÷ compras)"
              icon={TrendingUp}
            />
          </section>
        </>
      ) : (
        /* KPI cards — modo padrão */
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title={canal === "google" ? "Investimento Google" : "Investimento"}
            value={formatCurrency(resumo.investimento)}
            sub={`${resumo.periodo ?? ""} selecionados`}
            icon={DollarSign}
          />
          <KpiCard
            title={canal === "google" ? "Conversões (Google Ads)" : comprasMode ? "Compras" : visitasMode ? "Visitas ao perfil" : miguelImoveisMode ? "Resultados (Total)" : conversasMode ? "Conversas" : kombuchaMode ? "Adições ao Carrinho" : lpViewsMode ? "Views de LP" : "Leads"}
            value={resumo.leads.toLocaleString("pt-BR")}
            sub={
              canal === "google"
                ? "Total do período (métrica principal do relatório de campanhas)"
                : comprasMode
                  ? "Compras no site atribuídas ao período"
                  : visitasMode
                    ? "Visitas ao perfil do Instagram no período"
                    : miguelImoveisMode
                      ? "Conversas iniciadas + cadastros via formulário no período"
                      : conversasMode
                        ? "Conversas por mensagem iniciadas no período"
                        : kombuchaMode
                          ? "Adições ao carrinho atribuídas ao período"
                          : lpViewsMode
                            ? "Visualizações da página de destino no período"
                            : "Total do período"
            }
            icon={Users}
          />
          <KpiCard
            title={canal === "google" ? "Custo / conversão" : comprasMode ? "Custo / Compra" : visitasMode ? "Custo / Visita" : miguelImoveisMode ? "Custo / Resultado" : conversasMode ? "Custo / Conversa" : kombuchaMode ? "Custo / Carrinho" : lpViewsMode ? "Custo / View LP" : "CPL"}
            value={formatCurrency(resumo.cpl)}
            sub={canal === "google" ? "Investimento ÷ conversões" : comprasMode ? "Investimento ÷ compras no site" : visitasMode ? "Investimento ÷ visitas ao perfil" : miguelImoveisMode ? "Investimento ÷ total de resultados (conversas + cadastros)" : conversasMode ? "Investimento ÷ conversas iniciadas" : kombuchaMode ? "Investimento ÷ adições ao carrinho" : lpViewsMode ? "Investimento ÷ views da página de destino" : "Custo por lead"}
            icon={Target}
            accentValue
          />
          {miguelGoogleMode ? (
            <KpiCard
              title="Cliques"
              value={(resumo.cliques ?? 0).toLocaleString("pt-BR")}
              sub="Total de cliques nos anúncios de pesquisa no período"
              icon={MousePointerClick}
            />
          ) : miguelImoveisMode ? (
            <KpiCard
              title="Cliques"
              value={(resumo.cliques ?? 0).toLocaleString("pt-BR")}
              sub="Total de cliques gerados pelos anúncios no período (Meta + Google)"
              icon={MousePointerClick}
            />
          ) : (
            <KpiCard
              title={canal === "google" ? "CPM Google" : "CPM"}
              value={formatCurrency(resumo.cpm)}
              sub="Custo por mil impressões"
              icon={Zap}
            />
          )}
        </section>
      )}

      {/* KPI row extra — modo Miguel Google (CTR + Taxa de Conversão) */}
      {!ecommerceGoogleMode && miguelGoogleMode && (
        <section className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="CTR (Cliques / Impressões)"
            value={
              (resumo.impressoes ?? 0) > 0
                ? `${(((resumo.cliques ?? 0) / (resumo.impressoes ?? 1)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                : "—"
            }
            sub="Percentual de impressões que geraram cliques nos anúncios"
            icon={BarChart3}
          />
          <KpiCard
            title="Taxa de Conversão"
            value={
              (resumo.cliques ?? 0) > 0
                ? `${((resumo.leads / (resumo.cliques ?? 1)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                : "—"
            }
            sub="Percentual de cliques que resultaram em conversões (formulários, chamadas, contatos)"
            icon={Target}
          />
        </section>
      )}

      {/* KPI row extra — modo conversas + engajamento (Clínica e Spa) */}
      {!ecommerceGoogleMode && conversasEngajamentoMode && (
        <section className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="Cliques (Engajamento)"
            value={(resumo.cliques ?? 0).toLocaleString("pt-BR")}
            sub="Total de interações geradas pelos anúncios no período"
            icon={MousePointerClick}
          />
          <KpiCard
            title="Taxa Clique → Conversa"
            value={
              (resumo.leads ?? 0) > 0 && (resumo.cliques ?? 0) > 0
                ? `${(((resumo.leads ?? 0) / (resumo.cliques ?? 0)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                : "—"
            }
            sub="Percentual de cliques que converteram em conversas iniciadas"
            icon={MessageCircle}
          />
        </section>
      )}

      {/* KPI row extra — breakdown de resultados (Miguel Imóveis) */}
      {!ecommerceGoogleMode && miguelImoveisMode && (
        <section className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="Conversas (Mensagem)"
            value={(resumo.conversasMensagem ?? 0).toLocaleString("pt-BR")}
            sub="WhatsApp e mensagens diretas iniciadas no período"
            icon={MessageCircle}
          />
          <KpiCard
            title="Cadastros (Formulário)"
            value={(resumo.leadsForm ?? 0).toLocaleString("pt-BR")}
            sub="Leads via formulário e contato no site no período"
            icon={Users}
          />
        </section>
      )}

      {/* KPI row extra — engajamento Instagram (Academy Americana) */}
      {!ecommerceGoogleMode && academyEngajamentoMode && (resumo.profileVisits ?? 0) > 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            title="Visitas ao Perfil"
            value={(resumo.profileVisits ?? 0).toLocaleString("pt-BR")}
            sub="Visitas ao perfil do Instagram atribuídas às campanhas de engajamento"
            icon={Eye}
          />
          <KpiCard
            title="Custo / Visita"
            value={
              (resumo.profileVisits ?? 0) > 0
                ? formatCurrency(resumo.custoPorVisita ?? 0)
                : "—"
            }
            sub="Investimento dividido pelo total de visitas ao perfil do Instagram"
            icon={Activity}
          />
          <KpiCard
            title="Visitas / 1k impr."
            value={
              (resumo.impressoes ?? 0) > 0
                ? `${(((resumo.profileVisits ?? 0) / (resumo.impressoes ?? 1)) * 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                : "—"
            }
            sub="Taxa de entrega de visitas por mil impressões (eficiência de engajamento)"
            icon={TrendingUp}
          />
        </section>
      )}

      {/* KPI row extra — Conversas B2B (Kombucha da Cá) */}
      {!ecommerceGoogleMode && kombuchaMode && (resumo.conversasB2b ?? 0) > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="Conversas B2B (Mensagem)"
            value={(resumo.conversasB2b ?? 0).toLocaleString("pt-BR")}
            sub="Conversas iniciadas via mensagem pelas campanhas B2B no período"
            icon={MessageCircle}
          />
          <KpiCard
            title="Custo / Conversa B2B"
            value={
              (resumo.conversasB2b ?? 0) > 0
                ? formatCurrency(resumo.custoPorConversaB2b ?? 0)
                : "—"
            }
            sub="Investimento ÷ conversas B2B iniciadas"
            icon={Target}
          />
        </section>
      )}

      {/* Performance chart */}
      {chartData.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              {(() => {
                const periodoLabel = isMensal ? "mês" : isDiario ? "dia" : "semana";
                return (
                  <SectionHeader
                    title={canal === "google" ? "Performance Google" : "Volume geral de performance"}
                    subtitle={
                      ecommerceGoogleMode
                        ? `Investimento e compras por ${periodoLabel}`
                        : canal === "google"
                        ? `Investimento e conversões por ${periodoLabel}`
                        : visitasMode
                          ? `Investimento e visitas ao perfil por ${periodoLabel}`
                          : comprasMode
                            ? `Investimento e compras por ${periodoLabel}`
                            : miguelImoveisMode
                              ? `Investimento e resultados por ${periodoLabel}`
                              : conversasMode
                              ? `Investimento e conversas por ${periodoLabel}`
                              : kombuchaMode
                              ? `Investimento e adições ao carrinho por ${periodoLabel}`
                              : lpViewsMode
                              ? `Investimento e views de LP por ${periodoLabel}`
                              : `Investimento e leads por ${periodoLabel}`
                    }
                  />
                );
              })()}
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
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
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
                  <YAxis
                    yAxisId="left"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  {chartRevenueKey && <YAxis yAxisId="revenue" hide={true} />}
                  <YAxis yAxisId="cpl" hide={true} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "Investimento" || name === cplLabel || name === chartRevenueKey) {
                        return [formatCurrency(Number(value)), name];
                      }
                      return [Number(value).toLocaleString("pt-BR"), name];
                    }}
                    {...tooltipStyle}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="Investimento"
                    fill="url(#barGrad)"
                    radius={[6, 6, 0, 0]}
                  />
                  {chartRevenueKey && (
                    <Line
                      yAxisId="revenue"
                      type="monotone"
                      dataKey={chartRevenueKey}
                      name={chartRevenueKey}
                      stroke="none"
                      dot={false}
                      activeDot={false}
                      legendType="none"
                    />
                  )}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={chartConversionKey}
                    name={chartConversionKey}
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--primary)", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
                  />
                  <Line yAxisId="cpl" dataKey="CPL" name={cplLabel} stroke="transparent" dot={false} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly breakdown table */}
      {latestFiveSeries.length > 0 && (
        <Card className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <CardHeader className="border-b border-[var(--border)]/60 px-6 pb-5 pt-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--primary))] text-white shadow-[0_12px_30px_rgba(220,38,38,0.25)]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] sm:text-2xl">
                      {canal === "google" ? "Resultado Google" : `Resultado ${canalLabels[canal] ?? canal}`}
                      <span className="ml-2 bg-[linear-gradient(90deg,var(--accent),var(--primary))] bg-clip-text text-transparent">
                        {isMensal ? "Mês a mês" : isDiario ? "Dia a dia" : "Semana a semana"}
                      </span>
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                      {dateFilter.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Visão comparativa com leitura rápida das principais métricas por {isMensal ? "mês" : isDiario ? "dia" : "semana"}.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {latestFiveSeries.length} {isMensal ? "meses" : isDiario ? "dias" : "semanas"}
                </span>
                {latestPeriod && (
                  <span className="rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground)]">
                    Atual: {latestPeriod}
                  </span>
                )}
              </div>
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
                    {latestFiveSeries.map((s: { periodo: string }, periodIdx: number) => {
                      const isLatest = periodIdx === latestFiveSeries.length - 1;
                      return (
                        <th
                          key={s.periodo}
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
                              {isLatest ? "Atual" : isMensal ? "Mês" : isDiario ? "Dia" : "Semana"}
                            </span>
                            <span className="text-sm font-semibold whitespace-nowrap">{s.periodo}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {metricDefinitions.map((metric, metricIdx) => (
                    <tr key={metric.label} className="group">
                      <td className={`rounded-l-2xl px-4 py-4 ${metric.isSubRow ? "bg-white/[0.015] pl-7" : "bg-white/[0.03]"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={`font-bold uppercase tracking-[0.18em] ${metric.isSubRow ? "text-[10px] text-[var(--muted-foreground)]" : "text-[11px] text-[var(--foreground)]"}`}>
                              {metric.isSubRow ? `↳ ${metric.label}` : metric.label}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                              {metric.description}
                            </p>
                          </div>
                          {!metric.isSubRow && <span className="hidden h-6 w-[2px] rounded-full bg-[linear-gradient(180deg,var(--accent),var(--primary))] opacity-70 md:block" />}
                        </div>
                      </td>
                      {latestFiveSeries.map((s: MetricRow & { periodo: string }, periodIdx: number) => {
                        const isLatest = periodIdx === latestFiveSeries.length - 1;
                        return (
                          <td
                            key={`${metric.label}-${s.periodo}`}
                            className={`px-4 py-4 text-center ${
                              isLatest
                                ? "bg-[linear-gradient(180deg,rgba(255,106,0,0.12),rgba(255,106,0,0.05))]"
                                : metric.isSubRow
                                  ? "bg-white/[0.015]"
                                  : metricIdx % 2 === 0
                                    ? "bg-white/[0.03]"
                                    : "bg-white/[0.015]"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className={`tabular-nums font-bold ${metric.isSubRow ? "text-xs text-[var(--muted-foreground)]" : "text-sm text-[var(--foreground)]"}`}>
                                {metric.format(metric.value(s))}
                              </span>
                            </div>
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

    </>
  );
}
