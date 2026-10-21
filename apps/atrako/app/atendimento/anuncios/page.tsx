"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampanhasPanel } from "@/components/clientes/CampanhasPanel";
import { AppPage } from "@/components/layout/AppPage";
import { MetricGrid, MetricTile, PillSelect } from "@/components/ui";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

type Resumo = {
  investimento: number;
  leads: number;
  cpl: number;
  impressoes: number;
  cliques: number;
  messagingConversationsStarted: number;
  custoPorConversa: number;
  lastFatoDate: string | null;
};

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (value: number) => value.toLocaleString("pt-BR");

export default function AtendimentoAnunciosPage() {
  const { workspaceId } = useActiveWorkspace();
  const [periodo, setPeriodo] = useState("30");
  const { data: resumo } = useQuery({
    queryKey: ["atendimento-anuncios", workspaceId, periodo],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${workspaceId}/resumo?canal=meta&periodo=${periodo}`);
      if (!res.ok) throw new Error("Falha ao carregar os anúncios");
      return res.json() as Promise<Resumo>;
    },
  });

  return (
    <AppPage
      title={
        <div>
          <h1 className="type-tagline text-[var(--ink)]">Anúncios</h1>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {resumo?.lastFatoDate
              ? `Meta Ads · dados até ${new Date(resumo.lastFatoDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
              : "Meta Ads"}
          </p>
        </div>
      }
      className="md:pt-5"
      actions={<PillSelect value={periodo} onChange={setPeriodo} options={PERIODS} aria-label="Período" />}
    >
      {workspaceId ? (
        <div className="space-y-6">
          <MetricGrid>
            <MetricTile label="Investimento" value={resumo ? brl(resumo.investimento) : "—"} />
            <MetricTile
              label="Leads"
              value={resumo ? num(resumo.leads) : "—"}
              detail={resumo?.leads ? `${brl(resumo.cpl)} por lead` : undefined}
            />
            <MetricTile
              label="Conversas no WhatsApp"
              value={resumo ? num(resumo.messagingConversationsStarted) : "—"}
              detail={resumo?.messagingConversationsStarted ? `${brl(resumo.custoPorConversa)} por conversa` : undefined}
            />
            <MetricTile
              label="Cliques"
              value={resumo ? num(resumo.cliques) : "—"}
              detail={resumo ? `${num(resumo.impressoes)} impressões` : undefined}
            />
          </MetricGrid>
          <CampanhasPanel clienteId={workspaceId} dateFilter={{ periodo }} canal="meta" allowCreate={false} />
        </div>
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      )}
    </AppPage>
  );
}
