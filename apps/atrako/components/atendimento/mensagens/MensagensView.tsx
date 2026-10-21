"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { AppPage } from "@/components/layout/AppPage";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { LeadEmailsCard } from "@/components/notifications/LeadEmailsCard";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { FollowUpEditor } from "./FollowUpEditor";
import { LiveStrip } from "./LiveStrip";
import { RulesEditor } from "./RulesEditor";
import { ScriptEditor } from "./ScriptEditor";
import { RobotSwitch, SetupChecklist } from "./SetupChecklist";
import { useJornada, type Jornada } from "./useJornada";
import { useScriptDraft } from "./useScriptDraft";

type Aba = "conversa" | "sem-resposta" | "classificacao" | "emails";

const ABAS: ReadonlyArray<{ value: Aba; label: string }> = [
  { value: "conversa", label: "Conversa" },
  { value: "sem-resposta", label: "Sem resposta" },
  { value: "classificacao", label: "Classificação" },
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
      {aba === "classificacao" ? <RulesEditor data={data} s={s} canManage={canManage} /> : null}
      {aba === "emails" ? (
        <div className="flex flex-col gap-4">
          <FlowsTab workspaceId={workspaceId} pack="inside_sales" />
          <LeadEmailsCard workspaceId={workspaceId} />
        </div>
      ) : null}
    </>
  );
}

export function MensagensView({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, error, post } = useJornada(workspaceId);
  const { info } = useAtendimentoInfo();
  const canManage = info?.role === "OWNER" || info?.role === "ADMIN";

  return (
    <AppPage
      title="Mensagens"
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
          <Tabs workspaceId={workspaceId} data={data} post={post} canManage={canManage} />
        </div>
      )}
    </AppPage>
  );
}
