import { cn } from "@/lib/utils";
import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }
>(({ className, label, id, ...props }, ref) => (
  <label htmlFor={id} className="inline-flex items-start gap-2 cursor-pointer text-[var(--text-sm)]">
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className={cn("mt-1 size-4 accent-[var(--accent)]", className)}
      {...props}
    />
    {label ? <span className="text-[var(--ink-soft)]">{label}</span> : null}
  </label>
));
Checkbox.displayName = "Checkbox";
