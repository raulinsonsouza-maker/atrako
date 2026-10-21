"use client";

import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function AtendimentoMensagensPage() {
  const { workspaceId } = useActiveWorkspace();

  return (
    <AppPage title="Mensagens" className="md:pt-5">
      <p className="type-body -mt-2 text-[var(--ink-muted-80)]">
        O que o lead recebe por WhatsApp e e-mail depois do cadastro, até a conversa com a equipe.
      </p>
      {workspaceId ? (
        <FlowsTab workspaceId={workspaceId} pack="inside_sales" />
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      )}
    </AppPage>
  );
}
