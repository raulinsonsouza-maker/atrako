"use client";

import { MetricTile, SegmentedControl } from "@/components/ui";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  MousePointerClick,
  Package,
  Percent,
  ShoppingCart,
  Target,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PainelResumo = {
  investimento: number;
  impressoes: number;
  cliques: number;
  purchases: number;
  faturamento: number;
  conversasWhatsapp: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  ticketMedio: number;
  taxaConversaoClique: number;
  alcance?: number;
  checkoutIniciado?: number;
};

type PainelSerie = {
  periodo: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  purchases: number;
  faturamento: number;
  conversasWhatsapp: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  ticketMedio: number;
  taxaConversaoClique: number;
};

type ChannelMixItem = {
  investimento: number;
  purchases: number;
  faturamento: number;
  investimentoShare: number;
  purchasesShare: number;
  faturamentoShare: number;
  roas?: number;
  cpc?: number;
};

type PainelData = {
  periodo: string;
  agrupamento?: "semanal" | "mensal" | "diario";
  resumo: PainelResumo;
  series: PainelSerie[];
  channelMix: {
    meta: ChannelMixItem;
    google: ChannelMixItem;
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

function formatPercentage(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function VarellaTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as
    | {
        Investimento?: number;
        Faturamento?: number;
        Compras?: number;
      }
    | undefined;

  return (
    <div
      className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
    >
      <p className="mb-2 type-caption-strong text-[var(--foreground)]">{label}</p>
      <div className="space-y-2 type-caption">
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-[var(--primary)]">Faturamento</span>
          <span className="font-semibold text-[var(--primary)]">
            {formatCurrency(Number(point?.Faturamento ?? 0))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-[var(--muted-foreground)]">Investimento</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatCurrency(Number(point?.Investimento ?? 0))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-positive">Compras</span>
          <span className="font-semibold text-positive">
            {formatInteger(Number(point?.Compras ?? 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

function VarellaKpi({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
  icon?: React.ElementType;
  accent?: boolean;
}) {
  return <MetricTile label={title} value={value} detail={sub} />;
}

export function VarellaMotosPanel({
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
  const chartData = data.series.map((item) => ({
    periodo: item.periodo,
    Investimento: Number(item.investimento.toFixed(2)),
    Faturamento: Number(item.faturamento.toFixed(2)),
    Compras: item.purchases,
  }));
  const topRevenueWeek = [...data.series].sort((a, b) => b.faturamento - a.faturamento)[0];
  const topRoasWeek = [...data.series].sort((a, b) => b.roas - a.roas)[0];
  const topSalesWeek = [...data.series].sort((a, b) => b.purchases - a.purchases)[0];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <VarellaKpi
          title="Faturamento"
          value={formatCurrency(data.resumo.faturamento)}
          sub={`${data.periodo} selecionados`}
          icon={BadgeDollarSign}
          accent
        />
        <VarellaKpi
          title="Investimento"
          value={formatCurrency(data.resumo.investimento)}
          sub="Valor investido total"
          icon={Wallet}
        />
        <VarellaKpi
          title="Compras"
          value={formatInteger(data.resumo.purchases)}
          sub={`Canal ${canalLabel}`}
          icon={ShoppingCart}
        />
        <VarellaKpi
          title="ROAS"
          value={`${data.resumo.roas.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}x`}
          sub="Receita por real investido"
          icon={Target}
        />
        <VarellaKpi
          title="CPA"
          value={formatCurrency(data.resumo.cpa)}
          sub="Custo por compra"
          icon={Target}
        />
        <VarellaKpi
          title="Ticket médio"
          value={formatCurrency(data.resumo.ticketMedio)}
          sub="Valor médio por compra"
          icon={Package}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="type-tagline text-[var(--foreground)]">
                  Performance de e-commerce
                </h3>
                <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                  {isMensal
                    ? "Comparativo mensal entre investimento e faturamento, com destaque para compras."
                    : isDiario
                      ? "Comparativo diário entre investimento e faturamento, com destaque para compras."
                      : "Comparativo semanal entre investimento e faturamento, com destaque para compras."}
                </p>
              </div>
              {!isMensal && onAgrupamentoChange && (
                <SegmentedControl
                  aria-label="Agrupamento"
                  value={isDiario ? "diario" : "semanal"}
                  onChange={onAgrupamentoChange}
                  options={[
                    { value: "diario", label: "Diário" },
                    { value: "semanal", label: "Semanal" },
                  ]}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-muted/20 px-3 py-1 type-caption-strong text-[var(--muted-foreground)]">
                <span className="h-2 w-2 rounded-full bg-[var(--chart-spend)]" />
                Investimento
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-muted/20 px-3 py-1 type-caption-strong text-[var(--muted-foreground)]">
                <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                Faturamento
              </span>
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 type-caption-strong text-[var(--foreground)]">
                {formatInteger(data.resumo.purchases)} compras no período
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
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
                    yAxisId="money"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`}
                  />
                  <Tooltip content={<VarellaTooltip />} />
                  <Bar
                    yAxisId="money"
                    dataKey="Investimento"
                    fill="var(--chart-spend)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    yAxisId="money"
                    type="monotone"
                    dataKey="Faturamento"
                    stroke="var(--chart-result)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--chart-result)", r: 3.5, strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      fill: "var(--chart-result)",
                      stroke: "var(--canvas)",
                      strokeWidth: 2,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  {isMensal ? "Maior faturamento mensal" : isDiario ? "Maior faturamento diário" : "Maior faturamento semanal"}
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {topRevenueWeek ? formatCurrency(topRevenueWeek.faturamento) : "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {topRevenueWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  {isMensal ? "Melhor ROAS mensal" : isDiario ? "Melhor ROAS diário" : "Melhor ROAS semanal"}
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {topRoasWeek
                    ? `${topRoasWeek.roas.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}x`
                    : "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {topRoasWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  Pico de compras
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {topSalesWeek ? formatInteger(topSalesWeek.purchases) : "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {topSalesWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div>
              <h3 className="type-tagline text-[var(--foreground)]">
                Eficiência da mídia
              </h3>
              <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                Funil de conversão: alcance, impressões, cliques, checkout e compras.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <p className="mb-4 type-caption-strong uppercase text-[var(--foreground)]">
                Funil de mídia
              </p>
              <div className="flex flex-col gap-2">
                {[
                  {
                    label: "Alcance",
                    value: data.resumo.alcance ?? 0,
                    widthPct: 100,
                  },
                  {
                    label: "Impressões",
                    value: data.resumo.impressoes,
                    widthPct: 85,
                  },
                  {
                    label: "Cliques",
                    value: data.resumo.cliques,
                    widthPct: 55,
                  },
                  {
                    label: "Checkout iniciado",
                    value: Math.max(
                      data.resumo.checkoutIniciado ?? 0,
                      data.resumo.purchases
                    ),
                    widthPct: 28,
                  },
                  {
                    label: "Compras",
                    value: data.resumo.purchases,
                    widthPct: 18,
                  },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="relative flex items-center justify-between overflow-hidden rounded-xl border border-[var(--border)] px-4 py-3"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-l-xl bg-primary/12"
                      style={{ width: `${step.widthPct}%` }}
                    />
                    <p className="relative z-10 type-caption-strong uppercase text-[var(--muted-foreground)]">
                      {step.label}
                    </p>
                    <p className="relative z-10 type-tagline tabular-nums text-[var(--foreground)]">
                      {step.value > 0 ? formatInteger(step.value) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Cliques",
            value: formatInteger(data.resumo.cliques),
            icon: MousePointerClick,
          },
          {
            label: "Compras",
            value: formatInteger(data.resumo.purchases),
            icon: ShoppingCart,
          },
          {
            label: "Ticket médio",
            value: formatCurrency(data.resumo.ticketMedio),
            icon: BadgeDollarSign,
          },
          {
            label: "Taxa conv.",
            value: formatPercentage(data.resumo.taxaConversaoClique),
            icon: Percent,
          },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-[var(--primary)]">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  {item.label}
                </p>
                <p className="mt-1 type-tagline text-[var(--foreground)]">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {([
          ["META", data.channelMix.meta],
          ["Google", data.channelMix.google],
        ] as const).map(([label, mix]) => (
          <Card key={label} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div>
                <h3 className="type-tagline text-[var(--foreground)]">
                  Mix de canal · {label}
                </h3>
                <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                  Participação do canal no consolidado do período.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  Investimento
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {formatCurrency(mix.investimento)}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {formatPercentage(mix.investimentoShare)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  Compras
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {formatInteger(mix.purchases)}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {formatPercentage(mix.purchasesShare)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  Faturamento
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {formatCurrency(mix.faturamento)}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {formatPercentage(mix.faturamentoShare)}
                </p>
              </div>
              {mix.roas != null && (
                <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                  <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                    ROAS
                  </p>
                  <p className="mt-2 type-tagline text-[var(--foreground)]">
                    {mix.roas.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    x
                  </p>
                </div>
              )}
              {mix.cpc != null && (
                <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                  <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                    CPC
                  </p>
                  <p className="mt-2 type-tagline text-[var(--foreground)]">
                    {formatCurrency(mix.cpc)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {latestFiveSeries.length > 0 && (
        <Card className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--canvas)]">
          <CardHeader className="border-b border-border/60 px-6 pb-5 pt-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="type-tagline uppercase text-[var(--foreground)] ">
                  Resultado comercial
                  <span className="ml-2 text-primary">
                    {isMensal ? "Mês a mês" : isDiario ? "Dia a dia" : "Semana a semana"}
                  </span>
                </h3>
                <p className="mt-1 type-caption text-[var(--muted-foreground)]">
                  {isDiario ? "Leitura focada em receita, compras e eficiência por dia." : isMensal ? "Leitura focada em receita, compras e eficiência por mês." : "Leitura focada em receita, compras e eficiência por semana."}
                </p>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/12 px-3 py-1 type-caption-strong uppercase text-[var(--foreground)]">
                {latestFiveSeries.length} {isMensal ? "meses" : isDiario ? "dias" : "semanas"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate [border-spacing:0_10px]">
                <thead>
                  <tr>
                    <th className="w-[220px] px-3 text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
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
                              className={`type-micro-legal uppercase ${
                                isLatest ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                              }`}
                            >
                              {isLatest ? "Atual" : isDiario ? "Dia" : isMensal ? "Mês" : "Semana"}
                            </span>
                            <span className="type-caption-strong whitespace-nowrap">{item.periodo}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Investimento", render: (item: PainelSerie) => formatCurrency(item.investimento) },
                    { label: "Cliques", render: (item: PainelSerie) => formatInteger(item.cliques) },
                    { label: "Compras", render: (item: PainelSerie) => formatInteger(item.purchases) },
                    { label: "Faturamento", render: (item: PainelSerie) => formatCurrency(item.faturamento) },
                    {
                      label: "ROAS",
                      render: (item: PainelSerie) =>
                        `${item.roas.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}x`,
                    },
                    { label: "CPA", render: (item: PainelSerie) => formatCurrency(item.cpa) },
                    { label: "Ticket médio", render: (item: PainelSerie) => formatCurrency(item.ticketMedio) },
                    { label: "CTR", render: (item: PainelSerie) => formatPercentage(item.ctr) },
                    {
                      label: "Taxa conv.",
                      render: (item: PainelSerie) => formatPercentage(item.taxaConversaoClique),
                    },
                  ].map((metric, metricIdx) => (
                    <tr key={metric.label}>
                      <td className="rounded-l-2xl bg-[var(--muted)] px-4 py-4">
                        <p className="type-caption-strong uppercase text-[var(--foreground)]">
                          {metric.label}
                        </p>
                      </td>
                      {latestFiveSeries.map((item, index) => {
                        const isLatest = index === latestFiveSeries.length - 1;
                        return (
                          <td
                            key={`${metric.label}-${item.periodo}`}
                            className={`px-4 py-4 text-center ${
                              isLatest
                                ? "bg-primary/[0.06]"
                                : metricIdx % 2 === 0
                                  ? "bg-[var(--muted)]"
                                  : "bg-muted/50"
                            }`}
                          >
                            <span className="type-caption-strong tabular-nums text-[var(--foreground)]">
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
