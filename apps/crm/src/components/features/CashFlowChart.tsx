"use client";

import { clsx } from "clsx";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface DataPoint {
  date: string;
  receita: number;
  despesa: number;
  saldo: number;
}

interface CashFlowChartProps {
  data: DataPoint[];
  className?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length || !label) return null;
  const labels: Record<string, string> = { receita: "Receitas", despesa: "Despesas" };
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
        {formatDate(label)}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-medium" style={{ color: entry.color }}>
          {labels[entry.name] ?? entry.name}: {formatCurrency(Number(entry.value))}
        </p>
      ))}
    </div>
  );
};

export function CashFlowChart({ data, className }: CashFlowChartProps) {
  const totals = data.reduce(
    (acc, d) => ({
      receita: acc.receita + d.receita,
      despesa: acc.despesa + d.despesa,
    }),
    { receita: 0, despesa: 0 }
  );
  const saldoPeriodo = totals.receita - totals.despesa;

  const chartData = data.map((d) => ({
    ...d,
    dataLabel: formatDate(d.date),
  }));

  if (data.length === 0) {
    return (
      <div
        className={clsx(
          "rounded-2xl p-5",
          "bg-white dark:bg-neutral-900",
          "border border-neutral-200/60 dark:border-neutral-800",
          "shadow-card",
          className
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10">
            <BarChart3 className="h-5 w-5 text-primary-500" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
              Fluxo de Caixa
            </h3>
            <p className="text-caption-1 text-neutral-500 dark:text-neutral-400">
              Período selecionado
            </p>
          </div>
        </div>
        <div className="flex h-48 items-center justify-center">
          <p className="text-footnote text-neutral-400 dark:text-neutral-500">
            Sem movimentações no período
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-2xl p-5",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200/60 dark:border-neutral-800",
        "shadow-card",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10">
            <BarChart3 className="h-5 w-5 text-primary-500" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
              Fluxo de Caixa
            </h3>
            <p className="text-caption-1 text-neutral-500 dark:text-neutral-400">
              Período selecionado
            </p>
          </div>
        </div>
        <div
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5",
            saldoPeriodo >= 0
              ? "bg-success-500/10 text-success-600 dark:text-success-400"
              : "bg-error-500/10 text-error-600 dark:text-error-400"
          )}
        >
          {saldoPeriodo >= 0 ? (
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <TrendingDown className="h-4 w-4" strokeWidth={1.75} />
          )}
          <span className="text-footnote font-semibold">
            {formatCurrency(Math.abs(saldoPeriodo))}
          </span>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-neutral-500 dark:text-neutral-400"
            />
            <YAxis
              tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`)}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-neutral-500 dark:text-neutral-400"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (value === "receita" ? "Receitas" : "Despesas")}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="receita"
              name="receita"
              stroke="#22c55e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorReceita)"
            />
            <Area
              type="monotone"
              dataKey="despesa"
              name="despesa"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorDespesa)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <div className="rounded-lg bg-neutral-50/80 py-3 px-4 dark:bg-neutral-800/50">
          <p className="text-caption-1 text-neutral-500 dark:text-neutral-400 mb-0.5">Total Receitas</p>
          <p className="text-lg font-bold text-success-600 dark:text-success-400">
            {formatCurrency(totals.receita)}
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50/80 py-3 px-4 dark:bg-neutral-800/50">
          <p className="text-caption-1 text-neutral-500 dark:text-neutral-400 mb-0.5">Total Despesas</p>
          <p className="text-lg font-bold text-error-600 dark:text-error-400">
            {formatCurrency(totals.despesa)}
          </p>
        </div>
      </div>
    </div>
  );
}
