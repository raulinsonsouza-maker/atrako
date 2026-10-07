"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartArtifact, ChartUnit } from "@/lib/atrako-agent/artifacts";

/** Card de gráfico (YAML `assistant-chart-card`) — cores só dos tokens `--chart-*`. */

const TONE: Record<string, string> = {
  current: "var(--primary)",
  previous: "var(--chart-plan)",
  spend: "var(--chart-spend)",
  revenue: "var(--chart-revenue)",
};
const PALETTE = ["var(--primary)", "var(--chart-spend)", "var(--chart-revenue)", "var(--chart-plan)"];

function colorFor(series: ChartArtifact["series"][number], i: number) {
  return (series.tone && TONE[series.tone]) || PALETTE[i % PALETTE.length];
}

export function formatChartValue(value: unknown, unit: ChartUnit, compact = false): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (unit === "currency") {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: compact && Math.abs(n) >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: compact || Math.abs(n) >= 1000 ? 0 : 2,
    });
  }
  if (unit === "percent") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return n.toLocaleString("pt-BR", {
    notation: compact && Math.abs(n) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  });
}

const axisTick = { fill: "var(--ink-muted-48)", fontSize: 12 };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  unit: ChartUnit;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-card-tooltip">
      {label !== undefined && label !== "" ? <p className="type-fine-print text-[var(--ink-muted-48)]">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="type-caption text-[var(--ink)]">
          <span className="chart-card-dot" style={{ background: p.color }} aria-hidden />
          {p.name}: <strong className="font-semibold">{formatChartValue(p.value, unit)}</strong>
        </p>
      ))}
    </div>
  );
}

function Funnel({ chart }: { chart: ChartArtifact }) {
  const key = chart.series[0]?.key ?? "value";
  const rows = chart.data.map((d) => ({ label: String(d[chart.xKey] ?? ""), value: Number(d[key] ?? 0) || 0 }));
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="chart-card-funnel">
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].value : null;
        const rate = prev ? (r.value / prev) * 100 : null;
        return (
          <li key={`${r.label}-${i}`} className="chart-card-funnel-row">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-caption text-[var(--ink)]">{r.label}</span>
              <span className="type-caption-strong text-[var(--ink)]">
                {formatChartValue(r.value, chart.unit)}
                {rate !== null ? (
                  <span className="type-fine-print ml-2 text-[var(--ink-muted-48)]">
                    {rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                ) : null}
              </span>
            </div>
            <span className="chart-card-funnel-track">
              <span className="chart-card-funnel-bar" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Donut({ chart }: { chart: ChartArtifact }) {
  const key = chart.series[0]?.key ?? "value";
  const rows = chart.data
    .map((d) => ({ name: String(d[chart.xKey] ?? ""), value: Number(d[key] ?? 0) || 0 }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const colors = ["var(--primary)", "var(--chart-spend)", "var(--chart-revenue)", "var(--chart-plan)", "var(--ink-muted-48)"];
  return (
    <div className="chart-card-donut">
      <div className="chart-card-donut-plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke="none" isAnimationActive={false}>
              {rows.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit={chart.unit} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="chart-card-legend chart-card-legend-stack">
        {rows.map((r, i) => (
          <li key={r.name} className="type-caption text-[var(--ink)]">
            <span className="chart-card-dot" style={{ background: colors[i % colors.length] }} aria-hidden />
            {r.name}
            <span className="ml-auto pl-3 text-[var(--ink-muted-48)]">
              {formatChartValue(r.value, chart.unit)} · {total ? Math.round((r.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartCard({ chart }: { chart: ChartArtifact }) {
  const empty = !chart.data.length;
  return (
    <figure className="assistant-chart-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="type-caption-strong text-[var(--ink)]">{chart.title}</span>
        {chart.series.length > 1 && chart.chart !== "donut" && chart.chart !== "funnel" ? (
          <ul className="chart-card-legend">
            {chart.series.map((s, i) => (
              <li key={s.key} className="type-fine-print text-[var(--ink-muted-80)]">
                <span className="chart-card-dot" style={{ background: colorFor(s, i) }} aria-hidden />
                {s.label}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>

      {empty ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Sem dados no período.</p>
      ) : chart.chart === "funnel" ? (
        <Funnel chart={chart} />
      ) : chart.chart === "donut" ? (
        <Donut chart={chart} />
      ) : (
        <div className="chart-card-plot">
          <ResponsiveContainer width="100%" height="100%">
            {chart.chart === "line" ? (
              <LineChart data={chart.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                <XAxis dataKey={chart.xKey} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => formatChartValue(v, chart.unit, true)}
                />
                <Tooltip content={<ChartTooltip unit={chart.unit} />} />
                {chart.series.map((s, i) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={colorFor(s, i)}
                    strokeWidth={2}
                    strokeDasharray={s.tone === "previous" ? "4 4" : undefined}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chart.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                <XAxis dataKey={chart.xKey} tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => formatChartValue(v, chart.unit, true)}
                />
                <Tooltip cursor={{ fill: "var(--chart-current)" }} content={<ChartTooltip unit={chart.unit} />} />
                {chart.series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={colorFor(s, i)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {chart.note ? <p className="type-fine-print text-[var(--ink-muted-48)]">{chart.note}</p> : null}
    </figure>
  );
}
