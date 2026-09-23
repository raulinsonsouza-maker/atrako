"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getLeadsForPipeline, updateLeadStage } from "@/server/actions/pipeline";
import { clsx } from "clsx";
import { LeadCard } from "./LeadCard";
import { LeadAdminPanel } from "./LeadAdminPanel";
import { Button, Input } from "@/design/components";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import type { LeadSource } from "@prisma/client";

const SOURCE_LABELS: Record<LeadSource, string> = {
  META: "Meta",
  GOOGLE: "Google",
  WHATSAPP: "WhatsApp",
  MANUAL: "Manual",
  OUTROS: "Outros",
};

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type PipelineData = Awaited<ReturnType<typeof getLeadsForPipeline>>;

export function PipelineBoard({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageId, setStageId] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [adminLeadId, setAdminLeadId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const hasDraggedRef = useRef(false);
  const { setSummary } = usePageHeader();

  useEffect(() => {
    if (!data) {
      setSummary(undefined);
      return;
    }
    setSummary(
      `${data.totalCount} leads · ${fmtCurrency(data.totalValue ?? 0)} · Em negociação: ${fmtCurrency(data.totalNegotiationValue ?? 0)}`
    );
    return () => setSummary(undefined);
  }, [data, setSummary]);

  const fetchData = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (opts?.showLoading !== false) setLoading(true);
      const result = await getLeadsForPipeline(tenantId, {
        stageId: stageId || undefined,
        source: (source as LeadSource) || undefined,
        q: qDebounced || undefined,
      });
      setLoading(false);
      return result;
    },
    [tenantId, stageId, source, qDebounced]
  );

  useEffect(() => {
    let cancelled = false;
    fetchData().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => { cancelled = true; };
  }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function handleDrop(leadId: string, fromStageId: string, toStageId: string) {
    if (!leadId || !toStageId || fromStageId === toStageId) return;

    setMovingLeadId(leadId);

    const prevData = data;
    if (!prevData) return;

    const lead = prevData.stages.flatMap((s) => s.leads).find((l) => l.id === leadId);
    if (!lead) return;

    const serializeLead = (l: (typeof prevData.stages)[0]["leads"][0]) => ({
      ...l,
      dealValue: l.dealValue != null ? Number(l.dealValue) : null,
    });

    const newStages = prevData.stages.map((s) => {
      if (s.id === fromStageId) {
        const leads = s.leads.filter((l) => l.id !== leadId);
        const totalValue = leads.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);
        return { ...s, leads, totalCount: leads.length, totalValue };
      }
      if (s.id === toStageId) {
        const newLead = serializeLead(lead as (typeof prevData.stages)[0]["leads"][0]);
        const leads = [...s.leads, newLead];
        const totalValue = leads.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);
        return { ...s, leads, totalCount: leads.length, totalValue };
      }
      return s;
    });

    const totalCount = newStages.reduce((sum, s) => sum + s.totalCount, 0);
    const totalValue = newStages.reduce((sum, s) => sum + s.totalValue, 0);
    const totalNegotiationValue = prevData.totalNegotiationValue ?? 0;

    setData({ stages: newStages, totalCount, totalValue, totalNegotiationValue });
    setDragOverStage(null);

    try {
      await updateLeadStage(leadId, toStageId, tenantId);
    } catch (err) {
      setData(prevData);
      console.error("Erro ao mover lead:", err);
    } finally {
      setMovingLeadId(null);
    }
  }

  function openLeadAdmin(leadId: string) {
    if (!hasDraggedRef.current) {
      setAdminLeadId(leadId);
      setAdminOpen(true);
    }
  }

  function closeLeadAdmin() {
    setAdminOpen(false);
    setAdminLeadId(null);
  }

  function handleCardPointerDown() {
    hasDraggedRef.current = false;
  }

  function handleCardDragStart() {
    hasDraggedRef.current = true;
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) return <p className="text-neutral-500">Carregando pipeline…</p>;

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-4 flex-shrink-0 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Todas as etapas</option>
            {data.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Todas as origens</option>
            {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {data.totalCount} leads · {fmtCurrency(data.totalValue ?? 0)} · Em negociação:{" "}
            {fmtCurrency(data.totalNegotiationValue ?? 0)}
          </div>
        </div>
      </div>

      <div 
        className="flex gap-4 overflow-x-auto -mx-1 px-1 flex-1 mt-2"
        style={{ 
          scrollbarGutter: "stable",
          scrollbarWidth: "thin",
          scrollbarColor: "rgb(203 213 225) transparent",
          paddingBottom: "1rem",
          marginTop: "auto"
        }}
      >
        {data.stages.map((stage) => {
          const isDropTarget = dragOverStage === stage.id;
          return (
            <div
              key={stage.id}
              className={clsx(
                "flex w-72 shrink-0 flex-col rounded-lg border-2 min-h-[200px] transition-colors duration-150",
                "border-neutral-200 dark:border-neutral-700",
                "bg-neutral-50/80 dark:bg-neutral-800/50",
                isDropTarget && "border-primary-500 bg-primary-500/5 dark:bg-primary-500/10"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStage(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData("leadId");
                const fromStageId = e.dataTransfer.getData("fromStageId");
                if (leadId && fromStageId) handleDrop(leadId, fromStageId, stage.id);
                setDragOverStage(null);
              }}
            >
              <div
                className="border-b border-neutral-200 dark:border-neutral-600 px-3 py-2 shrink-0"
                style={{ borderLeftColor: stage.color, borderLeftWidth: 4 }}
              >
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{stage.name}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {stage.totalCount} · {fmtCurrency(stage.totalValue ?? 0)} · Em negociação:{" "}
                  {fmtCurrency(stage.negotiationValue ?? 0)}
                </p>
              </div>
              <div className="flex-1 min-h-[80px] space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 350px)" }}>
                {stage.leads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onPointerDown={handleCardPointerDown}
                    onPointerUp={() => openLeadAdmin(lead.id)}
                    onDragStart={(e) => {
                      handleCardDragStart();
                      e.dataTransfer.setData("leadId", lead.id);
                      e.dataTransfer.setData("fromStageId", stage.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", lead.name);
                    }}
                    onDragEnd={() => setDragOverStage(null)}
                    className={clsx(
                      "cursor-grab active:cursor-grabbing",
                      movingLeadId === lead.id && "opacity-50 pointer-events-none"
                    )}
                  >
                    <LeadCard
                      lead={{
                        ...lead,
                        dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
                      }}
                      drag
                      viewHref={`/dashboard/leads/${lead.id}`}
                      onViewClick={() => openLeadAdmin(lead.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <LeadAdminPanel
        leadId={adminLeadId}
        tenantId={tenantId}
        open={adminOpen}
        onClose={closeLeadAdmin}
        onLeadUpdated={() => fetchData({ showLoading: false }).then(setData)}
      />

    </div>
  );
}
