"use client";

import { cn } from "@/lib/utils";

export type MetricTone = "positive" | "negative";

/** Tile de KPI. Mesma peça do Relacionamento (`.rel-kpi`). */
export function MetricTile({
  label,
  value,
  detail,
  info,
  tone,
  delta,
  pressed,
  onClick,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  info?: React.ReactNode;
  tone?: MetricTone;
  delta?: React.ReactNode;
  pressed?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-[var(--success)]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--ink)]";
  const cls = cn("rel-kpi w-full text-left", pressed && "border-[var(--primary)]", className);
  const body = (
    <>
      <span className="flex min-h-[22px] items-center gap-0.5 type-fine-print text-[var(--ink-muted-48)]">
        {label}
        {info}
      </span>
      <span className={cn("type-tagline tabular-nums", valueColor)}>{value}</span>
      {detail || delta ? (
        <span className="flex flex-wrap items-center gap-x-2 type-micro-legal text-[var(--ink-muted-48)]">
          {delta}
          {detail ? <span className="min-w-0">{detail}</span> : null}
        </span>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" aria-pressed={pressed} onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** 2 colunas no phone, 4 a partir de 1068px. */
export function MetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("rel-kpi-grid", className)}>{children}</div>;
}
