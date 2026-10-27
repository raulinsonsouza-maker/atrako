"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/ui";

export function AutomationRow({
  name,
  detail,
  onOpen,
  checked,
  onChecked,
  switchLabel,
  trailing,
}: {
  name: string;
  detail: string;
  onOpen: () => void;
  checked?: boolean;
  onChecked?: (on: boolean) => void;
  switchLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3.5">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="type-body-strong block truncate text-[var(--ink)]">{name}</span>
        <span className="type-caption block truncate text-[var(--ink-muted-48)]">{detail}</span>
      </button>
      {trailing}
      {typeof checked === "boolean" ? (
        <Switch
          checked={checked}
          onChange={onChecked ?? (() => undefined)}
          disabled={!onChecked}
          aria-label={switchLabel ?? name}
        />
      ) : null}
    </div>
  );
}
