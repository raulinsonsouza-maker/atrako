import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "success" | "danger" | "accent" }) {
  const tones = {
    default: "bg-[var(--bg-muted)] text-[var(--ink-soft)] border-[var(--border)]",
    success: "bg-[rgb(58_143_92_/_0.12)] text-[var(--success)] border-[rgb(58_143_92_/_0.25)]",
    danger: "bg-[rgb(204_68_68_/_0.1)] text-[var(--danger)] border-[rgb(204_68_68_/_0.25)]",
    accent: "bg-[rgb(201_100_66_/_0.2)] text-[var(--color-accent-deep)] border-[rgb(201_100_66_/_0.35)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
