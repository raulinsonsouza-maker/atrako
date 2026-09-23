import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FloatingStickyBarProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  ctaHref?: string;
  ctaDisabled?: boolean;
  ctaType?: "button" | "submit";
}

export function FloatingStickyBar({
  label,
  ctaLabel = "Continuar",
  onCta,
  ctaHref,
  ctaDisabled,
  ctaType = "button",
  className,
  ...props
}: FloatingStickyBarProps) {
  const cta = ctaHref ? (
    <a href={ctaHref}>
      <Button variant="primary" disabled={ctaDisabled}>
        {ctaLabel}
      </Button>
    </a>
  ) : (
    <Button type={ctaType} variant="primary" disabled={ctaDisabled} onClick={onCta}>
      {ctaLabel}
    </Button>
  );

  return (
    <div
      className={cn(
        "frosted-bar fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-between gap-4 border-t border-[rgba(0,0,0,0.08)] px-4 md:px-8",
        className
      )}
      {...props}
    >
      <div className="type-body min-w-0 truncate text-[var(--ink)]">{label}</div>
      <div className="shrink-0">{cta}</div>
    </div>
  );
}
