"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOpportunitiesForPipeline, updateOpportunityStage } from "@/server/actions/pipeline";
import { ChevronRight } from "lucide-react";

type Data = Awaited<ReturnType<typeof getOpportunitiesForPipeline>>;
type Opp = Data["stages"][number]["opportunities"][number];

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function prob(stage: { name: string; probability?: number | null }, o: { probability?: number | null }): number {
  if (o.probability != null) return Math.min(100, Math.max(0, o.probability));
  if (stage.probability != null) return Math.min(100, Math.max(0, stage.probability));
  const n = (stage.name || "").toLowerCase();
  if (n.includes("ganho")) return 100;
  if (n.includes("perdido")) return 0;
  if (n.includes("negoci")) return 75;
  if (n.includes("proposta")) return 50;
  if (n.includes("contato")) return 25;
  return 10;
}

export function OpportunitiesPipelineBoard({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    getOpportunitiesForPipeline(tenantId).then(setData);
  }, [tenantId]);

  async function handleDrop(opportunityId: string, toStageId: string) {
    if (!opportunityId || !toStageId) return;
    await updateOpportunityStage(opportunityId, toStageId, tenantId);
    setData(null);
    getOpportunitiesForPipeline(tenantId).then(setData);
    router.refresh();
  }

  if (!data) return <p className="text-neutral-500 dark:text-neutral-400">Carregando pipeline…</p>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {data.stages.map((stage) => (
        <div
          key={stage.id}
          className="flex w-80 shrink-0 flex-col rounded-sm border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const opportunityId = e.dataTransfer.getData("opportunityId");
            if (opportunityId) handleDrop(opportunityId, stage.id);
          }}
        >
          <div
            className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-700"
            style={{ borderLeftColor: stage.color, borderLeftWidth: 4 }}
          >
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{stage.name}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {stage.opportunities.length} · {fmtCurrency(stage.totalValor)} · Ponderado: {fmtCurrency(stage.valorPonderado)}
            </p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {stage.opportunities.map((o: Opp) => (
              <div
                key={o.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("opportunityId", o.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {}}
                className="cursor-grab rounded-sm border border-neutral-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-neutral-600 dark:bg-neutral-900"
              >
                <p className="font-medium text-neutral-900 dark:text-neutral-100">{o.name}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {fmtCurrency(Number(o.value))} · {prob(stage, o)}%
                </p>
                <Link
                  href={`/dashboard/leads/${o.lead.id}`}
                  className="mt-2 flex items-center gap-1 text-xs text-primary-600 transition-colors duration-normal hover:text-primary-700 hover:underline dark:text-primary-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  {o.lead.name} <ChevronRight className="h-3 w-3" />
                </Link>
                {o.assignedTo && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{o.assignedTo.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
