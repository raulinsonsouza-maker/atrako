"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DEFAULT_MANUAL_LOST_REASONS,
  uniqueLostReasonId,
  type ManualLostReasonItem,
} from "@/lib/crm/lost-reasons-shared";

type Props = {
  workspaceId: string;
  onClose: () => void;
  onSaved?: () => void;
};

/** Editor CRUD dos motivos manuais de perda (PUT imediato). */
export function CrmLostReasonsEditor({ workspaceId, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<ManualLostReasonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/atrako/crm/lost-reasons?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          reasons?: ManualLostReasonItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Falha ao carregar");
        if (!cancelled) {
          setRows(data.reasons?.length ? data.reasons : [...DEFAULT_MANUAL_LOST_REASONS]);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRows([...DEFAULT_MANUAL_LOST_REASONS]);
          setError(e instanceof Error ? e.message : "Falha ao carregar");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function addRow() {
    const label = draftLabel.trim();
    if (!label) return;
    const id = uniqueLostReasonId(
      label,
      rows.map((r) => r.id),
    );
    setRows((prev) => [...prev, { id, label }]);
    setDraftLabel("");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/atrako/crm/lost-reasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reasons: rows }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reasons?: ManualLostReasonItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setRows(data.reasons ?? rows);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lost-reasons-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="flex max-h-[min(520px,90vh)] w-full max-w-[400px] flex-col rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--divider-soft)] px-5 py-4">
          <div>
            <h2 id="lost-reasons-title" className="type-tagline text-[var(--ink)]">
              Motivos da perda
            </h2>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Aparecem ao marcar um lead como perdido.
            </p>
          </div>
          <IconButton type="button" aria-label="Fechar" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row, idx) => (
                <li key={row.id} className="flex items-center gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
                    value={row.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, label } : r)),
                      );
                    }}
                    aria-label={`Motivo ${idx + 1}`}
                  />
                  <IconButton
                    type="button"
                    aria-label="Excluir motivo"
                    disabled={rows.length <= 1 || saving}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="Novo motivo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRow();
                }
              }}
              disabled={loading || saving || rows.length >= 12}
            />
            <Button
              type="button"
              variant="outline"
              size="toolbar"
              onClick={addRow}
              disabled={loading || saving || !draftLabel.trim() || rows.length >= 12}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Adicionar
            </Button>
          </div>

          {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--divider-soft)] px-5 py-4">
          <Button type="button" variant="outline" size="toolbar" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="toolbar" onClick={() => void save()} disabled={loading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
