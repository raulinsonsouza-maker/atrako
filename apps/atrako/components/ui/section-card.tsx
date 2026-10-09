"use client";

import { cn } from "@/lib/utils";

/** Bloco de seção do dashboard. Mesma peça do Relacionamento (`.rel-card`). */
export function SectionCard({
  title,
  subtitle,
  info,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  info?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rel-card", className)}>
      {title || subtitle || action ? (
        <header className="rel-section-head">
          <div className="min-w-0">
            {title ? (
              <div className="flex min-w-0 items-center gap-1">
                <h2 className="type-body-strong truncate text-[var(--ink)]">{title}</h2>
                {info}
              </div>
            ) : null}
            {subtitle ? (
              <p className="type-fine-print text-[var(--ink-muted-48)]">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      {children ? <div className="min-w-0">{children}</div> : null}
    </section>
  );
}
