import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-black/40 px-3 text-[var(--text-sm)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgb(201_100_66_/_0.25)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
