"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_MANUAL_LOST_REASONS } from "@/lib/crm/lost-reasons-shared";

export type LostReasonOption = { value: string; label: string };

/** Fallback estático (mesmos defaults do servidor). */
export const CRM_LOST_REASON_OPTIONS: LostReasonOption[] = DEFAULT_MANUAL_LOST_REASONS.map((r) => ({
  value: r.id,
  label: r.label,
}));

type Props = {
  role: "WON" | "LOST";
  amount: string;
  reason: string;
  /** Motivos do workspace; se omitido, usa o default. */
  reasons?: LostReasonOption[];
  busy?: boolean;
  onAmountChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: (e: React.FormEvent) => void;
};

/** Diálogo compacto de fechamento: valor (ganho) ou motivo (perdido). Sem dropdown — evita corte no overlay. */
export function CrmCloseLeadDialog({
  role,
  amount,
  reason,
  reasons,
  busy,
  onAmountChange,
  onReasonChange,
  onCancel,
  onConfirm,
}: Props) {
  const options = reasons?.length ? reasons : CRM_LOST_REASON_OPTIONS;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-lead-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <form
        onSubmit={onConfirm}
        className="w-full max-w-[360px] rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-[var(--divider-soft)] px-5 py-4">
          <h2 id="close-lead-title" className="type-tagline text-[var(--ink)]">
            {role === "WON" ? "Valor do negócio" : "Motivo da perda"}
          </h2>
          {role === "LOST" ? (
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Escolha o motivo e confirme.
            </p>
          ) : null}
        </header>

        <div className="space-y-3 px-5 py-4">
          {role === "WON" ? (
            <label className="block">
              <span className="type-micro-legal text-[var(--ink-muted-48)]">Valor em reais</span>
              <input
                className="mt-1.5 h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
              />
            </label>
          ) : (
            <ul className="max-h-[280px] space-y-1.5 overflow-y-auto" role="listbox" aria-label="Motivo da perda">
              {options.map((opt) => {
                const selected = reason === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onReasonChange(opt.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-[var(--radius-xs)] border px-3.5 py-2.5 text-left type-caption transition active:scale-[0.99]",
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary-glow)] type-caption-strong text-[var(--ink)]"
                          : "border-[var(--hairline)] bg-[var(--canvas)] text-[var(--ink)]",
                      )}
                    >
                      {opt.label}
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" strokeWidth={2.25} />
                      ) : (
                        <span className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--divider-soft)] px-5 py-4">
          <Button type="button" variant="outline" size="toolbar" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="toolbar" disabled={busy}>
            Confirmar
          </Button>
        </div>
      </form>
    </div>
  );
}
