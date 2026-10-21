"use client";

import { useState } from "react";
import { SocialMediaPanel } from "@/components/clientes/SocialMediaPanel";
import { AppPage } from "@/components/layout/AppPage";
import { PillSelect } from "@/components/ui";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export default function AtendimentoInstagramPage() {
  const { workspaceId } = useActiveWorkspace();
  const [periodo, setPeriodo] = useState("30");

  return (
    <AppPage
      title="Instagram"
      className="md:pt-5"
      actions={<PillSelect value={periodo} onChange={setPeriodo} options={PERIODS} aria-label="Período" />}
    >
      {workspaceId ? (
        <SocialMediaPanel clienteId={workspaceId} dateFilter={{ periodo }} />
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      )}
    </AppPage>
  );
}
