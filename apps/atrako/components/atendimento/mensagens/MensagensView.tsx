"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { AppPage } from "@/components/layout/AppPage";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { FollowUpEditor } from "./FollowUpEditor";
import { ScriptEditor } from "./ScriptEditor";
import { robotStatus } from "./SetupChecklist";
import { AutomationRow } from "./AutomationRow";
import { useJornada, type Jornada } from "./useJornada";
import { useScriptDraft } from "./useScriptDraft";

type Open = "conversa" | "sem-resposta" | null;

function WhatsAppBody({
  data,
  post,
  canManage,
}: {
  data: Jornada;
  post: ReturnType<typeof useJornada>["post"];
  canManage: boolean;
}) {
  const s = useScriptDraft(data, post);
  const [open, setOpen] = useState<Open>(null);
  const [picking, setPicking] = useState(false);
  const status = robotStatus(data);
  const sendOpening =
    data.channels.whatsapp.connected && data.templates.opening === "missing" && canManage;

  if (open) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink onClick={() => setOpen(null)}>Mensagens</BackLink>
        {open === "conversa" ? <ScriptEditor data={data} s={s} canManage={canManage} /> : null}
        {open === "sem-resposta" ? <FollowUpEditor data={data} s={s} canManage={canManage} /> : null}
      </div>
    );
  }

  if (picking) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink onClick={() => setPicking(false)}>Mensagens</BackLink>
        <AutomationRow
          name="Qualificação"
          detail={status.tone === "ok" ? "Perguntas na conversa do WhatsApp." : status.text}
          onOpen={() => {
            setPicking(false);
            setOpen("conversa");
          }}
        />
        <AutomationRow
          name="Sem resposta"
          detail="Lembrete se a pessoa para de responder."
          onOpen={() => {
            setPicking(false);
            setOpen("sem-resposta");
          }}
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
      {post.error && !post.isPending ? <p className="type-caption text-[var(--danger)]">{post.error.message}</p> : null}
      <AutomationRow
        name="Qualificação"
        detail={status.tone === "ok" ? "Perguntas na conversa do WhatsApp." : status.text}
        onOpen={() => setOpen("conversa")}
        checked={data.enabled}
        onChecked={canManage && !post.isPending ? (on) => post.mutate({ action: "toggle", enabled: on }) : undefined}
        switchLabel="Robô de qualificação no WhatsApp"
        trailing={
          sendOpening ? (
            <Button
              type="button"
              size="toolbar"
              variant="outline"
              disabled={post.isPending}
              onClick={() => post.mutate({ action: "templates" })}
            >
              {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enviar abertura
            </Button>
          ) : null
        }
      />
      <AutomationRow
        name="Sem resposta"
        detail="Lembrete se a pessoa para de responder."
        onOpen={() => setOpen("sem-resposta")}
      />
    </div>
  );
}

export function MensagensView({ workspaceId, embedded = false }: { workspaceId: string; embedded?: boolean }) {
  const { data, isLoading, error, post } = useJornada(workspaceId);
  const { info } = useAtendimentoInfo();
  const canManage = info?.role === "OWNER" || info?.role === "ADMIN";

  const body = isLoading || !data ? (
    <div className="flex justify-center py-16">
      {error ? (
        <p className="type-caption text-[var(--danger)]">Não foi possível carregar.</p>
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted-48)]" />
      )}
    </div>
  ) : (
    <WhatsAppBody data={data} post={post} canManage={canManage} />
  );

  if (embedded) return body;

  return (
    <AppPage title="Mensagens" className="md:pt-5">
      {body}
    </AppPage>
  );
}
