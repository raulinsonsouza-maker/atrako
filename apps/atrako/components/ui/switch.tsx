"use client";

import { cn } from "@/lib/utils";

/** Liga/desliga de configuração (YAML `toggle-switch`) — nunca `<input type="checkbox">`. */
export function Switch({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-checked={checked ? "true" : "false"}
      className={cn("toggle-switch", className)}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch-thumb" aria-hidden />
    </button>
  );
}
