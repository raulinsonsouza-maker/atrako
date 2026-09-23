"use client";

import { clsx } from "clsx";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface FinanceKpisProps {
  receita: number;
  despesas: number;
  saldo: number;
  aReceber: number;
  aPagar: number;
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

export function FinanceKpis({
  receita,
  despesas,
  saldo,
  aReceber,
  className,
}: FinanceKpisProps) {
  return (
    <div className={clsx("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {/* Receita */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl p-5",
          "bg-gradient-to-br from-success-500 to-success-600",
          "shadow-lg shadow-success-500/20"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-footnote font-medium text-white/80">Receita</p>
            <p className="text-title-1 font-bold text-white tracking-tight">
              {formatCurrency(receita)}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-white/70" strokeWidth={2} />
              <span className="text-caption-1 text-white/70">Confirmado</span>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <TrendingUp className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
        </div>
        {/* Decorative element */}
        <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
      </div>

      {/* Despesas */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl p-5",
          "bg-gradient-to-br from-error-500 to-error-600",
          "shadow-lg shadow-error-500/20"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-footnote font-medium text-white/80">Despesas</p>
            <p className="text-title-1 font-bold text-white tracking-tight">
              {formatCurrency(despesas)}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-white/70" strokeWidth={2} />
              <span className="text-caption-1 text-white/70">Confirmado</span>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <TrendingDown className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
      </div>

      {/* Saldo */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl p-5",
          "bg-white dark:bg-neutral-900",
          "border border-neutral-200/60 dark:border-neutral-800",
          "shadow-card"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-footnote font-medium text-neutral-500 dark:text-neutral-400">
              Saldo
            </p>
            <p
              className={clsx(
                "text-title-1 font-bold tracking-tight",
                saldo >= 0
                  ? "text-neutral-900 dark:text-neutral-100"
                  : "text-error-600 dark:text-error-400"
              )}
            >
              {formatCurrency(saldo)}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <span
                className={clsx(
                  "text-caption-1",
                  saldo >= 0 ? "text-success-500" : "text-error-500"
                )}
              >
                {saldo >= 0 ? "Positivo" : "Negativo"}
              </span>
            </div>
          </div>
          <div
            className={clsx(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              saldo >= 0
                ? "bg-primary-500/10 dark:bg-primary-500/15"
                : "bg-error-500/10 dark:bg-error-500/15"
            )}
          >
            <Wallet
              className={clsx(
                "h-6 w-6",
                saldo >= 0 ? "text-primary-500" : "text-error-500"
              )}
              strokeWidth={1.75}
            />
          </div>
        </div>
      </div>

      {/* A Receber */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl p-5",
          "bg-white dark:bg-neutral-900",
          "border border-neutral-200/60 dark:border-neutral-800",
          "shadow-card"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-footnote font-medium text-neutral-500 dark:text-neutral-400">
              A Receber
            </p>
            <p className="text-title-1 font-bold tracking-tight text-warning-600 dark:text-warning-400">
              {formatCurrency(aReceber)}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <Clock className="h-3.5 w-3.5 text-warning-500" strokeWidth={2} />
              <span className="text-caption-1 text-neutral-500 dark:text-neutral-400">
                Pendente
              </span>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-500/10 dark:bg-warning-500/15">
            <Clock className="h-6 w-6 text-warning-500" strokeWidth={1.75} />
          </div>
        </div>
      </div>
    </div>
  );
}
