"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_COLOR_PRESETS } from "@/components/crm/CrmStageHeader";

type StageDraft = {
  key: string;
  id?: string;
  name: string;
  color: string;
  role: "ENTRY" | "WON" | null;
};

type Props = {
  workspaceId: string;
  stages: Array<{
    id: string;
    name: string;
    color: string;
    role?: "ENTRY" | "WON" | null;
  }>;
  onClose: () => void;
  onSaved: () => void;
};

function toDrafts(
  stages: Props["stages"],
): { entry: StageDraft; middle: StageDraft[]; won: StageDraft } {
  const entryRow = stages.find((s) => s.role === "ENTRY") ?? stages[0];
  const wonRow = stages.find((s) => s.role === "WON") ?? stages[stages.length - 1];
  const middle = stages
    .filter((s) => s.role !== "ENTRY" && s.role !== "WON")
    .map((s) => ({
      key: s.id,
      id: s.id,
      name: s.name,
      color: s.color || STAGE_COLOR_PRESETS[0],
      role: null as null,
    }));
  return {
    entry: {
      key: entryRow?.id ?? "entry",
      id: entryRow?.id,
      name: entryRow?.name ?? "Novo",
      color: entryRow?.color || STAGE_COLOR_PRESETS[0],
      role: "ENTRY",
    },
    middle,
    won: {
      key: wonRow?.id ?? "won",
      id: wonRow?.id,
      name: wonRow?.name ?? "Ganho",
      color: wonRow?.color || "#34C759",
      role: "WON",
    },
  };
}

/** Modal unificado para configurar etapas do funil. */
export function CrmFunnelConfigModal({
  workspaceId,
  stages,
  onClose,
  onSaved,
}: Props) {
  const initial = useMemo(() => toDrafts(stages), [stages]);
  const [entry, setEntry] = useState(initial.entry);
  const [middle, setMiddle] = useState(initial.middle);
  const [won, setWon] = useState(initial.won);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    const next = toDrafts(stages);
    setEntry(next.entry);
    setMiddle(next.middle);
    setWon(next.won);
  }, [stages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        if (editingKey) setEditingKey(null);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving, editingKey]);

  function addStage() {
    const key = `new_${Math.random().toString(36).slice(2, 9)}`;
    setMiddle((prev) => [
      ...prev,
      {
        key,
        name: "Nova etapa",
        color: STAGE_COLOR_PRESETS[1],
        role: null,
      },
    ]);
    setEditingKey(key);
  }

  function removeStage(key: string) {
    setMiddle((prev) => prev.filter((s) => s.key !== key));
    if (editingKey === key) setEditingKey(null);
  }

  function patchMiddle(key: string, patch: Partial<StageDraft>) {
    setMiddle((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function onDropOver(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    setMiddle((prev) => {
      const from = prev.findIndex((s) => s.key === dragKey);
      const to = prev.findIndex((s) => s.key === targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
    setDragKey(null);
  }

  async function save() {
    if (saving) return;
    if (!entry.name.trim() || !won.name.trim()) {
      setError("Dê um nome à entrada e ao fechamento.");
      return;
    }
    for (const s of middle) {
      if (!s.name.trim()) {
        setError("Todas as etapas precisam de um nome.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/crm/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "configure",
          entryName: entry.name.trim(),
          entryColor: entry.color,
          wonName: won.name.trim(),
          wonColor: won.color,
          middle: middle.map((s) => ({
            id: s.id,
            name: s.name.trim(),
            color: s.color,
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao salvar");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="funnel-config-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="funnel-config-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="funnel-config-modal">
        <header className="funnel-config-header">
          <div className="min-w-0 flex-1">
            <h2 id="funnel-config-title" className="type-tagline text-[var(--ink)]">
              Etapas do funil
            </h2>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Clique no lápis para editar nome e cor. Arraste para mudar a ordem.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              className="!px-3 !py-1.5"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void save()}
              disabled={saving}
              className="!gap-1.5 !px-4 !py-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[var(--radius-xs)] p-2 text-[var(--ink-muted-48)] active:scale-95"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="funnel-config-body">
          <section className="funnel-config-section">
            <p className="type-caption-strong text-[var(--ink)]">Entrada</p>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Onde os leads chegam.
            </p>
            <StageRow
              draft={entry}
              editing={editingKey === entry.key}
              onEdit={() => setEditingKey(entry.key)}
              onDone={() => setEditingKey(null)}
              onName={(name) => setEntry((e) => ({ ...e, name }))}
              onColor={(color) => setEntry((e) => ({ ...e, color }))}
            />
          </section>

          <section className="funnel-config-section">
            <p className="type-caption-strong text-[var(--ink)]">No meio do caminho</p>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Suas etapas. Remover move os leads para a entrada.
            </p>
            <ul className="mt-3 space-y-2">
              {middle.map((s) => (
                <li key={s.key}>
                  <StageRow
                    draft={s}
                    draggable
                    dragging={dragKey === s.key}
                    editing={editingKey === s.key}
                    onEdit={() => setEditingKey(s.key)}
                    onDone={() => setEditingKey(null)}
                    onDragStart={() => setDragKey(s.key)}
                    onDragEnd={() => setDragKey(null)}
                    onDrop={() => onDropOver(s.key)}
                    onName={(name) => patchMiddle(s.key, { name })}
                    onColor={(color) => patchMiddle(s.key, { color })}
                    onRemove={() => removeStage(s.key)}
                  />
                </li>
              ))}
            </ul>
            <button type="button" className="funnel-config-add" onClick={addStage}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Adicionar etapa
            </button>
          </section>

          <section className="funnel-config-section">
            <p className="type-caption-strong text-[var(--ink)]">Fechamento</p>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Quando o lead vira cliente.
            </p>
            <StageRow
              draft={won}
              editing={editingKey === won.key}
              onEdit={() => setEditingKey(won.key)}
              onDone={() => setEditingKey(null)}
              onName={(name) => setWon((w) => ({ ...w, name }))}
              onColor={(color) => setWon((w) => ({ ...w, color }))}
            />
          </section>

          {error ? (
            <p className="type-caption text-[var(--danger)]">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StageRow({
  draft,
  draggable,
  dragging,
  editing,
  onEdit,
  onDone,
  onDragStart,
  onDragEnd,
  onDrop,
  onName,
  onColor,
  onRemove,
}: {
  draft: StageDraft;
  draggable?: boolean;
  dragging?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onDone?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  onName?: (name: string) => void;
  onColor?: (color: string) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="funnel-config-stage"
      data-dragging={dragging ? "true" : "false"}
      data-editing={editing ? "true" : "false"}
      style={{ ["--stage-color" as string]: draft.color }}
      draggable={Boolean(draggable) && !editing}
      onDragStart={(e) => {
        if (!draggable || editing) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      onDragEnd={onDragEnd}
    >
      {draggable ? (
        <span className="funnel-config-grip" aria-hidden title="Arrastar">
          <GripVertical className="h-4 w-4" strokeWidth={1.75} />
        </span>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="funnel-config-swatch" aria-hidden />

      {editing ? (
        <div className="funnel-config-edit">
          <input
            ref={inputRef}
            className="funnel-config-name"
            value={draft.name}
            onChange={(e) => onName?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onDone?.();
            }}
            aria-label="Nome da etapa"
            placeholder="Nome da etapa"
          />
          <div className="funnel-config-colors">
            {STAGE_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onColor?.(c)}
                className="h-5 w-5 rounded-full active:scale-95"
                style={{
                  background: c,
                  outline:
                    draft.color.toLowerCase() === c.toLowerCase()
                      ? "2px solid var(--ink)"
                      : "none",
                  outlineOffset: 1,
                }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="primary"
            className="!px-3 !py-1 type-button-utility"
            onClick={onDone}
          >
            Pronto
          </Button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="funnel-config-label"
            onClick={onEdit}
          >
            <span className="min-w-0 truncate type-caption-strong text-[var(--ink)]">
              {draft.name || "Sem nome"}
            </span>
            <Pencil
              className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1.5 text-[var(--ink-muted-48)] hover:text-[var(--danger)] active:scale-95"
              aria-label="Remover etapa"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
