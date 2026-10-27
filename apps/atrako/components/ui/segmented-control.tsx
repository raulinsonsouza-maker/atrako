"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Alternância de visualização (YAML `segmented-control`) — 36px, mesma linha de SearchInput/PillSelect. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  fill,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
  className?: string;
  fill?: boolean;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("segmented", fill && "segmented-fill", className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segmented-option type-caption inline-flex items-center gap-1.5"
          data-active={o.value === value ? "true" : "false"}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? (
            <span className="inline-flex h-3.5 w-3.5 shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>
              {o.icon}
            </span>
          ) : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}
