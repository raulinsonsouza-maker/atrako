"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { PieChart } from "lucide-react";

interface CategoryData {
  name: string;
  color: string;
  total: number;
}

interface CategoryBreakdownProps {
  income: CategoryData[];
  expense: CategoryData[];
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

export function CategoryBreakdown({
  income,
  expense,
  className,
}: CategoryBreakdownProps) {
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");

  const data = activeTab === "income" ? income : expense;
  const total = data.reduce((sum, d) => sum + d.total, 0);

  const calculateAngles = (items: CategoryData[]) => {
    let currentAngle = 0;
    return items.map((item) => {
      const percentage = total > 0 ? (item.total / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return { ...item, percentage, startAngle, angle };
    });
  };

  const dataWithAngles = calculateAngles(data);

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
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint-purple/10">
            <PieChart className="h-5 w-5 text-tint-purple" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
              Por Categoria
            </h3>
            <p className="text-caption-1 text-neutral-500 dark:text-neutral-400">
              Distribuicao do periodo
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("income")}
            className={clsx(
              "px-3 py-1.5 text-caption-1 font-medium rounded-md transition-all",
              activeTab === "income"
                ? "bg-white dark:bg-neutral-700 text-success-600 dark:text-success-400 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700"
            )}
          >
            Receitas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expense")}
            className={clsx(
              "px-3 py-1.5 text-caption-1 font-medium rounded-md transition-all",
              activeTab === "expense"
                ? "bg-white dark:bg-neutral-700 text-error-600 dark:text-error-400 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700"
            )}
          >
            Despesas
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-footnote text-neutral-400 dark:text-neutral-500">
            Sem {activeTab === "income" ? "receitas" : "despesas"} no periodo
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Donut Chart */}
          <div className="relative flex items-center justify-center">
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="14"
                  className="text-neutral-100 dark:text-neutral-800"
                />
                {dataWithAngles.map((item, idx) => {
                  const circumference = 2 * Math.PI * 38;
                  const offset = (item.startAngle / 360) * circumference;
                  const length = (item.angle / 360) * circumference;

                  return (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="14"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-apple"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-title-2 font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(total)}
                </span>
                <span className="text-caption-1 text-neutral-500 dark:text-neutral-400">
                  Total
                </span>
              </div>
            </div>
          </div>

          {/* Category List - grid com espaco para percentual e valor */}
          <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
            {dataWithAngles.map((item, idx) => (
              <div
                key={idx}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center p-3 rounded-xl",
                  "bg-neutral-50/50 dark:bg-neutral-800/30",
                  "hover:bg-neutral-100/80 dark:hover:bg-neutral-800/50",
                  "transition-colors"
                )}
              >
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {item.name}
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                  {item.percentage.toFixed(0)}%
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums whitespace-nowrap">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
