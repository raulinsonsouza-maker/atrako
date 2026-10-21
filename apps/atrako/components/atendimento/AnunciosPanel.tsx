"use client";

import { useQuery } from "@tanstack/react-query";
import { CampanhasPanel } from "@/components/clientes/CampanhasPanel";
import { MetricGrid, MetricTile } from "@/components/ui";

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

export function AnunciosPanel({
  workspaceId,
  periodo,
  dataInicio,
  dataFim,
}: {
  workspaceId: string;
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
}) {
  const range = dataInicio && dataFim ? `&dataInicio=${dataInicio}&dataFim=${dataFim}` : "";
  const { data: resumo } = useQuery({
    queryKey: ["atendimento-anuncios", workspaceId, periodo, range],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${workspaceId}/resumo?canal=meta&periodo=${periodo}${range}`);
      if (!res.ok) throw new Error("Falha ao carregar os anúncios");
      return res.json() as Promise<Resumo>;
    },
  });

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile
          label="Investimento"
          value={resumo ? brl(resumo.investimento) : "—"}
          detail={
            resumo?.lastFatoDate
              ? `Meta Ads · dados até ${new Date(resumo.lastFatoDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
              : "Meta Ads"
          }
        />
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
      <CampanhasPanel clienteId={workspaceId} dateFilter={{ periodo, dataInicio, dataFim }} canal="meta" allowCreate={false} />
    </div>
  );
}
