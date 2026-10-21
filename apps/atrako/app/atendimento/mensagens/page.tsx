"use client";

import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { LeadEmailsCard } from "@/components/notifications/LeadEmailsCard";
import { JornadaWhatsApp } from "@/components/atendimento/JornadaWhatsApp";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function AtendimentoMensagensPage() {
  const { workspaceId } = useActiveWorkspace();

  return (
    <AppPage title="Mensagens" className="md:pt-5">
      {workspaceId ? (
        <>
          <JornadaWhatsApp workspaceId={workspaceId} />
          <h2 className="type-body-strong mt-4 text-[var(--ink)]">E-mails automáticos</h2>
          <FlowsTab workspaceId={workspaceId} pack="inside_sales" />
          <LeadEmailsCard workspaceId={workspaceId} />
        </>
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      )}
    </AppPage>
  );
}
