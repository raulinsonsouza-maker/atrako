"use client";

import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { useIgAutomations } from "./useIgAutomations";

const TRIGGER_LABELS: Record<string, string> = {
  comment_keyword: "Comentário com palavra-chave",
  story_reply: "Resposta a Story",
  story_mention: "Menção em Story",
  live_comment: "Comentário em Live",
  welcome: "Boas-vindas",
  unset: "Não configurado",
};

export function InstagramMensagensView({ workspaceId }: { workspaceId: string }) {
  const { flows, isLoading, error, refetch } = useIgAutomations();

  return (
    <AppPage title="Automações Instagram" className="md:pt-5">
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted-48)]" />
        </div>
      ) : error ? (
        <p className="type-caption text-[var(--danger)]">{error}</p>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="type-body text-[var(--ink-muted)]">
            Nenhuma automação Instagram criada ainda.
          </p>
          <a
            href="/social/inbox"
            className="type-caption-strong text-[var(--primary)] underline"
          >
            Ver inbox de conversas
          </a>
          <button
            type="button"
            onClick={refetch}
            className="type-caption text-[var(--ink-muted-48)] underline"
          >
            Recarregar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flows.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-[var(--radius-xs)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="type-body-strong text-[var(--ink)]">{f.nome}</span>
                <span className="type-caption text-[var(--ink-muted-48)]">
                  {TRIGGER_LABELS[f.triggerType ?? "unset"] ?? f.triggerType} ·{" "}
                  {f._count?.execucoes ?? 0} execuções
                </span>
              </div>
              <span
                className={`type-caption-strong ${
                  f.status === "PUBLISHED" ? "text-[var(--success)]" : "text-[var(--ink-muted-48)]"
                }`}
              >
                {f.status === "PUBLISHED" ? "Ativo" : "Rascunho"}
              </span>
            </div>
          ))}
          <a
            href="/social/inbox"
            className="type-caption text-[var(--ink-muted-48)] underline self-start"
          >
            Ver inbox de conversas Instagram →
          </a>
        </div>
      )}
    </AppPage>
  );
}