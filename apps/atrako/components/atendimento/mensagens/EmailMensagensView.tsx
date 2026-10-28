"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Settings, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { api } from "@/components/relacionamento/format";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { CampaignDetail } from "@/components/relacionamento/CampaignDetail";
import { LeadEmailsCard } from "@/components/notifications/LeadEmailsCard";
import { AutomationRow } from "./AutomationRow";

function LeadEmailsSheet({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="panel-modal max-w-[440px]" role="dialog" aria-labelledby="lead-emails-title">
        <div className="panel-modal-header flex items-center justify-between gap-3">
          <h2 id="lead-emails-title" className="type-body-strong text-[var(--ink)]">
            Quem recebe o lead
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-xs)] p-1 text-[var(--ink-muted-48)] active:scale-95"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="panel-modal-body">
          <LeadEmailsCard workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}

export function EmailMensagensView({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState<"flow" | "campaign" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createFlow() {
    setBusy("flow");
    setError(null);
    try {
      const created = await api<{ id: string }>("/api/atrako/relacionamento/flows", {
        body: { workspaceId, action: "create_email_flow" },
      });
      await qc.invalidateQueries({ queryKey: ["rel-flows", workspaceId, "inside_sales"] });
      setPicking(false);
      setOpen(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a automação");
    } finally {
      setBusy(null);
    }
  }

  async function createCampaign() {
    setBusy("campaign");
    setError(null);
    try {
      const created = await api<{ id: string }>("/api/atrako/relacionamento/campaigns", {
        body: {
          workspaceId,
          name: "Disparo único",
          channel: "EMAIL",
          audience: { lifecycles: ["LEAD"] },
        },
      });
      setPicking(false);
      setCampaignId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o disparo");
    } finally {
      setBusy(null);
    }
  }

  const sheet = settings ? <LeadEmailsSheet workspaceId={workspaceId} onClose={() => setSettings(false)} /> : null;

  if (campaignId) {
    return (
      <CampaignDetail
        workspaceId={workspaceId}
        id={campaignId}
        embedded
        onBack={() => setCampaignId(null)}
      />
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

  if (picking) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink onClick={() => setPicking(false)}>Mensagens</BackLink>
        {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
        <AutomationRow
          name="Automação"
          detail="Sequência de e-mail para a base de leads."
          onOpen={() => {
            if (!busy) void createFlow();
          }}
          trailing={busy === "flow" ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : null}
        />
        <AutomationRow
          name="Disparo único"
          detail="Um e-mail para os leads que já têm endereço."
          onOpen={() => {
            if (!busy) void createCampaign();
          }}
          trailing={busy === "campaign" ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : null}
        />
        <AutomationRow
          name="Aviso para a equipe"
          detail="Quem recebe o e-mail quando entra um cadastro novo."
          onOpen={() => {
            if (busy) return;
            setPicking(false);
            setSettings(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <IconButton size="toolbar" aria-label="Quem recebe o lead" onClick={() => setSettings(true)}>
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </IconButton>
        <Button type="button" size="toolbar" onClick={() => setPicking(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nova automação
        </Button>
      </div>
      <FlowsTab workspaceId={workspaceId} pack="inside_sales" density="rows" onOpen={setOpen} />
      {sheet}
    </div>
  );
}
