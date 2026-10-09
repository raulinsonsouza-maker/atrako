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
  MessageSquareMore,
  MousePointerClick,
  PackageCheck,
  Percent,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PainelResumo = {
  investimento: number;
  impressoes: number;
  cliquesDelivery: number;
  conversasWhatsapp: number;
  leadsFormulario: number;
  intencoesPedido: number;
  ctr: number;
  cpcDelivery: number;
  custoPorConversa: number;
  custoPorIntencao: number;
  shareWhatsapp: number;
  shareDelivery: number;
};

type PainelSerie = {
  periodo: string;
  investimento: number;
  impressoes: number;
  cliquesDelivery: number;
  conversasWhatsapp: number;
  leadsFormulario: number;
  intencoesPedido: number;
  ctr: number;
  cpcDelivery: number;
  custoPorConversa: number;
  custoPorIntencao: number;
  shareWhatsapp: number;
  shareDelivery: number;
};

type PainelData = {
  periodo: string;
  agrupamento?: "semanal" | "mensal" | "diario";
  resumo: PainelResumo;
  series: PainelSerie[];
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

function TertuliaTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as
    | {
        Investimento?: number;
        CliquesDelivery?: number;
        ConversasWhatsapp?: number;
        IntencoesPedido?: number;
      }
    | undefined;

  return (
    <div
      className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
    >
      <p className="mb-2 type-caption-strong text-[var(--foreground)]">{label}</p>
      <div className="space-y-2 type-caption">
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-[var(--primary)]">Intenções de pedido</span>
          <span className="font-semibold text-[var(--primary)]">
            {formatInteger(Number(point?.IntencoesPedido ?? 0))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-foreground/80">Cliques delivery</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatInteger(Number(point?.CliquesDelivery ?? 0))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-foreground/80">Conversas WhatsApp</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatInteger(Number(point?.ConversasWhatsapp ?? 0))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="font-semibold text-foreground/80">Investimento</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatCurrency(Number(point?.Investimento ?? 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

function TertuliaKpi({
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

export function TertuliaPanel({
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
    CliquesDelivery: item.cliquesDelivery,
    ConversasWhatsapp: item.conversasWhatsapp,
    IntencoesPedido: item.intencoesPedido,
  }));
  const topClicksWeek = [...data.series].sort((a, b) => b.cliquesDelivery - a.cliquesDelivery)[0];
  const topWhatsappWeek = [...data.series].sort(
    (a, b) => b.conversasWhatsapp - a.conversasWhatsapp
  )[0];
  const topIntentWeek = [...data.series].sort((a, b) => b.intencoesPedido - a.intencoesPedido)[0];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <TertuliaKpi
          title="Investimento"
          value={formatCurrency(data.resumo.investimento)}
          sub={`${data.periodo} selecionados`}
          icon={Wallet}
        />
        <TertuliaKpi
          title="Cliques delivery"
          value={formatInteger(data.resumo.cliquesDelivery)}
          sub="Saídas para iFood / delivery"
          icon={MousePointerClick}
        />
        <TertuliaKpi
          title="Conversas WhatsApp"
          value={formatInteger(data.resumo.conversasWhatsapp)}
          sub={`Canal ${canalLabel}`}
          icon={MessageSquareMore}
        />
        <TertuliaKpi
          title="Intenções de pedido"
          value={formatInteger(data.resumo.intencoesPedido)}
          sub="Cliques delivery + mensagens"
          icon={ShoppingBag}
          accent
        />
        <TertuliaKpi
          title="Custo por intenção"
          value={formatCurrency(data.resumo.custoPorIntencao)}
          sub="Eficiência da mídia"
          icon={PackageCheck}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="type-tagline text-[var(--foreground)]">
                  Intenção de pedido
                </h3>
                <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                  {isMensal
                    ? "Leitura mensal de cliques para delivery e conversas que viram pedidos via WhatsApp."
                    : isDiario
                      ? "Leitura diária de cliques para delivery e conversas que viram pedidos via WhatsApp."
                      : "Leitura semanal de cliques para delivery e conversas que viram pedidos via WhatsApp."}
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
                Intenções de pedido
              </span>
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 type-caption-strong text-[var(--foreground)]">
                {formatInteger(data.resumo.cliquesDelivery)} cliques e{" "}
                {formatInteger(data.resumo.conversasWhatsapp)} conversas
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
                  <YAxis
                    yAxisId="volume"
                    orientation="right"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<TertuliaTooltip />} />
                  <Bar
                    yAxisId="money"
                    dataKey="Investimento"
                    fill="var(--chart-spend)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="IntencoesPedido"
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
                  Pico de cliques delivery
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {topClicksWeek ? formatInteger(topClicksWeek.cliquesDelivery) : "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {topClicksWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  Pico de WhatsApp
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {topWhatsappWeek ? formatInteger(topWhatsappWeek.conversasWhatsapp) : "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {topWhatsappWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
                <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                  Maior volume total
                </p>
                <p className="mt-2 type-tagline text-[var(--foreground)]">
                  {topIntentWeek ? formatInteger(topIntentWeek.intencoesPedido) : "—"}
                </p>
                <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">
                  {topIntentWeek?.periodo ?? "Sem dados"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="type-tagline text-[var(--foreground)]">
                  Eficiência operacional
                </h3>
                <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                  O que o tráfego está gerando em intenção de compra.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
              <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                CTR do período
              </p>
              <p className="mt-2 type-tagline text-[var(--foreground)]">
                {formatPercentage(data.resumo.ctr)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
              <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                CPC delivery
              </p>
              <p className="mt-2 type-tagline text-[var(--foreground)]">
                {formatCurrency(data.resumo.cpcDelivery)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
              <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                Custo por conversa
              </p>
              <p className="mt-2 type-tagline text-[var(--foreground)]">
                {formatCurrency(data.resumo.custoPorConversa)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-muted/20 p-4">
              <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
                Share WhatsApp
              </p>
              <p className="mt-2 type-tagline text-[var(--foreground)]">
                {formatPercentage(data.resumo.shareWhatsapp)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Cliques delivery",
            value: formatInteger(data.resumo.cliquesDelivery),
            icon: MousePointerClick,
          },
          {
            label: "Conversas WhatsApp",
            value: formatInteger(data.resumo.conversasWhatsapp),
            icon: MessageSquareMore,
          },
          {
            label: "Leads em formulário",
            value: formatInteger(data.resumo.leadsFormulario),
            icon: PackageCheck,
          },
          {
            label: "Share delivery",
            value: formatPercentage(data.resumo.shareDelivery),
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

      {latestFiveSeries.length > 0 && (
        <Card className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--canvas)]">
          <CardHeader className="border-b border-border/60 px-6 pb-5 pt-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="type-tagline uppercase text-[var(--foreground)] ">
                  Operação de pedidos
                  <span className="ml-2 text-primary">
                    {isMensal ? "Mês a mês" : isDiario ? "Dia a dia" : "Semana a semana"}
                  </span>
                </h3>
                <p className="mt-1 type-caption text-[var(--muted-foreground)]">
                  Leitura das duas frentes que importam para a Tertúlia: delivery e WhatsApp.
                </p>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/12 px-3 py-1 type-caption-strong uppercase text-[var(--foreground)]">
                {latestFiveSeries.length} {isMensal ? "meses" : isDiario ? "dias" : "semanas"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate [border-spacing:0_10px]">
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
                    {
                      label: "Cliques delivery",
                      render: (item: PainelSerie) => formatInteger(item.cliquesDelivery),
                    },
                    {
                      label: "Conversas WhatsApp",
                      render: (item: PainelSerie) => formatInteger(item.conversasWhatsapp),
                    },
                    {
                      label: "Intenções de pedido",
                      render: (item: PainelSerie) => formatInteger(item.intencoesPedido),
                    },
                    { label: "CTR", render: (item: PainelSerie) => formatPercentage(item.ctr) },
                    {
                      label: "CPC delivery",
                      render: (item: PainelSerie) => formatCurrency(item.cpcDelivery),
                    },
                    {
                      label: "Custo por conversa",
                      render: (item: PainelSerie) => formatCurrency(item.custoPorConversa),
                    },
                    {
                      label: "Custo por intenção",
                      render: (item: PainelSerie) => formatCurrency(item.custoPorIntencao),
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
