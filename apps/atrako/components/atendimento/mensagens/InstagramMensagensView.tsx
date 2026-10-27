"use client";

import { Loader2, Plus, Pencil, Instagram } from "lucide-react";
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
  const { flows, instagramConnected, isLoading, error, refetch } = useIgAutomations(workspaceId);
  const newFlowHref = `/social/flows/new?workspaceId=${encodeURIComponent(workspaceId)}`;

  return (
    <AppPage
      title="Automações Instagram"
      className="md:pt-5"
      actions={
        instagramConnected ? (
          <a
            href={newFlowHref}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-caption-strong text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova automação
          </a>
        ) : null
      }
    >

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted-48)]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="type-caption text-[var(--danger)]">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="type-caption text-[var(--ink-muted-48)] underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : !instagramConnected ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Instagram className="h-6 w-6 text-[var(--ink-muted-48)]" />
          <p className="type-body text-[var(--ink)]">
            Conecte o Instagram da Meta para as automações responderem comentários e stories.
          </p>
          <p className="type-caption text-[var(--ink-muted-48)] max-w-md">
            Use a mesma conexão do dashboard. Em Configurações, abra Conexões e conecte a Meta
            com permissão de comentários e mensagens.
          </p>
          <a
            href="/config/conexoes"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption-strong text-white"
          >
            Abrir conexões
          </a>
        </div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="type-body text-[var(--ink-muted)]">
            Nenhuma automação Instagram criada ainda.
          </p>
          <p className="type-caption text-[var(--ink-muted-48)] max-w-md">
            Crie fluxos que respondem a comentários, respostas a Stories e menções,
            enviando DMs automáticas com links e boas-vindas.
          </p>
          <div className="flex gap-3">
            <a
              href={newFlowHref}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption-strong text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar automação
            </a>
            <a
              href="/social/inbox"
              className="type-caption-strong text-[var(--primary)] underline self-center"
            >
              Ver inbox de conversas
            </a>
          </div>
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
                  {f._count?.execucoes ?? 0} execuções · {f._count?.nos ?? 0} nós
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`type-caption-strong ${
                    f.status === "PUBLISHED" ? "text-[var(--success)]" : "text-[var(--ink-muted-48)]"
                  }`}
                >
                  {f.status === "PUBLISHED" ? "Ativo" : "Rascunho"}
                </span>
                  <a
                    href={`/social/flows/${f.id}`}
                    className="inline-flex items-center gap-1 type-caption text-[var(--primary)] underline"
                  >
                  <Pencil className="h-3 w-3" />
                  Editar
                </a>
              </div>
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