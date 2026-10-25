"use client";

import { Suspense, useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { AppPage } from "@/components/layout/AppPage";
import { MensagensView } from "./MensagensView";
import { InstagramMensagensView } from "./InstagramMensagensView";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { LeadEmailsCard } from "@/components/notifications/LeadEmailsCard";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type Canal = "whatsapp" | "email" | "instagram";

const CANAIS: ReadonlyArray<{ value: Canal; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "instagram", label: "Instagram" },
];

export function AutomacoesView() {
  const { workspaceId } = useActiveWorkspace();
  const [canal, setCanal] = useState<Canal>("whatsapp");

  if (!workspaceId) {
    return (
      <div className="flex justify-center py-16">
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl value={canal} onChange={setCanal} options={CANAIS} aria-label="Canal de automação" className="self-start" />
      {canal === "whatsapp" ? <MensagensView workspaceId={workspaceId} /> : null}
      {canal === "email" ? (
        <div className="flex flex-col gap-4">
          <FlowsTab workspaceId={workspaceId} pack="inside_sales" />
          <LeadEmailsCard workspaceId={workspaceId} />
        </div>
      ) : null}
      {canal === "instagram" ? <InstagramMensagensView workspaceId={workspaceId} /> : null}
    </div>
  );
}
