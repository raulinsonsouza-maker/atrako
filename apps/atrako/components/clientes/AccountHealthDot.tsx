import type { AccountHealthStatus } from "@/lib/account-health/status";

const STATUS_META: Record<AccountHealthStatus, { label: string; className: string }> = {
  RED: { label: "Saúde crítica", className: "bg-red-500" },
  YELLOW: { label: "Saúde em atenção", className: "bg-amber-400" },
  GREEN: { label: "Saúde sem problema crítico", className: "bg-emerald-500" },
  GRAY: { label: "Saúde não avaliada", className: "bg-neutral-500" },
};

export function AccountHealthDot({ status }: { status?: AccountHealthStatus }) {
  const meta = STATUS_META[status ?? "GRAY"];
  return (
    <span
      role="img"
      aria-label={meta.label}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-current/10 ${meta.className}`}
    />
  );
}