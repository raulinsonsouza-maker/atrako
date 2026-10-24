"use client";

import { Suspense } from "react";
import { InstagramMensagensView } from "@/components/atendimento/mensagens/InstagramMensagensView";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function AtendimentoMensagensInstagramPage() {
  const { workspaceId } = useActiveWorkspace();

  if (!workspaceId) {
    return (
      <AppPage title="Mensagens Instagram" className="md:pt-5">
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      </AppPage>
    );
  }
  return (
    <Suspense fallback={null}>
      <InstagramMensagensView workspaceId={workspaceId} />
    </Suspense>
  );
}
