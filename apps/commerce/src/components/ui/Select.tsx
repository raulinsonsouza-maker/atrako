import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-black/40 px-3 text-[var(--text-sm)] text-[var(--ink)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgb(201_100_66_/_0.25)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
