import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("stack-sm", className)}>
      <label htmlFor={htmlFor} className="text-[var(--text-sm)] font-medium text-[var(--ink)]">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-[var(--text-xs)] text-[var(--muted)] m-0">{hint}</p>
      ) : null}
      {error ? <p className="text-[var(--text-xs)] text-[var(--danger)] m-0">{error}</p> : null}
    </div>
  );
}
