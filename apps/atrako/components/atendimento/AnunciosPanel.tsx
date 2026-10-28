"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampanhasPanel } from "@/components/clientes/CampanhasPanel";
import { DefaultPanel } from "@/components/clientes/DefaultPanel";
import { PlanoRealCard, type PlanoRealData } from "@/components/clientes/PlanoRealCard";
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

type MetricPoint = {
  investimento: number;
  leads: number;
  conversas?: number;
  impressoes: number;
  cliques: number;
};

type MidiaPoint = MetricPoint & { periodo: string };

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (value: number) => value.toLocaleString("pt-BR");

const metricDefinitions = [
  {
    label: "INVESTIMENTO",
    description: "Valor investido em mídia no período.",
    value: (s: MetricPoint) => s.investimento,
    format: brl,
  },
  {
    label: "IMPRESSÕES",
    description: "Volume total de entregas dos anúncios.",
    value: (s: MetricPoint) => s.impressoes,
    format: num,
  },
  {
    label: "CLIQUES",
    description: "Interações geradas pelos anúncios.",
    value: (s: MetricPoint) => s.cliques,
    format: num,
  },
  {
    label: "LEADS",
    description: "Leads atribuídos ao período.",
    value: (s: MetricPoint) => s.leads,
    format: num,
  },
  {
    label: "CPL",
    description: "Investimento dividido pelos leads do período.",
    value: (s: MetricPoint) => (s.leads > 0 ? s.investimento / s.leads : 0),
    format: brl,
  },
  {
    label: "CONVERSAS",
    description: "Conversas no WhatsApp iniciadas pelos anúncios.",
    value: (s: MetricPoint) => s.conversas ?? 0,
    format: num,
  },
];

export function AnunciosPanel({
  workspaceId,
  periodo,
  dataInicio,
  dataFim,
  periodLabel,
  preset,
}: {
  workspaceId: string;
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
  periodLabel?: string;
  preset?: string;
}) {
  const range = dataInicio && dataFim ? `&dataInicio=${dataInicio}&dataFim=${dataFim}` : "";
  const longPeriod = preset === "ytd" || preset === "365d" || preset === "semestreAtual";
  const [chartAgrupamento, setChartAgrupamento] = useState<"diario" | "semanal">("semanal");
  const agrupamento = longPeriod ? "mensal" : chartAgrupamento;

  const { data: resumo } = useQuery({
    queryKey: ["atendimento-anuncios", workspaceId, periodo, range],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${workspaceId}/resumo?canal=meta&periodo=${periodo}${range}`);
      if (!res.ok) throw new Error("Falha ao carregar os anúncios");
      return res.json() as Promise<Resumo>;
    },
  });

  const { data: midia } = useQuery({
    queryKey: ["atendimento-midia", workspaceId, periodo, range, agrupamento],
    queryFn: async () => {
      const res = await fetch(
        `/api/clientes/${workspaceId}/midia?canal=meta&agrupamento=${agrupamento}&periodo=${periodo}${range}`,
      );
      if (!res.ok) throw new Error("Falha ao carregar a mídia");
      return res.json() as Promise<{ series: MidiaPoint[] }>;
    },
  });

  const { data: financeiro } = useQuery({
    queryKey: ["atendimento-financeiro", workspaceId, "meta"],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${workspaceId}/financeiro?canal=meta`);
      if (!res.ok) throw new Error("Falha ao carregar o financeiro");
      return res.json() as Promise<PlanoRealData>;
    },
  });

  const series = midia?.series ?? [];
  const chartData = series.map((s) => ({
    periodo: s.periodo,
    Investimento: Math.round(s.investimento * 100) / 100,
    Leads: s.leads,
    CPL: s.leads > 0 ? Math.round((s.investimento / s.leads) * 100) / 100 : 0,
  }));

  return (
    <div className="flex flex-col gap-5">
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

      {resumo ? (
        <DefaultPanel
          resumo={{ ...resumo, cpm: 0 }}
          chartData={chartData}
          chartConversionKey="Leads"
          latestFiveSeries={series.slice(-5)}
          metricDefinitions={metricDefinitions}
          dateFilter={{ label: periodLabel ?? "Período" }}
          canal="meta"
          canalLabels={{ meta: "META" }}
          formatCurrency={brl}
          agrupamento={agrupamento}
          onAgrupamentoChange={longPeriod ? undefined : setChartAgrupamento}
          hideKpis
          insideSalesMode
        />
      ) : null}

      <CampanhasPanel clienteId={workspaceId} dateFilter={{ periodo, dataInicio, dataFim }} canal="meta" allowCreate={false} />

      {financeiro?.meses?.length ? <PlanoRealCard financeiro={financeiro} scope="meta" /> : null}
    </div>
  );
}
