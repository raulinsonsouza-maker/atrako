"use client";

import { cn } from "@/lib/utils";

/** Alternância de visualização (YAML `segmented-control`) — 36px, mesma linha de SearchInput/PillSelect. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("segmented", className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segmented-option type-caption"
          data-active={o.value === value ? "true" : "false"}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
