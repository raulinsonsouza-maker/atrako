"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CRM_LOST_REASON_OPTIONS = [
  { value: "preco", label: "Preço" },
  { value: "sem_fit", label: "Sem fit" },
  { value: "concorrente", label: "Concorrente" },
  { value: "sem_resposta", label: "Sem resposta" },
] as const;

type Props = {
  role: "WON" | "LOST";
  amount: string;
  reason: string;
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
  busy,
  onAmountChange,
  onReasonChange,
  onCancel,
  onConfirm,
}: Props) {
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
            <ul className="space-y-1.5" role="listbox" aria-label="Motivo da perda">
              {CRM_LOST_REASON_OPTIONS.map((opt) => {
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
