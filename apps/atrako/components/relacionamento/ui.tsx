"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Loader2, Mail, MessageCircle } from "lucide-react";
import { InfoHint } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "bad" | undefined;

export function RelLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex justify-center", compact ? "py-6" : "py-16")}>
      <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
    </div>
  );
}

/** Card padrão: título curto + "i" opcional + ação à direita. */
export function RelSection({
  title,
  info,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  info?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rel-card", className)}>
      {title || action ? (
        <header className="rel-section-head">
          <div className="flex min-w-0 items-center gap-1">
            {title ? <h2 className="type-body-strong truncate text-[var(--ink)]">{title}</h2> : null}
            {info ? <InfoHint>{info}</InfoHint> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      {children ? <div>{children}</div> : null}
    </section>
  );
}

export function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null;
  const change = (current - previous) / previous;
  if (!Number.isFinite(change)) return null;
  const dir = Math.abs(change) < 0.005 ? "flat" : change > 0 ? "up" : "down";
  const Icon = change >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="rel-kpi-delta type-micro-legal tabular-nums" data-dir={dir} title="Comparado ao período anterior">
      {dir !== "flat" ? <Icon className="h-3 w-3" strokeWidth={2} /> : null}
      {`${change > 0 ? "+" : ""}${(change * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
    </span>
  );
}

export function RelKpi({
  label,
  value,
  detail,
  info,
  delta,
}: {
  label: string;
  value: string;
  detail?: string;
  info?: React.ReactNode;
  delta?: { current: number; previous: number };
}) {
  return (
    <div className="rel-kpi">
      <span className="flex min-h-[22px] items-center gap-0.5 type-fine-print text-[var(--ink-muted-48)]">
        {label}
        {info ? <InfoHint>{info}</InfoHint> : null}
      </span>
      <span className="type-tagline tabular-nums text-[var(--ink)]">{value}</span>
      {detail || delta ? (
        <span className="flex flex-wrap items-center gap-x-2 type-micro-legal text-[var(--ink-muted-48)]">
          {delta ? <Delta current={delta.current} previous={delta.previous} /> : null}
          {detail ? <span className="truncate">{detail}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function RelEmpty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rel-empty">
      <p className="type-caption text-[var(--ink-muted-48)]">{text}</p>
      {action}
    </div>
  );
}

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "bad" || tone === "warn" ? AlertTriangle : Circle;
  return <Icon className={cn("rel-tone-icon h-4 w-4", className)} data-tone={tone} strokeWidth={1.75} aria-hidden />;
}

/** Linha de status: ícone de tom + rótulo + valor curto. */
export function RelStatusRow({ tone, label, value }: { tone: Tone; label: string; value: React.ReactNode }) {
  return (
    <div className="rel-status-item">
      <ToneIcon tone={tone} className="mt-0.5" />
      <div className="min-w-0">
        <p className="type-caption-strong text-[var(--ink)]">{label}</p>
        <p className="type-fine-print truncate text-[var(--ink-muted-48)]">{value}</p>
      </div>
    </div>
  );
}

export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const label = channel === "WHATSAPP" ? "WhatsApp" : channel === "BOTH" ? "E-mail e WhatsApp" : "E-mail";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-[var(--ink-muted-48)]", className)} title={label} aria-label={label}>
      {channel !== "WHATSAPP" ? <Mail className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
      {channel === "WHATSAPP" || channel === "BOTH" ? <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
    </span>
  );
}
