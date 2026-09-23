import * as React from "react";
import { cn } from "@/lib/utils";

export interface OptionChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

const OptionChip = React.forwardRef<HTMLButtonElement, OptionChipProps>(
  ({ className, selected = false, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)]",
        selected
          ? "border-2 border-[var(--primary-focus)]"
          : "border border-[var(--hairline)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
OptionChip.displayName = "OptionChip";

export { OptionChip };
