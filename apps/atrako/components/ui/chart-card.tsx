"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
    const useCompact = compact && Math.abs(n) >= 1000;
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: useCompact ? "compact" : "standard",
      maximumFractionDigits: useCompact || Math.abs(n) >= 1000 ? 0 : 2,
    });
  }
  if (unit === "percent") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return n.toLocaleString("pt-BR", {
    notation: compact && Math.abs(n) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  });
}

const axisTick = { fill: "var(--ink-muted-80)", fontSize: 12 };

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
          {p.name}: <strong className="font-medium">{formatChartValue(p.value, unit)}</strong>
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
        return (
          <li key={`${r.label}-${i}`} className="chart-card-funnel-row">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-caption text-[var(--ink)]">{r.label}</span>
              <span className="type-caption-strong text-[var(--ink)]">{formatChartValue(r.value, chart.unit)}</span>
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
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" stroke="none" paddingAngle={rows.length > 1 ? 1.5 : 0} isAnimationActive={false}>
              {rows.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit={chart.unit} />} />
          </PieChart>
        </ResponsiveContainer>
        <p className="chart-card-donut-total type-caption-strong text-[var(--ink)]">
          {formatChartValue(total, chart.unit, total >= 10_000)}
        </p>
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

function seriesMax(chart: ChartArtifact) {
  let max = 0;
  for (const row of chart.data) {
    for (const s of chart.series) {
      const n = Number(row[s.key] ?? 0);
      if (Number.isFinite(n)) max = Math.max(max, Math.abs(n));
    }
  }
  return max;
}

function pointColor(label: string, value: number, max: number, i: number) {
  const l = label.toLowerCase();
  if (l === "anterior") return "var(--chart-spend)";
  if (l === "atual") return "var(--primary)";
  if (max > 0 && value === max) return "var(--primary)";
  return PALETTE[(i + 1) % PALETTE.length];
}

/** Duas ou três categorias curtas: o número é o gráfico, a barra só compara a escala. */
function isCompactCompare(chart: ChartArtifact) {
  if (chart.chart !== "bar" || chart.series.length !== 1 || chart.data.length < 2 || chart.data.length > 3) return false;
  return chart.data.every((d) => String(d[chart.xKey] ?? "").length <= 18);
}

function periodDelta(rows: Array<{ label: string; value: number }>) {
  const prev = rows.find((r) => r.label.toLowerCase() === "anterior");
  const cur = rows.find((r) => r.label.toLowerCase() === "atual");
  if (!prev || !cur || !prev.value) return null;
  const pct = ((cur.value - prev.value) / Math.abs(prev.value)) * 100;
  const abs = Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const dir = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const text = dir === "up" ? `+${abs}%` : dir === "down" ? `−${abs}%` : "0%";
  return { dir, text };
}

function Compare({ chart }: { chart: ChartArtifact }) {
  const key = chart.series[0]?.key ?? "value";
  const rows = chart.data.map((d) => ({
    label: String(d[chart.xKey] ?? ""),
    value: Number(d[key] ?? 0) || 0,
  }));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const delta = periodDelta(rows);
  return (
    <>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="type-caption-strong text-[var(--ink)]">{chart.title}</span>
        {delta ? (
          <span className="chart-card-delta type-caption-strong" data-dir={delta.dir}>
            {delta.text}
          </span>
        ) : null}
      </figcaption>
      <div className="chart-card-compare">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="chart-card-compare-item">
            <span className="type-fine-print text-[var(--ink-muted-48)]">{r.label}</span>
            <span className="chart-card-compare-value type-tagline text-[var(--ink)]">
              {formatChartValue(r.value, chart.unit)}
            </span>
            <span className="chart-card-meter">
              <span
                style={{
                  width: `${Math.max(r.value > 0 ? 4 : 0, (Math.abs(r.value) / max) * 100)}%`,
                  background: pointColor(r.label, r.value, max, i),
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function CategoryTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const text = String(payload?.value ?? "");
  const short = text.length > 22 ? `${text.slice(0, 20)}…` : text;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--ink-muted-80)" fontSize={12}>
      {short}
    </text>
  );
}

export function ChartCard({ chart }: { chart: ChartArtifact }) {
  const empty = !chart.data.length;
  const compact = isCompactCompare(chart);
  const max = seriesMax(chart);
  const axisCompact = max >= 10_000;
  const yWidth = chart.unit === "currency" ? 78 : 44;
  const horizontal =
    chart.chart === "bar" && chart.data.some((d) => String(d[chart.xKey] ?? "").length > 14);
  const showBarValues = chart.series.length === 1 && chart.data.length <= 6;
  const peak = Math.max(
    0,
    ...chart.data.map((d) => Number(d[chart.series[0]?.key ?? ""] ?? 0) || 0),
  );

  return (
    <figure className="assistant-chart-card">
      {compact && !empty ? (
        <Compare chart={chart} />
      ) : (
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
      )}

      {empty ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Sem dados no período.</p>
      ) : compact ? null : chart.chart === "funnel" ? (
        <Funnel chart={chart} />
      ) : chart.chart === "donut" ? (
        <Donut chart={chart} />
      ) : (
        <div className="chart-card-plot" style={horizontal ? { height: Math.max(180, chart.data.length * 36) } : undefined}>
          <ResponsiveContainer width="100%" height="100%">
            {chart.chart === "line" ? (
              <LineChart data={chart.data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                <XAxis dataKey={chart.xKey} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={yWidth}
                  tickFormatter={(v) => formatChartValue(v, chart.unit, axisCompact)}
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
            ) : horizontal ? (
              <BarChart data={chart.data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid horizontal={false} stroke="var(--divider-soft)" />
                <XAxis
                  type="number"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatChartValue(v, chart.unit, axisCompact)}
                />
                <YAxis type="category" dataKey={chart.xKey} tick={CategoryTick} tickLine={false} axisLine={false} width={132} />
                <Tooltip cursor={{ fill: "var(--chart-current)" }} content={<ChartTooltip unit={chart.unit} />} />
                {chart.series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={colorFor(s, i)}
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                    isAnimationActive={false}
                  >
                    {chart.series.length === 1
                      ? chart.data.map((d, di) => (
                          <Cell
                            key={di}
                            fill={pointColor(String(d[chart.xKey] ?? ""), Number(d[s.key] ?? 0) || 0, peak, di)}
                          />
                        ))
                      : null}
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <BarChart data={chart.data} margin={{ top: showBarValues ? 22 : 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
                <XAxis dataKey={chart.xKey} tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={yWidth}
                  tickFormatter={(v) => formatChartValue(v, chart.unit, axisCompact)}
                />
                <Tooltip cursor={{ fill: "var(--chart-current)" }} content={<ChartTooltip unit={chart.unit} />} />
                {chart.series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={colorFor(s, i)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={chart.data.length <= 4 ? 48 : 28}
                    isAnimationActive={false}
                  >
                    {chart.series.length === 1
                      ? chart.data.map((d, di) => (
                          <Cell
                            key={di}
                            fill={pointColor(String(d[chart.xKey] ?? ""), Number(d[s.key] ?? 0) || 0, peak, di)}
                          />
                        ))
                      : null}
                    {showBarValues ? (
                      <LabelList
                        dataKey={s.key}
                        position="top"
                        formatter={(v) => formatChartValue(v, chart.unit, axisCompact)}
                        fill="var(--ink-muted-80)"
                        fontSize={12}
                      />
                    ) : null}
                  </Bar>
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
