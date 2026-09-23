"use client";

import Link from "next/link";
import { useEffect } from "react";
import { clsx } from "clsx";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Wallet,
  ShoppingBag,
  UserCheck,
  Clock,
} from "lucide-react";
import { usePageHeader } from "@/contexts/PageHeaderContext";

interface DashboardSummary {
  revenue: number;
  revenueChange: number;
  expenses: number;
  profit: number;
  leadsThisMonth: number;
  leadsChange: number;
  leadsInProgress: number;
  leadsWonThisMonth: number;
  totalActiveLeads: number;
  salesThisMonth: number;
  avgTicket: number;
  conversionRate: number;
  monthName: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  source?: string | null;
  dealValue?: number | null;
  createdAt: Date | string;
  stage?: { name: string; color: string } | null;
  assignedTo?: { name: string } | null;
}

interface DashboardContentProps {
  summary: DashboardSummary;
  pipeline: { stages: PipelineStage[]; totalLeads: number };
  recentLeads: Lead[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimeAgo(date: Date | string) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return then.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function DashboardContent({ summary, pipeline, recentLeads }: DashboardContentProps) {
  const { setSummary } = usePageHeader();
  useEffect(() => {
    setSummary(summary.monthName);
    return () => setSummary(undefined);
  }, [summary.monthName, setSummary]);

  return (
    <div className="space-y-6">
      {/* Header: titulo "Visão Geral" + mes no Header via context; aqui só subtitulo */}
      <div>
        <p className="text-subhead text-neutral-500 dark:text-neutral-400">
          Resumo do seu negocio
        </p>
      </div>

      {/* Cards principais - Financeiro */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                {formatCurrency(summary.revenue)}
              </p>
              {summary.revenueChange !== 0 && (
                <div className="flex items-center gap-1 pt-1">
                  {summary.revenueChange > 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-white/80" strokeWidth={2} />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-white/80" strokeWidth={2} />
                  )}
                  <span className="text-caption-1 text-white/80">
                    {summary.revenueChange > 0 ? "+" : ""}{summary.revenueChange}% vs anterior
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <TrendingUp className="h-6 w-6 text-white" strokeWidth={1.75} />
            </div>
          </div>
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
                {formatCurrency(summary.expenses)}
              </p>
              <p className="text-caption-1 text-white/80 pt-1">Este mes</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <TrendingDown className="h-6 w-6 text-white" strokeWidth={1.75} />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        </div>

        {/* Lucro */}
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
                Lucro
              </p>
              <p
                className={clsx(
                  "text-title-1 font-bold tracking-tight",
                  summary.profit >= 0
                    ? "text-success-600 dark:text-success-400"
                    : "text-error-600 dark:text-error-400"
                )}
              >
                {formatCurrency(summary.profit)}
              </p>
              <p className="text-caption-1 text-neutral-500 pt-1">
                {summary.profit >= 0 ? "Positivo" : "Negativo"}
              </p>
            </div>
            <div
              className={clsx(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                summary.profit >= 0
                  ? "bg-success-500/10"
                  : "bg-error-500/10"
              )}
            >
              <Wallet
                className={clsx(
                  "h-6 w-6",
                  summary.profit >= 0 ? "text-success-500" : "text-error-500"
                )}
                strokeWidth={1.75}
              />
            </div>
          </div>
        </div>

        {/* Vendas */}
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
                Vendas
              </p>
              <p className="text-title-1 font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {summary.salesThisMonth}
              </p>
              <p className="text-caption-1 text-neutral-500 pt-1">
                Ticket medio: {formatCurrency(summary.avgTicket)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10">
              <ShoppingBag className="h-6 w-6 text-primary-500" strokeWidth={1.75} />
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha - Leads */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Novos Leads */}
        <div
          className={clsx(
            "rounded-2xl p-4",
            "bg-white dark:bg-neutral-900",
            "border border-neutral-200/60 dark:border-neutral-800",
            "shadow-card"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10">
              <Users className="h-5 w-5 text-primary-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-title-2 font-bold text-neutral-900 dark:text-neutral-100">
                {summary.leadsThisMonth}
              </p>
              <p className="text-caption-1 text-neutral-500">Novos leads</p>
            </div>
            {summary.leadsChange !== 0 && (
              <div
                className={clsx(
                  "ml-auto flex items-center gap-0.5 rounded-full px-2 py-1 text-caption-1 font-medium",
                  summary.leadsChange > 0
                    ? "bg-success-500/10 text-success-600"
                    : "bg-error-500/10 text-error-600"
                )}
              >
                {summary.leadsChange > 0 ? "+" : ""}{summary.leadsChange}%
              </div>
            )}
          </div>
        </div>

        {/* Em Atendimento */}
        <div
          className={clsx(
            "rounded-2xl p-4",
            "bg-white dark:bg-neutral-900",
            "border border-neutral-200/60 dark:border-neutral-800",
            "shadow-card"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-500/10">
              <Clock className="h-5 w-5 text-warning-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-title-2 font-bold text-neutral-900 dark:text-neutral-100">
                {summary.leadsInProgress}
              </p>
              <p className="text-caption-1 text-neutral-500">Em atendimento</p>
            </div>
          </div>
        </div>

        {/* Convertidos */}
        <div
          className={clsx(
            "rounded-2xl p-4",
            "bg-white dark:bg-neutral-900",
            "border border-neutral-200/60 dark:border-neutral-800",
            "shadow-card"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500/10">
              <UserCheck className="h-5 w-5 text-success-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-title-2 font-bold text-neutral-900 dark:text-neutral-100">
                {summary.leadsWonThisMonth}
              </p>
              <p className="text-caption-1 text-neutral-500">Convertidos</p>
            </div>
          </div>
        </div>

        {/* Taxa de Conversao */}
        <div
          className={clsx(
            "rounded-2xl p-4",
            "bg-white dark:bg-neutral-900",
            "border border-neutral-200/60 dark:border-neutral-800",
            "shadow-card"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint-purple/10">
              <Target className="h-5 w-5 text-tint-purple" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-title-2 font-bold text-neutral-900 dark:text-neutral-100">
                {summary.conversionRate}%
              </p>
              <p className="text-caption-1 text-neutral-500">Conversao</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline e Leads Recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pipeline */}
        <div
          className={clsx(
            "rounded-2xl p-5",
            "bg-white dark:bg-neutral-900",
            "border border-neutral-200/60 dark:border-neutral-800",
            "shadow-card"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
                Pipeline
              </h3>
              <p className="text-caption-1 text-neutral-500">
                {pipeline.totalLeads} leads no funil
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className={clsx(
                "flex items-center gap-0.5 text-footnote font-medium",
                "text-primary-500 hover:text-primary-600",
                "transition-colors"
              )}
            >
              Ver tudo
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {pipeline.stages.map((stage) => {
              const maxCount = Math.max(...pipeline.stages.map((s) => s.count), 1);
              const percentage = (stage.count / maxCount) * 100;

              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-footnote text-neutral-700 dark:text-neutral-300">
                        {stage.name}
                      </span>
                    </div>
                    <span className="text-footnote font-semibold text-neutral-900 dark:text-neutral-100">
                      {stage.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {pipeline.stages.length === 0 && (
              <p className="py-4 text-center text-footnote text-neutral-400">
                Nenhum estagio configurado
              </p>
            )}
          </div>
        </div>

        {/* Leads Recentes */}
        <div
          className={clsx(
            "rounded-2xl overflow-hidden",
            "bg-white dark:bg-neutral-900",
            "border border-neutral-200/60 dark:border-neutral-800",
            "shadow-card"
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
                Leads Recentes
              </h3>
              <p className="text-caption-1 text-neutral-500">
                Ultimos adicionados
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className={clsx(
                "flex items-center gap-0.5 text-footnote font-medium",
                "text-primary-500 hover:text-primary-600",
                "transition-colors"
              )}
            >
              Ver todos
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recentLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className={clsx(
                  "flex items-center gap-3 px-5 py-3",
                  "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                  "transition-colors"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                    {lead.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-subhead font-medium text-neutral-900 dark:text-neutral-100">
                    {lead.name}
                  </p>
                  <div className="flex items-center gap-2 text-caption-1 text-neutral-500">
                    {lead.stage && (
                      <span className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: lead.stage.color }}
                        />
                        {lead.stage.name}
                      </span>
                    )}
                    {lead.dealValue != null && lead.dealValue > 0 && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span className="font-medium text-primary-600 dark:text-primary-400">
                          {formatCurrency(lead.dealValue)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-caption-2 text-neutral-400">
                  {formatTimeAgo(lead.createdAt)}
                </span>
              </Link>
            ))}

            {recentLeads.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-footnote text-neutral-400">Nenhum lead recente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link rapido para financeiro */}
      <Link
        href="/dashboard/financeiro"
        className={clsx(
          "flex items-center justify-between p-5 rounded-2xl",
          "bg-gradient-to-r from-primary-500 to-primary-600",
          "shadow-lg shadow-primary-500/20",
          "hover:shadow-xl hover:shadow-primary-500/30",
          "transition-all duration-200"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <DollarSign className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-headline font-semibold text-white">
              Gestao Financeira
            </p>
            <p className="text-footnote text-white/80">
              Gerencie receitas, despesas e transacoes
            </p>
          </div>
        </div>
        <ChevronRight className="h-6 w-6 text-white/80" strokeWidth={1.75} />
      </Link>
    </div>
  );
}
