"use client";

import { Suspense } from "react";
import { AutomacoesView } from "@/components/atendimento/mensagens/AutomacoesView";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function AtendimentoMensagensPage() {
  const { workspaceId } = useActiveWorkspace();

  if (!workspaceId) {
    return (
      <AppPage title="Automações" className="md:pt-5">
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      </AppPage>
    );
  }
  return (
    <Suspense fallback={null}>
      <AutomacoesView />
    </Suspense>
  );
}
