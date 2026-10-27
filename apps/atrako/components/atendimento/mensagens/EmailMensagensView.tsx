"use client";

import { useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { LeadEmailsCard } from "@/components/notifications/LeadEmailsCard";
import { AutomationRow } from "./AutomationRow";

export function EmailMensagensView({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState<string | null>(null);

  if (open === "destinatarios") {
    return (
      <div className="flex flex-col gap-4">
        <BackLink onClick={() => setOpen(null)}>Mensagens</BackLink>
        <LeadEmailsCard workspaceId={workspaceId} />
      </div>
    );
  }

  if (open) {
    return (
      <FlowsTab
        workspaceId={workspaceId}
        pack="inside_sales"
        focusId={open}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FlowsTab workspaceId={workspaceId} pack="inside_sales" density="rows" onOpen={setOpen} />
      <AutomationRow
        name="Quem recebe o lead"
        detail="E-mail quando entra um cadastro novo."
        onOpen={() => setOpen("destinatarios")}
      />
    </div>
  );
}
