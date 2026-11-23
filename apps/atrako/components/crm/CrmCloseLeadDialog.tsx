"use client";

import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui";

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

/** Diálogo de fechamento: valor (ganho) ou motivo (perdido). Usado no board e no modal do lead. */
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
    <div className="funnel-config-backdrop" role="dialog" aria-modal="true" aria-labelledby="close-lead-title">
      <form onSubmit={onConfirm} className="funnel-config-modal">
        <header className="funnel-config-header">
          <h2 id="close-lead-title" className="type-tagline text-[var(--ink)]">
            {role === "WON" ? "Valor do negócio" : "Motivo da perda"}
          </h2>
        </header>
        <div className="funnel-config-body">
          {role === "WON" ? (
            <label className="block">
              <span className="type-micro-legal text-[var(--ink-muted-48)]">Valor em reais</span>
              <input
                className="mt-1.5 h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
              />
            </label>
          ) : (
            <PillSelect
              size="field"
              value={reason}
              onChange={onReasonChange}
              options={[...CRM_LOST_REASON_OPTIONS]}
              aria-label="Motivo da perda"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
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
