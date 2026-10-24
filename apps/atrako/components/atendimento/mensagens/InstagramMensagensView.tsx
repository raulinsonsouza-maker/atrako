"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { AppPage } from "@/components/layout/AppPage";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { useJornada, type Jornada } from "./useJornada";
import { useScriptDraft } from "./useScriptDraft";
import { RobotSwitch, SetupChecklist } from "./SetupChecklist";
import { LiveStrip } from "./LiveStrip";
import { ScriptEditor } from "./ScriptEditor";
import { FollowUpEditor } from "./FollowUpEditor";

type Aba = "conversa" | "sem-resposta" | "emails";

const ABAS: ReadonlyArray<{ value: Aba; label: string }> = [
  { value: "conversa", label: "Conversa" },
  { value: "sem-resposta", label: "Sem resposta" },
  { value: "emails", label: "E-mails" },
];

function Tabs({ workspaceId, data, post, canManage }: { workspaceId: string; data: Jornada; post: ReturnType<typeof useJornada>["post"]; canManage: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("aba") as Aba | null;
  const aba: Aba = ABAS.some((a) => a.value === requested) ? (requested as Aba) : "conversa";
  const s = useScriptDraft(data, post);

  function select(next: Aba) {
    router.replace(next === "conversa" ? pathname : `${pathname}?aba=${next}`, { scroll: false });
  }

  return (
    <>
      <SegmentedControl value={aba} onChange={select} options={ABAS} aria-label="Partes da configuração" className="self-start" />
      {aba === "conversa" ? <ScriptEditor data={data} s={s} canManage={canManage} /> : null}
      {aba === "sem-resposta" ? <FollowUpEditor data={data} s={s} canManage={canManage} /> : null}
      {aba === "emails" ? (
        <div className="flex flex-col gap-4">
          <FlowsTab
            workspaceId={workspaceId}
            pack="inside_sales"
            hideTriggers={data.enabled ? ["lead_welcome"] : undefined}
            note={data.enabled ? "As boas-vindas de quem comenta no Instagram ficam com o robô (aba Conversa)." : undefined}
          />
        </div>
      ) : null}
    </>
  );
}

export function InstagramMensagensView({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, error, post } = useJornada(workspaceId);
  const { info } = useAtendimentoInfo();
  const canManage = info?.role === "OWNER" || info?.role === "ADMIN";

  return (
    <AppPage
      title="Mensagens Instagram"
      className="md:pt-5"
      actions={data ? <RobotSwitch data={data} post={post} canManage={canManage} /> : null}
    >
      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          {error ? (
            <p className="type-caption text-[var(--danger)]">Não foi possível carregar.</p>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted-48)]" />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SetupChecklist data={data} post={post} canManage={canManage} />
          {post.error && !post.isPending ? <p className="type-caption text-[var(--danger)]">{post.error.message}</p> : null}
          <LiveStrip data={data} />
          <div className="type-caption text-[var(--ink-muted-48)]">
            Limites da API Meta: DM só após comentário/interação; janela padrão de 24h; envio fora da janela apenas via atendimento humano (7 dias). Não-seguidores vão para a pasta Requests. DM automática para "todo novo seguidor" não é suportada pela plataforma.
          </div>
          <Tabs workspaceId={workspaceId} data={data} post={post} canManage={canManage} />
        </div>
      )}
    </AppPage>
  );
}
