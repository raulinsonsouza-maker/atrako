import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `toolbar`: 36px com borda, ao lado de Button size="toolbar". */
  size?: "default" | "toolbar";
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, children, size = "default", ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-[var(--ink)] transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)] disabled:pointer-events-none disabled:opacity-50",
        size === "toolbar"
          ? "h-9 w-9 border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)]"
          : "h-11 w-11 bg-[var(--surface-chip-translucent)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";

export { IconButton };
