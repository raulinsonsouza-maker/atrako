"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QualifyFieldKey } from "@/lib/qualification/fields";
import type { QualifyScript, ScriptBlockId } from "@/lib/qualification/script";
import type { TemplateBlock, TemplateState } from "@/lib/qualification/templates";

export type Jornada = {
  brand: string;
  enabled: boolean;
  lpKeys: QualifyFieldKey[];
  script: QualifyScript;
  defaults: QualifyScript;
  customized: ScriptBlockId[];
  channels: {
    whatsapp: { connected: boolean; phone: string | null };
    email: { connected: boolean; from: string | null };
  };
  templates: Record<TemplateBlock, TemplateState>;
  live: { qualifying: number; withTeam: number; noReply: number; nurture: number };
  priorities: { A: number; B: number; C: number };
  answerCounts: Partial<Record<QualifyFieldKey, Record<string, number>>>;
};

export type SaveResult = {
  ok: true;
  template?: { synced: boolean; reason?: string; error?: string } | null;
};

export function useJornada(workspaceId: string) {
  const qc = useQueryClient();
  const key = ["atendimento-jornada", workspaceId];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/atendimento/jornada?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!r.ok) throw new Error("Falha ao carregar");
      return (await r.json()) as Jornada;
    },
  });

  const post = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/atrako/atendimento/jornada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...body }),
      });
      const json = (await r.json().catch(() => ({}))) as { error?: string } & Partial<SaveResult>;
      if (!r.ok) throw new Error(json.error || "Não foi possível salvar");
      return json as SaveResult;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return { ...query, post };
}

export const TEMPLATE_STATE_LABEL: Record<TemplateState, { label: string; tone?: "ok" | "warn" | "bad" }> = {
  missing: { label: "Modelo ainda não criado" },
  approved: { label: "Aprovado pela Meta", tone: "ok" },
  pending: { label: "Em análise na Meta", tone: "warn" },
  updating: { label: "Nova versão em análise · a anterior segue valendo", tone: "warn" },
  rejected: { label: "Reprovado pela Meta", tone: "bad" },
};
