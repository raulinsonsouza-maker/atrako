"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Pencil, Trash2, Check } from "lucide-react";

export interface Segmento {
  id: string;
  nome: string;
  cor: string;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899", "#ff6a00", "#6b7280",
];

async function fetchSegmentos(): Promise<Segmento[]> {
  const res = await fetch("/api/admin/segmentos");
  if (!res.ok) throw new Error("Erro ao carregar segmentos");
  return res.json();
}

async function createSegmento(data: { nome: string; cor: string }, token: string): Promise<Segmento> {
  const res = await fetch("/api/admin/segmentos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao criar segmento");
  return json;
}

async function updateSegmento(id: string, data: { nome: string; cor: string }, token: string): Promise<Segmento> {
  const res = await fetch(`/api/admin/segmentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao atualizar");
  return json;
}

async function deleteSegmento(id: string, token: string): Promise<void> {
  const res = await fetch(`/api/admin/segmentos/${id}`, {
    method: "DELETE",
    headers: token ? { "x-admin-token": token } : {},
  });
  if (!res.ok) throw new Error("Erro ao excluir");
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="relative h-7 w-7 rounded-lg transition hover:scale-110"
          style={{ backgroundColor: color }}
        >
          {value === color && (
            <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />
          )}
        </button>
      ))}
    </div>
  );
}

function CreateTab({ adminToken, onClose }: { adminToken: string; onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createSegmento({ nome, cor }, adminToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["segmentos"] });
      setNome("");
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Nome do segmento
        </label>
        <div className="flex items-center gap-2">
          <div
            className="h-5 w-5 shrink-0 rounded-md"
            style={{ backgroundColor: cor }}
          />
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Imobiliário"
            onKeyDown={(e) => e.key === "Enter" && nome.trim() && mutation.mutate()}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--primary)]/40 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Cor da tag
        </label>
        <ColorPicker value={cor} onChange={setCor} />
      </div>

      {err && <p className="text-[11px] text-red-500">{err}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!nome.trim() || mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {mutation.isPending ? "Criando..." : "Criar segmento"}
        </button>
      </div>
    </div>
  );
}

function EditTab({ segmentos, adminToken }: { segmentos: Segmento[]; adminToken: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor] = useState("#6b7280");
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => updateSegmento(editingId!, { nome: editNome, cor: editCor }, adminToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["segmentos"] });
      setEditingId(null);
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSegmento(id, adminToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["segmentos"] }),
    onError: (e: Error) => setErr(e.message),
  });

  function startEdit(s: Segmento) {
    setEditingId(s.id);
    setEditNome(s.nome);
    setEditCor(s.cor);
    setErr("");
  }

  if (segmentos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
        Nenhum segmento cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-[11px] text-red-500">{err}</p>}
      {segmentos.map((s) =>
        editingId === s.id ? (
          <div
            key={s.id}
            className="space-y-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/3 p-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 shrink-0 rounded-md" style={{ backgroundColor: editCor }} />
              <input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:border-[var(--primary)]/40 focus:outline-none"
              />
            </div>
            <ColorPicker value={editCor} onChange={setEditCor} />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={!editNome.trim() || updateMutation.isPending}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
          >
            <div className="h-4 w-4 shrink-0 rounded-md" style={{ backgroundColor: s.cor }} />
            <span className="flex-1 text-sm font-medium text-[var(--foreground)]">{s.nome}</span>
            <span
              className="mr-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: s.cor }}
            >
              {s.nome}
            </span>
            <button
              type="button"
              onClick={() => startEdit(s)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(s.id)}
              disabled={deleteMutation.isPending}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      )}
    </div>
  );
}

interface SegmentoManagerModalProps {
  adminToken: string;
  onClose: () => void;
}

export function SegmentoManagerModal({ adminToken, onClose }: SegmentoManagerModalProps) {
  const [tab, setTab] = useState<"criar" | "editar">("criar");

  const { data: segmentos = [] } = useQuery({
    queryKey: ["segmentos"],
    queryFn: fetchSegmentos,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Gerenciar Segmentos</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-5 pt-3">
          {(["criar", "editar"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-4 py-2 text-xs font-semibold transition ${
                tab === t
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t === "criar" ? "Novo segmento" : `Editar (${segmentos.length})`}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {tab === "criar" ? (
            <CreateTab adminToken={adminToken} onClose={onClose} />
          ) : (
            <EditTab segmentos={segmentos} adminToken={adminToken} />
          )}
        </div>
      </div>
    </div>
  );
}

export { fetchSegmentos };
