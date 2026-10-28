"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { CommentDmWizard, type CommentDmConfig } from "@/components/symbius/CommentDmWizard";
import { DirectDmWizard, type DirectButton, type DirectDmInitial } from "@/components/symbius/DirectDmWizard";
import { StoryReplyWizard, type StoryReplyInitial } from "@/components/symbius/StoryReplyWizard";
import { AutomationRow } from "./AutomationRow";
import { useIgAutomations, type IgFluxo } from "./useIgAutomations";

const TRIGGER_LABELS: Record<string, string> = {
  comment_keyword: "Comentário com palavra-chave",
  story_reply: "Resposta a Story",
  story_mention: "Menção em Story",
  live_comment: "Comentário em Live",
  welcome: "Boas-vindas",
  keyword: "Mensagem recebida no Direct",
  unset: "Não configurado",
};

function flowName(flow: IgFluxo) {
  const nome = flow.nome?.trim() ?? "";
  if (!nome || nome.toLowerCase() === "sem título" || nome.toLowerCase() === "sem titulo") {
    return TRIGGER_LABELS[flow.triggerType ?? "unset"] ?? "Automação";
  }
  return nome;
}

function initialFrom(flow: IgFluxo): Partial<CommentDmConfig> & { fluxoId: string } {
  const cfg = (flow.triggerConfig ?? {}) as Partial<CommentDmConfig>;
  return { ...cfg, fluxoId: flow.id, nome: flow.nome };
}

function storyInitial(flow: IgFluxo): StoryReplyInitial {
  const cfg = (flow.triggerConfig ?? {}) as Record<string, unknown>;
  const links = Array.isArray(cfg.rewardLinks)
    ? cfg.rewardLinks
        .map((item) => {
          const row = item as { label?: string; url?: string };
          return { label: String(row?.label ?? ""), url: String(row?.url ?? "") };
        })
        .filter((item) => item.url)
    : undefined;
  return {
    fluxoId: flow.id,
    nome: flow.nome,
    storyFilter: cfg.storyFilter === "specific" ? "specific" : "any",
    storyId: typeof cfg.storyId === "string" ? cfg.storyId : null,
    anyKeyword: cfg.anyKeyword !== false,
    keywords: Array.isArray(cfg.keywords) ? cfg.keywords.map(String) : [],
    rewardText: typeof cfg.rewardText === "string" ? cfg.rewardText : undefined,
    rewardButton: typeof cfg.rewardButton === "string" ? cfg.rewardButton : undefined,
    rewardUrl: typeof cfg.rewardUrl === "string" ? cfg.rewardUrl : undefined,
    rewardLinks: links,
    followEnabled: cfg.followEnabled === true,
    followText: typeof cfg.followText === "string" ? cfg.followText : undefined,
    emailEnabled: cfg.emailEnabled === true,
    emailText: typeof cfg.emailText === "string" ? cfg.emailText : undefined,
    reminderEnabled: cfg.reminderEnabled === true,
    reminderText: typeof cfg.reminderText === "string" ? cfg.reminderText : undefined,
    reminderMinutes: typeof cfg.reminderMinutes === "number" ? cfg.reminderMinutes : undefined,
    reactLove: cfg.reactLove === true,
  };
}

function directInitial(flow: IgFluxo): DirectDmInitial {
  const cfg = (flow.triggerConfig ?? {}) as Record<string, unknown>;
  const buttons = Array.isArray(cfg.buttons)
    ? cfg.buttons.slice(0, 3).map((item) => {
        const row = item as Partial<DirectButton>;
        const action = row.action === "link" || row.action === "handoff" ? row.action : "reply";
        return {
          label: String(row.label ?? ""),
          action,
          text: String(row.text ?? ""),
          url: String(row.url ?? ""),
          thanks: String(row.thanks ?? ""),
        };
      })
    : [];
  return {
    fluxoId: flow.id,
    nome: flow.nome,
    anyKeyword: cfg.anyKeyword === true,
    keywords: Array.isArray(cfg.keywords) ? cfg.keywords.map(String) : [],
    replyText: typeof cfg.replyText === "string" ? cfg.replyText : undefined,
    buttons,
  };
}

type Editing = IgFluxo | "new" | "new-story" | "new-direct" | null;

export function InstagramMensagensView({ workspaceId }: { workspaceId: string }) {
  const { flows, isLoading, error, refetch } = useIgAutomations(workspaceId);
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<Editing>(null);
  const [picking, setPicking] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const opened = useRef(false);

  const fluxoId = searchParams.get("fluxo");
  const recipe = searchParams.get("recipe");

  useEffect(() => {
    if (opened.current) return;
    if (fluxoId) {
      if (isLoading) return;
      const found = flows.find((flow) => flow.id === fluxoId);
      opened.current = true;
      if (found) setEditing(found);
      return;
    }
    if (recipe) {
      opened.current = true;
      setEditing(recipe.startsWith("story") ? "new-story" : recipe.includes("keyword") ? "new-direct" : "new");
    }
  }, [fluxoId, recipe, flows, isLoading]);

  async function setPublished(flow: IgFluxo, on: boolean) {
    setToggleError(null);
    const r = await fetch(`/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: flow.id, status: on ? "PUBLISHED" : "DRAFT" }),
    });
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      setToggleError(body.error || "Não foi possível atualizar.");
      return;
    }
    void refetch();
  }

  async function removeFlow(flow: IgFluxo) {
    const name = flowName(flow);
    if (!window.confirm(`Excluir “${name}”?`)) return;
    setToggleError(null);
    const r = await fetch(`/api/symbius/flows/${encodeURIComponent(flow.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      setToggleError(body.error || "Não foi possível excluir.");
      return;
    }
    void refetch();
  }

  const openedFlow = typeof editing === "object" && editing ? editing : null;

  if (editing === "new-story" || openedFlow?.triggerType === "story_reply") {
    const initial = openedFlow?.triggerType === "story_reply" ? storyInitial(openedFlow) : undefined;
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <StoryReplyWizard
          workspaceId={workspaceId}
          initial={initial}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setPicking(false);
            setEditing(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  if (editing === "new-direct" || openedFlow?.triggerType === "keyword") {
    const initial = openedFlow?.triggerType === "keyword" ? directInitial(openedFlow) : undefined;
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <DirectDmWizard
          workspaceId={workspaceId}
          initial={initial}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setPicking(false);
            setEditing(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <CommentDmWizard
          workspaceId={workspaceId}
          defaultName="Comentário → DM"
          initial={editing === "new" ? undefined : initialFrom(editing)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setPicking(false);
            setEditing(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  if (picking) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink onClick={() => setPicking(false)}>Mensagens</BackLink>
        <AutomationRow
          name="Comentário em publicação ou Reel"
          detail="Manda uma mensagem no Direct quando alguém comenta."
          onOpen={() => setEditing("new")}
        />
        <AutomationRow
          name="Resposta a Story"
          detail="Manda uma mensagem no Direct quando alguém responde um story."
          onOpen={() => setEditing("new-story")}
        />
        <AutomationRow
          name="Mensagem recebida no Direct"
          detail="Responde quando alguém escreve na caixa do Instagram."
          onOpen={() => setEditing("new-direct")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button type="button" size="toolbar" onClick={() => setPicking(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nova automação
        </Button>
      </div>
      {toggleError ? <p className="type-caption text-[var(--danger)]">{toggleError}</p> : null}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted-48)]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="type-caption text-[var(--danger)]">{error}</p>
          <button type="button" onClick={() => void refetch()} className="type-caption text-[var(--ink-muted-48)] underline">
            Tentar novamente
          </button>
        </div>
      ) : flows.length === 0 ? (
        <p className="type-body text-[var(--ink-muted)]">Nenhuma automação ainda.</p>
      ) : (
        flows.map((flow) => (
          <AutomationRow
            key={flow.id}
            name={flowName(flow)}
            detail={TRIGGER_LABELS[flow.triggerType ?? "unset"] ?? flow.triggerType ?? "Automação"}
            onOpen={() => setEditing(flow)}
            checked={flow.status === "PUBLISHED"}
            onChecked={(on) => void setPublished(flow, on)}
            switchLabel={flowName(flow)}
            trailing={
              <IconButton size="toolbar" className="text-[var(--danger)]" aria-label={`Excluir ${flowName(flow)}`} onClick={() => void removeFlow(flow)}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            }
          />
        ))
      )}
    </div>
  );
}
