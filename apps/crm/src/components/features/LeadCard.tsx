"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, Calendar, User, Mail, Phone, Clock } from "lucide-react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  assignedTo: { id: string; name: string } | null;
  source?: string | null;
  campaign?: string | null;
  ad?: string | null;
  dealValue?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  tags?: Array<{
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }>;
};

const SOURCE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  META: {
    bg: "bg-primary-500/10",
    text: "text-primary-600 dark:text-primary-400",
    dot: "bg-primary-500",
  },
  GOOGLE: {
    bg: "bg-error-500/10",
    text: "text-error-600 dark:text-error-400",
    dot: "bg-error-500",
  },
  WHATSAPP: {
    bg: "bg-success-500/10",
    text: "text-success-600 dark:text-success-400",
    dot: "bg-success-500",
  },
  MANUAL: {
    bg: "bg-neutral-100 dark:bg-neutral-800",
    text: "text-neutral-600 dark:text-neutral-400",
    dot: "bg-neutral-400",
  },
  OUTROS: {
    bg: "bg-tint-purple/10",
    text: "text-tint-purple",
    dot: "bg-tint-purple",
  },
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

export function LeadCard({
  lead,
  drag,
  viewHref,
  onViewClick,
}: {
  lead: Lead;
  drag?: boolean;
  viewHref?: string;
  onViewClick?: (lead: Lead) => void;
}) {
  const sourceStyle = lead.source
    ? SOURCE_STYLES[lead.source] ?? SOURCE_STYLES.OUTROS
    : null;

  const content = (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-xl p-3",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200/60 dark:border-neutral-800",
        "shadow-card",
        "transition-all duration-fast",
        drag
          ? "cursor-grab active:cursor-grabbing"
          : "hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-subhead font-semibold text-neutral-900 dark:text-neutral-100">
            {lead.name}
          </h4>
          {lead.source && (
            <span
              className={clsx(
                "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                sourceStyle?.bg,
                sourceStyle?.text
              )}
            >
              <span className={clsx("h-1 w-1 rounded-full", sourceStyle?.dot)} />
              {lead.source}
            </span>
          )}
        </div>
        {lead.dealValue != null && lead.dealValue > 0 && (
          <span className="text-footnote font-semibold text-primary-600 dark:text-primary-400 tabular-nums">
            {formatCurrency(lead.dealValue)}
          </span>
        )}
      </div>

      {/* Contact Info */}
      <div className="mt-2 space-y-1">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-caption-1 text-neutral-500 dark:text-neutral-400">
            <Mail className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-caption-1 text-neutral-500 dark:text-neutral-400">
            <Phone className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            <span>{lead.phone}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          {lead.assignedTo && (
            <div className="flex items-center gap-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <User className="h-3 w-3 text-neutral-500" strokeWidth={1.75} />
              </div>
              <span className="text-caption-2 text-neutral-500 dark:text-neutral-400">
                {lead.assignedTo.name.split(" ")[0]}
              </span>
            </div>
          )}
          {lead.createdAt && (
            <div className="flex items-center gap-0.5 text-caption-2 text-neutral-400">
              <Clock className="h-3 w-3" strokeWidth={1.75} />
              {formatTimeAgo(lead.createdAt)}
            </div>
          )}
        </div>

        {viewHref && (
          <div className="flex items-center gap-1">
            <Link
              href={onViewClick ? viewHref : `${viewHref}?schedule=true`}
              onClick={(e) => {
                e.stopPropagation();
                if (onViewClick) {
                  e.preventDefault();
                  onViewClick(lead);
                }
              }}
              className={clsx(
                "rounded-md p-1",
                "text-neutral-400 hover:text-primary-500",
                "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                "transition-colors duration-fast"
              )}
              title={onViewClick ? "Abrir atendimento" : "Agendar"}
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
            <Link
              href={viewHref}
              onClick={(e) => {
                e.stopPropagation();
                if (onViewClick) {
                  e.preventDefault();
                  onViewClick(lead);
                }
              }}
              className={clsx(
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5",
                "text-caption-2 font-medium text-primary-500",
                "hover:bg-primary-500/10",
                "transition-colors duration-fast"
              )}
            >
              Ver
              <ChevronRight className="h-3 w-3" strokeWidth={2} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  if (viewHref && !drag) {
    return (
      <Link href={viewHref} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
