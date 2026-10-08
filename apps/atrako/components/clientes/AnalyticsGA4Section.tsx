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
import { Activity, Users, TrendingUp, Clock } from "lucide-react";
import { bucketYmd, diasEntre, rotuloEixo, rotuloTooltip } from "@/lib/chart-bucket";

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
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {title}
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums leading-none ${
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export type AnalyticsGA4Data = {
  hasAnalytics: boolean;
  resumo?: {
    sessions: number;
    activeUsers: number;
    engagementRate: number;
    averageSessionDuration: number;
    bounceRate: number;
    newUsers: number;
    screenPageViews: number;
  };
  series?: Array<{
    data: string;
    sessions: number;
    activeUsers: number;
    engagementRate: number;
    averageSessionDuration: number;
  }>;
};

function seriesDoGrafico(series: NonNullable<AnalyticsGA4Data["series"]>) {
  const ordered = [...series].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const first = String(ordered[0]?.data ?? "").slice(0, 10);
  const last = String(ordered[ordered.length - 1]?.data ?? "").slice(0, 10);
  const mensal = ordered.length > 1 && diasEntre(first, last) > 180;
  if (!mensal) {
    return {
      mensal: false,
      rows: ordered.map((row) => {
        const day = String(row.data).slice(0, 10);
        return { ...row, periodo: rotuloEixo(day, "dia", false), rotulo: rotuloTooltip(day, "dia") };
      }),
    };
  }
  const buckets = new Map<string, { sessions: number; activeUsers: number; engagement: number; duration: number; weight: number }>();
  for (const row of ordered) {
    const key = bucketYmd(String(row.data), "mes");
    const current = buckets.get(key) ?? { sessions: 0, activeUsers: 0, engagement: 0, duration: 0, weight: 0 };
    const weight = row.sessions || 0;
    current.sessions += row.sessions;
    current.activeUsers += row.activeUsers;
    current.engagement += row.engagementRate * weight;
    current.duration += row.averageSessionDuration * weight;
    current.weight += weight;
    buckets.set(key, current);
  }
  const years = new Set([...buckets.keys()].map((key) => key.slice(0, 4)));
  const multiYear = years.size > 1;
  return {
    mensal: true,
    rows: [...buckets.entries()].map(([key, row]) => ({
      data: key,
      sessions: row.sessions,
      activeUsers: row.activeUsers,
      engagementRate: row.weight > 0 ? row.engagement / row.weight : 0,
      averageSessionDuration: row.weight > 0 ? row.duration / row.weight : 0,
      periodo: rotuloEixo(key, "mes", multiYear),
      rotulo: rotuloTooltip(key, "mes"),
    })),
  };
}

export function AnalyticsGA4Section({ data }: { data: AnalyticsGA4Data }) {
  if (!data?.hasAnalytics || !data.resumo) return null;
  const grafico = data.series?.length ? seriesDoGrafico(data.series) : { mensal: false, rows: [] };
  const series = grafico.rows;
  const mensal = grafico.mensal;

  return (
    <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
              Comportamento (GA4)
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Sessões, usuários ativos e engajamento do site
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-600">
            <Activity className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Sessões"
            value={data.resumo.sessions.toLocaleString("pt-BR")}
            sub="Total do período"
            icon={Activity}
          />
          <KpiCard
            title="Usuários ativos"
            value={data.resumo.activeUsers.toLocaleString("pt-BR")}
            sub="Usuários únicos"
            icon={Users}
          />
          <KpiCard
            title="Taxa de engajamento"
            value={`${(data.resumo.engagementRate * 100).toFixed(1)}%`}
            sub="Sessões engajadas"
            icon={TrendingUp}
            accentValue
          />
          <KpiCard
            title="Duração média"
            value={formatDuration(data.resumo.averageSessionDuration)}
            sub="Por sessão"
            icon={Clock}
          />
        </section>
        {series.length > 0 && (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series}>
                <defs>
                  <linearGradient id="ga4BarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                <XAxis
                  dataKey="periodo"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={series.length > 14 ? Math.ceil(series.length / 14) - 1 : 0}
                  angle={!mensal && series.length > 14 ? -45 : 0}
                  textAnchor={!mensal && series.length > 14 ? "end" : "middle"}
                  height={!mensal && series.length > 14 ? 50 : 30}
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
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "engagementRate") return [(Number(value) * 100).toFixed(1) + "%", "Engajamento"];
                    if (name === "averageSessionDuration")
                      return [formatDuration(Number(value)), "Duração"];
                    return [Number(value).toLocaleString("pt-BR"), name];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.rotulo ?? ""}
                  {...tooltipStyle}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="sessions"
                  name="Sessões"
                  fill="url(#ga4BarGrad)"
                  radius={[6, 6, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="activeUsers"
                  name="Usuários ativos"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ fill: "var(--primary)", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
