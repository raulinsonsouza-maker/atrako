"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, User } from "lucide-react";

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

interface RecentLeadsProps {
  leads: Lead[];
  className?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  META: "bg-primary-500/10 text-primary-600 dark:text-primary-400",
  GOOGLE: "bg-error-500/10 text-error-600 dark:text-error-400",
  WHATSAPP: "bg-success-500/10 text-success-600 dark:text-success-400",
  MANUAL: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  OUTROS: "bg-tint-purple/10 text-tint-purple",
};

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

export function RecentLeads({ leads, className }: RecentLeadsProps) {
  return (
    <div
      className={clsx(
        "rounded-xl overflow-hidden",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200/60 dark:border-neutral-800",
        "shadow-card",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
            Leads Recentes
          </h3>
          <p className="text-caption-1 text-neutral-500 dark:text-neutral-400">
            Ultimos adicionados
          </p>
        </div>
        <Link
          href="/dashboard/leads"
          className={clsx(
            "flex items-center gap-0.5 text-footnote font-medium",
            "text-primary-500 hover:text-primary-600",
            "transition-colors duration-fast"
          )}
        >
          Ver todos
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* List */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/dashboard/leads/${lead.id}`}
            className={clsx(
              "flex items-center gap-3 px-4 py-3",
              "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
              "transition-colors duration-fast"
            )}
          >
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <User className="h-4 w-4 text-neutral-500 dark:text-neutral-400" strokeWidth={1.75} />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-subhead font-medium text-neutral-900 dark:text-neutral-100">
                  {lead.name}
                </p>
                {lead.source && (
                  <span
                    className={clsx(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.OUTROS
                    )}
                  >
                    {lead.source}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-caption-1 text-neutral-500 dark:text-neutral-400">
                {lead.stage && (
                  <span className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: lead.stage.color }}
                    />
                    {lead.stage.name}
                  </span>
                )}
                {lead.stage && lead.dealValue != null && lead.dealValue > 0 && (
                  <span className="text-neutral-300 dark:text-neutral-600">·</span>
                )}
                {lead.dealValue != null && lead.dealValue > 0 && (
                  <span className="font-medium text-primary-600 dark:text-primary-400">
                    {formatCurrency(lead.dealValue)}
                  </span>
                )}
              </div>
            </div>

            {/* Time */}
            <span className="shrink-0 text-caption-2 text-neutral-400 dark:text-neutral-500">
              {formatTimeAgo(lead.createdAt)}
            </span>
          </Link>
        ))}

        {leads.length === 0 && (
          <div className="py-10 text-center">
            <User className="mx-auto h-10 w-10 text-neutral-200 dark:text-neutral-700" strokeWidth={1.5} />
            <p className="mt-2 text-footnote text-neutral-500 dark:text-neutral-400">
              Nenhum lead recente
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
