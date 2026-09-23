import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Alert({
  className,
  tone = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "info" | "success" | "danger" }) {
  const tones = {
    info: "border-[var(--border)] bg-[var(--bg-muted)] text-[var(--ink-soft)]",
    success: "border-[var(--success)] bg-[rgb(46_125_50_/_0.08)] text-[var(--success)]",
    danger: "border-[var(--danger)] bg-[rgb(198_40_40_/_0.08)] text-[var(--danger)]",
  };
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3 text-[var(--text-sm)]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
