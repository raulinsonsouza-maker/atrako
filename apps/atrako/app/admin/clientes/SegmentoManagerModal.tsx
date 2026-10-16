"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Pencil, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";

export interface Segmento {
  id: string;
  nome: string;
  cor: string;
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#ff6a00",
  "#6b7280",
];

async function fetchSegmentos(): Promise<Segmento[]> {
  const res = await fetch("/api/admin/segmentos");
  if (!res.ok) throw new Error("Erro ao carregar segmentos");
  return res.json();
}

async function createSegmento(data: { nome: string; cor: string }): Promise<Segmento> {
  const res = await fetch("/api/admin/segmentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao criar segmento");
  return json;
}

async function updateSegmento(id: string, data: { nome: string; cor: string }): Promise<Segmento> {
  const res = await fetch(`/api/admin/segmentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao atualizar");
  return json;
}

async function deleteSegmento(id: string): Promise<void> {
  const res = await fetch(`/api/admin/segmentos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir");
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Cor ${color}`}
          className="relative h-7 w-7 rounded-[var(--radius-xs)] transition active:scale-95"
          style={{ backgroundColor: color }}
        >
          {value === color ? (
            <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function CreateTab({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createSegmento({ nome, cor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["segmentos"] });
      setNome("");
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="space-y-4">
      <TextField
        label="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Restaurante"
        onKeyDown={(e) => e.key === "Enter" && nome.trim() && mutation.mutate()}
      />
      <div>
        <p className="mb-2 type-caption-strong text-[var(--ink)]">Cor</p>
        <ColorPicker value={cor} onChange={setCor} />
      </div>
      {err ? <p className="type-fine-print text-[var(--danger)]">{err}</p> : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button
          type="button"
          disabled={!nome.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          {mutation.isPending ? "Criando…" : "Criar"}
        </Button>
      </div>
    </div>
  );
}

function EditTab({ segmentos }: { segmentos: Segmento[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor] = useState("#6b7280");
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => updateSegmento(editingId!, { nome: editNome, cor: editCor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["segmentos"] });
      setEditingId(null);
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSegmento(id),
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
      <p className="py-6 text-center type-caption text-[var(--ink-muted-48)]">
        Nenhum segmento cadastrado.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {err ? <p className="type-fine-print text-[var(--danger)]">{err}</p> : null}
      {segmentos.map((s) =>
        editingId === s.id ? (
          <div
            key={s.id}
            className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] p-3"
          >
            <TextField label="Nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            <div>
              <p className="mb-2 type-caption-strong text-[var(--ink)]">Cor</p>
              <ColorPicker value={editCor} onChange={setEditCor} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!editNome.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                {updateMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2.5"
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.cor }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate type-caption text-[var(--ink)]">{s.nome}</span>
            <IconButton size="toolbar" onClick={() => startEdit(s)} aria-label={`Editar ${s.nome}`}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
            <IconButton
              size="toolbar"
              onClick={() => deleteMutation.mutate(s.id)}
              disabled={deleteMutation.isPending}
              aria-label={`Excluir ${s.nome}`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
          </div>
        ),
      )}
    </div>
  );
}

export function SegmentoManagerModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"criar" | "editar">("criar");
  const { data: segmentos = [] } = useQuery({
    queryKey: ["segmentos"],
    queryFn: fetchSegmentos,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
          <h3 className="type-body-strong text-[var(--ink)]">Segmentos</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] text-[var(--ink-muted-48)] transition hover:bg-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "criar", label: "Novo" },
              { value: "editar", label: `Lista (${segmentos.length})` },
            ]}
            aria-label="Aba de segmentos"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {tab === "criar" ? <CreateTab onClose={onClose} /> : <EditTab segmentos={segmentos} />}
        </div>
      </div>
    </div>
  );
}

export { fetchSegmentos };
