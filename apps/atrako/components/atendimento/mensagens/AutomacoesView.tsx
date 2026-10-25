"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { MensagensView } from "./MensagensView";
import { InstagramMensagensView } from "./InstagramMensagensView";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { LeadEmailsCard } from "@/components/notifications/LeadEmailsCard";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAtendimentoInfo } from "../useAtendimentoInfo";

type Canal = "whatsapp" | "email" | "instagram";

const CANAIS: ReadonlyArray<{ value: Canal; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "instagram", label: "Instagram" },
];

export function AutomacoesView() {
  const { workspaceId } = useActiveWorkspace();
  const { info } = useAtendimentoInfo();
  const [canal, setCanal] = useState<Canal>("whatsapp");

  if (!workspaceId) {
    return (
      <div className="flex justify-center py-16">
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      </div>
    );
  }

  const waOk = info?.channels?.meta ?? false;
  const igOk = info?.channels?.instagram ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className={`type-caption ${waOk ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          WhatsApp: {waOk ? "conectado" : "desconectado"}
        </span>
        <span className={`type-caption ${igOk ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          Instagram: {igOk ? "conectado" : "desconectado"}
        </span>
      </div>
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
