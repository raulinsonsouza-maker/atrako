"use client";

import { Suspense } from "react";
import { MensagensView } from "@/components/atendimento/mensagens/MensagensView";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function AtendimentoMensagensPage() {
  const { workspaceId } = useActiveWorkspace();

  if (!workspaceId) {
    return (
      <AppPage title="Mensagens" className="md:pt-5">
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      </AppPage>
    );
  }
  return (
    <Suspense fallback={null}>
      <MensagensView workspaceId={workspaceId} />
    </Suspense>
  );
}
