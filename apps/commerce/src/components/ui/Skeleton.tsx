import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] bg-[var(--bg-muted)] animate-[pulse-soft_1.4s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}
