"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricTile, SectionCard, SegmentedControl } from "@/components/ui";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatCompactNumber, mobileTickInterval } from "@/lib/chart-mobile";
import { DollarSign, Target, TrendingUp, Users, Zap, BarChart3, ShoppingCart, ReceiptText, Repeat2, MousePointerClick, MessageCircle, Eye, Activity } from "lucide-react";

const tooltipStyle = {
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

function KpiCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
  accentValue?: boolean;
  tone?: "positive" | "negative";
}) {
  return <MetricTile label={title} value={value} detail={sub} tone={tone} />;
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
  /** Geral e-commerce: os números do topo vêm do consolidado; aqui fica só gráfico e tabela. */
  hideKpis?: boolean;
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
  conversasEngajamentoMode = false,
  miguelImoveisMode = false,
  miguelGoogleMode = false,
  academyEngajamentoMode = false,
  kombuchaMode = false,
  lpViewsMode = false,
  hideKpis = false,
}: DefaultPanelProps) {
  const isMobile = useIsMobile();
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
      {!hideKpis && (
      <>
      {/* KPI cards — modo e-commerce (Granarolo, D'or) */}
      {ecommerceGoogleMode ? (
        <>
          <section className="rel-kpi-grid">
            <KpiCard
              title={canal === "google" ? "Investimento Google" : canal === "meta" ? "Investimento Meta" : "Investimento"}
              value={formatCurrency(resumo.investimento)}
              icon={DollarSign}
            />
            <KpiCard
              title={canal === "google" ? "Compras pelo Google" : canal === "meta" ? "Compras pelo Meta" : "Compras pelos anúncios"}
              value={purchases.toLocaleString("pt-BR")}
              icon={ShoppingCart}
            />
            <KpiCard
              title="Custo por compra"
              value={custoPorCompra > 0 ? formatCurrency(custoPorCompra) : "—"}
              icon={Target}
              accentValue
            />
            <KpiCard
              title="ROAS"
              value={roas > 0 ? `${roas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}
              icon={Repeat2}
              tone={roas <= 0 ? undefined : roas >= 1 ? "positive" : "negative"}
            />
          </section>
          <section className="rel-kpi-grid">
            <KpiCard
              title={canal === "google" ? "Faturamento pelo Google" : canal === "meta" ? "Faturamento pelo Meta" : "Faturamento pelos anúncios"}
              value={valorConversao > 0 ? formatCurrency(valorConversao) : "—"}
              icon={ReceiptText}
            />
            <KpiCard
              title="Ticket médio"
              value={ticketMedio > 0 ? formatCurrency(ticketMedio) : "—"}
              icon={TrendingUp}
            />
          </section>
        </>
      ) : (
        /* KPI cards — modo padrão */
        <section className="rel-kpi-grid">
          <KpiCard
            title={canal === "google" ? "Investimento Google" : "Investimento"}
            value={formatCurrency(resumo.investimento)}
            icon={DollarSign}
          />
          <KpiCard
            title={canal === "google" ? "Conversões Google" : comprasMode ? "Compras" : visitasMode ? "Visitas ao perfil" : miguelImoveisMode ? "Conversas + cadastros" : conversasMode ? "Conversas" : kombuchaMode ? "Adições ao carrinho" : lpViewsMode ? "Views de LP" : "Leads"}
            value={resumo.leads.toLocaleString("pt-BR")}
            icon={Users}
          />
          <KpiCard
            title={canal === "google" ? "Custo / conversão" : comprasMode ? "Custo / compra" : visitasMode ? "Custo / visita" : miguelImoveisMode ? "Custo / resultado" : conversasMode ? "Custo / conversa" : kombuchaMode ? "Custo / carrinho" : lpViewsMode ? "Custo / view LP" : "CPL"}
            value={formatCurrency(resumo.cpl)}
            icon={Target}
            accentValue
          />
          {miguelGoogleMode || miguelImoveisMode ? (
            <KpiCard
              title="Cliques"
              value={(resumo.cliques ?? 0).toLocaleString("pt-BR")}
              icon={MousePointerClick}
            />
          ) : (
            <KpiCard
              title={canal === "google" ? "CPM Google" : "CPM"}
              value={formatCurrency(resumo.cpm)}
              icon={Zap}
            />
          )}
        </section>
      )}

      {/* KPI row extra — modo Miguel Google (CTR + Taxa de Conversão) */}
      {!ecommerceGoogleMode && miguelGoogleMode && (
        <section className="rel-kpi-grid">
          <KpiCard
            title="CTR"
            value={
              (resumo.impressoes ?? 0) > 0
                ? `${(((resumo.cliques ?? 0) / (resumo.impressoes ?? 1)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                : "—"
            }
            icon={BarChart3}
          />
          <KpiCard
            title="Taxa de Conversão"
            value={
              (resumo.cliques ?? 0) > 0
                ? `${((resumo.leads / (resumo.cliques ?? 1)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                : "—"
            }
            icon={Target}
          />
        </section>
      )}

      {/* KPI row extra — modo conversas + engajamento (Clínica e Spa) */}
      {!ecommerceGoogleMode && conversasEngajamentoMode && (
        <section className="rel-kpi-grid">
          <KpiCard
            title="Cliques (Engajamento)"
            value={(resumo.cliques ?? 0).toLocaleString("pt-BR")}
            icon={MousePointerClick}
          />
          <KpiCard
            title="Taxa Clique → Conversa"
            value={
              (resumo.leads ?? 0) > 0 && (resumo.cliques ?? 0) > 0
                ? `${(((resumo.leads ?? 0) / (resumo.cliques ?? 0)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                : "—"
            }
            icon={MessageCircle}
          />
        </section>
      )}

      {/* KPI row extra — breakdown de resultados (Miguel Imóveis) */}
      {!ecommerceGoogleMode && miguelImoveisMode && (
        <section className="rel-kpi-grid">
          <KpiCard
            title="Conversas (Mensagem)"
            value={(resumo.conversasMensagem ?? 0).toLocaleString("pt-BR")}
            icon={MessageCircle}
          />
          <KpiCard
            title="Cadastros (Formulário)"
            value={(resumo.leadsForm ?? 0).toLocaleString("pt-BR")}
            icon={Users}
          />
        </section>
      )}

      {/* KPI row extra — engajamento Instagram (Academy Americana) */}
      {!ecommerceGoogleMode && academyEngajamentoMode && (resumo.profileVisits ?? 0) > 0 && (
        <section className="rel-kpi-grid">
          <KpiCard
            title="Visitas ao Perfil"
            value={(resumo.profileVisits ?? 0).toLocaleString("pt-BR")}
            icon={Eye}
          />
          <KpiCard
            title="Custo / Visita"
            value={
              (resumo.profileVisits ?? 0) > 0
                ? formatCurrency(resumo.custoPorVisita ?? 0)
                : "—"
            }
            icon={Activity}
          />
          <KpiCard
            title="Visitas / 1k impr."
            value={
              (resumo.impressoes ?? 0) > 0
                ? `${(((resumo.profileVisits ?? 0) / (resumo.impressoes ?? 1)) * 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                : "—"
            }
            icon={TrendingUp}
          />
        </section>
      )}

      {/* KPI row extra — Conversas B2B (Kombucha da Cá) */}
      {!ecommerceGoogleMode && kombuchaMode && (resumo.conversasB2b ?? 0) > 0 && (
        <section className="rel-kpi-grid">
          <KpiCard
            title="Conversas B2B (Mensagem)"
            value={(resumo.conversasB2b ?? 0).toLocaleString("pt-BR")}
            icon={MessageCircle}
          />
          <KpiCard
            title="Custo / Conversa B2B"
            value={
              (resumo.conversasB2b ?? 0) > 0
                ? formatCurrency(resumo.custoPorConversaB2b ?? 0)
                : "—"
            }
            icon={Target}
          />
        </section>
      )}
      </>
      )}

      {/* Performance chart */}
      {chartData.length > 0 && (
        <SectionCard
          title={canal === "google" ? "Performance Google" : "Volume geral de performance"}
          subtitle={(() => {
            const periodoLabel = isMensal ? "mês" : isDiario ? "dia" : "semana";
            if (ecommerceGoogleMode) return `Investimento e compras por ${periodoLabel}`;
            if (canal === "google") return `Investimento e conversões por ${periodoLabel}`;
            if (visitasMode) return `Investimento e visitas ao perfil por ${periodoLabel}`;
            if (comprasMode) return `Investimento e compras por ${periodoLabel}`;
            if (miguelImoveisMode) return `Investimento e resultados por ${periodoLabel}`;
            if (conversasMode) return `Investimento e conversas por ${periodoLabel}`;
            if (kombuchaMode) return `Investimento e adições ao carrinho por ${periodoLabel}`;
            if (lpViewsMode) return `Investimento e views de LP por ${periodoLabel}`;
            return `Investimento e leads por ${periodoLabel}`;
          })()}
          action={
            !isMensal && onAgrupamentoChange ? (
              <SegmentedControl
                aria-label="Agrupamento"
                value={isDiario ? "diario" : "semanal"}
                onChange={onAgrupamentoChange}
                options={[
                  { value: "diario", label: "Diário" },
                  { value: "semanal", label: "Semanal" },
                ]}
              />
            ) : undefined
          }
        >
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                  <XAxis
                    dataKey="periodo"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={
                      isMobile
                        ? mobileTickInterval(chartData.length)
                        : isDiario && chartData.length > 14 ? Math.ceil(chartData.length / 14) - 1 : 0
                    }
                    angle={!isMobile && isDiario && chartData.length > 14 ? -45 : 0}
                    textAnchor={!isMobile && isDiario && chartData.length > 14 ? "end" : "middle"}
                    height={!isMobile && isDiario && chartData.length > 14 ? 50 : 30}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 40 : 60}
                    tickFormatter={isMobile ? formatCompactNumber : undefined}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 32 : 60}
                    tickFormatter={isMobile ? formatCompactNumber : undefined}
                  />
                  <YAxis yAxisId="cpl" hide={true} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "Investimento" || name === cplLabel) {
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
                    fill="var(--chart-spend)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={chartConversionKey}
                    name={chartConversionKey}
                    stroke="var(--chart-result)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--chart-result)", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: "var(--chart-result)" }}
                  />
                  <Line yAxisId="cpl" dataKey="CPL" name={cplLabel} stroke="transparent" dot={false} activeDot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
        </SectionCard>
      )}

      {/* Weekly breakdown table */}
      {latestFiveSeries.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 px-4 pb-5 pt-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--chart-current)] text-[var(--primary)]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="type-tagline text-[var(--foreground)]">
                      {canal === "google" ? "Resultado Google" : `Resultado ${canalLabels[canal] ?? canal}`}
                      <span className="ml-2 text-[var(--primary)]">
                        {isMensal ? "mês a mês" : isDiario ? "dia a dia" : "semana a semana"}
                      </span>
                    </h3>
                    <span className="type-micro-legal uppercase text-[var(--muted-foreground)]">
                      {dateFilter.label}
                    </span>
                  </div>
                  <p className="mt-1 type-caption text-[var(--muted-foreground)]">
                    Visão comparativa com leitura rápida das principais métricas por {isMensal ? "mês" : isDiario ? "dia" : "semana"}.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--canvas)] px-3 py-1 type-caption-strong uppercase text-[var(--muted-foreground)]">
                  {latestFiveSeries.length} {isMensal ? "meses" : isDiario ? "dias" : "semanas"}
                </span>
                {latestPeriod && (
                  <span className="rounded-full border border-primary/20 bg-[var(--chart-current)] px-3 py-1 type-caption-strong uppercase text-[var(--primary)]">
                    Atual: {latestPeriod}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
            <div className="overflow-x-auto">
              <table className="table-sticky-first w-full min-w-[860px] border-separate [border-spacing:0_10px]">
                <thead>
                  <tr>
                    <th className="w-[150px] px-3 sm:w-[220px] text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
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
                              className={`type-micro-legal uppercase ${
                                isLatest ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                              }`}
                            >
                              {isLatest ? "Atual" : isMensal ? "Mês" : isDiario ? "Dia" : "Semana"}
                            </span>
                            <span className="type-caption-strong whitespace-nowrap">{s.periodo}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {metricDefinitions.map((metric) => (
                    <tr key={metric.label} className="group">
                      <td className={`rounded-l-2xl px-4 py-4 ${metric.isSubRow ? "bg-[var(--surface-pearl)] pl-7" : "bg-[var(--canvas-parchment)]"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={`font-semibold uppercase tracking-[0.18em] ${metric.isSubRow ? "type-micro-legal text-[var(--muted-foreground)]" : "type-fine-print text-[var(--foreground)]"}`}>
                              {metric.isSubRow ? `↳ ${metric.label}` : metric.label}
                            </p>
                            <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                              {metric.description}
                            </p>
                          </div>
                          {!metric.isSubRow && <span className="hidden h-6 w-[2px] rounded-full bg-primary/30 md:block" />}
                        </div>
                      </td>
                      {latestFiveSeries.map((s: MetricRow & { periodo: string }, periodIdx: number) => {
                        const isLatest = periodIdx === latestFiveSeries.length - 1;
                        return (
                          <td
                            key={`${metric.label}-${s.periodo}`}
                            className={`px-4 py-4 text-center ${isLatest ? "rounded-r-2xl" : ""} ${
                              isLatest
                                ? "border-l-[3px] border-[var(--primary)] bg-[var(--chart-current)]"
                                : metric.isSubRow
                                  ? "bg-[var(--surface-pearl)]"
                                  : "bg-[var(--canvas-parchment)]"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className={`tabular-nums font-semibold ${metric.isSubRow ? "type-fine-print text-[var(--muted-foreground)]" : isLatest ? "type-caption text-[var(--primary)]" : "type-caption text-[var(--foreground)]"}`}>
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
