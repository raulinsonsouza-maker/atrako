"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAGE_COLOR_PRESETS = [
  "#8E8E93",
  "#0066cc",
  "#0071e3",
  "#1d1d1f",
  "#34C759",
  "#FF9500",
  "#FF2D55",
  "#AF52DE",
];

type StageRole = "ENTRY" | "WON" | "ABANDONED" | "ABANDONED_7" | "ABANDONED_30" | "ABANDONED_60" | "LOST" | null;

type Props = {
  stageId: string;
  name: string;
  color: string;
  count: number;
  /** Valor somado da coluna (ex.: carrinhos em aberto). */
  valueLabel?: string;
  role?: StageRole;
  editable?: boolean;
  onSave: (patch: { name: string; color: string }) => Promise<void>;
};

const FIXED_ROLE_HINT: Record<Exclude<StageRole, null>, string> = {
  ENTRY: "Entrada do funil — o nome é só um rótulo.",
  ABANDONED:
    "Carrinho abandonado — pedidos não pagos e checkouts da loja entram aqui sozinhos.",
  ABANDONED_7: "Carrinho aberto sem compra há mais de 7 dias — o card chega aqui sozinho.",
  ABANDONED_30: "Carrinho aberto sem compra há mais de 30 dias — o card chega aqui sozinho.",
  ABANDONED_60: "Carrinho aberto sem compra há mais de 60 dias — aos 90 dias vai para Perdido.",
  WON: "Fechamento (ganho) — o nome é só um rótulo.",
  LOST:
    "Perdido — carrinho sem compra há mais de 90 dias ou reembolso. O contato segue na base para reativação.",
};

/** Header da coluna — ENTRY, ABANDONED, WON e LOST são fixos na posição; nomes editáveis. */
export function CrmStageHeader({
  name,
  color,
  count,
  valueLabel,
  role = null,
  editable = true,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState(color);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setDraftName(name);
      setDraftColor(color);
    }
  }, [open, name, color]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save() {
    if (saving) return;
    const nextName = draftName.trim();
    if (!nextName) return;
    if (nextName === name && draftColor === color) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: nextName, color: draftColor });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "pipeline-column-header relative",
        role === "ENTRY" && "pipeline-column-header-entry",
        role === "WON" && "pipeline-column-header-won",
        (role === "LOST" || role?.startsWith("ABANDONED")) && "pipeline-column-header-abandoned",
      )}
    >
      <button
        type="button"
        disabled={!editable}
        onClick={() => editable && setOpen((v) => !v)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-left",
          editable && "active:scale-[0.99]",
        )}
        aria-label={editable ? `Editar etapa ${name}` : name}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <h3 className="min-w-0 type-caption-strong leading-tight text-[var(--ink)]">{name}</h3>
            {editable ? (
              <Pencil
                className="pipeline-column-edit h-3 w-3 shrink-0 text-[var(--ink-muted-48)] opacity-0 transition"
                strokeWidth={1.75}
              />
            ) : null}
          </span>
          {valueLabel ? (
            <span className="block type-fine-print tabular-nums text-[var(--ink-muted-48)]">{valueLabel}</span>
          ) : null}
        </span>
      </button>
      <span className="shrink-0 rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 type-fine-print tabular-nums text-[var(--ink-muted-80)]">
        {count}
      </span>

      {open ? (
        <div className="absolute left-2 right-2 top-[calc(100%+6px)] z-20 space-y-3 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] p-3">
          {role ? (
            <p className="type-fine-print text-[var(--ink-muted-48)]">{FIXED_ROLE_HINT[role]}</p>
          ) : null}
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Nome</span>
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              className="mt-1 h-9 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
            />
          </label>
          <div>
            <p className="mb-2 type-micro-legal text-[var(--ink-muted-48)]">Cor</p>
            <div className="flex flex-wrap gap-2">
              {STAGE_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={draftColor.toLowerCase() === c.toLowerCase()}
                  onClick={() => setDraftColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition active:scale-95",
                    draftColor.toLowerCase() === c.toLowerCase()
                      ? "ring-2 ring-[var(--primary-focus)] ring-offset-2"
                      : "ring-1 ring-[var(--hairline)]",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={saving || !draftName.trim()}
            onClick={() => void save()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-2 type-caption-strong text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            {saving ? "…" : "Salvar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
