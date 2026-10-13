"use client";

import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function StayMessagesPage() {
  const { workspaceId, isLoading, isError } = useActiveWorkspace();

  return (
    <section>
      <h1 className="type-tagline">Mensagens</h1>
      <p className="type-body mt-2 mb-6 text-[var(--ink-muted-80)]">O que o hóspede recebe da reserva até o dia seguinte à saída.</p>
      {isError ? <p className="type-body">Entre de novo para ver as mensagens.</p> : null}
      {!isError && (isLoading || !workspaceId) ? <p className="type-body">Carregando…</p> : null}
      {workspaceId ? <FlowsTab workspaceId={workspaceId} pack="stay" /> : null}
    </section>
  );
}
