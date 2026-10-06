"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { CrmLeadCard, sourceLabel, type CrmBoardLead } from "./CrmLeadCard";
import { CrmLeadModal } from "./CrmLeadModal";
import { CrmFunnelConfigModal } from "./CrmFunnelConfigModal";
import { CrmStageHeader } from "./CrmStageHeader";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { PillSelect } from "@/components/ui/pill-select";
import { SegmentedControl } from "@/components/ui/segmented-control";

type StageCol = {
  id: string;
  name: string;
  color: string;
  totalCount: number;
  totalValue: number;
  role?: "ENTRY" | "WON" | "ABANDONED" | "ABANDONED_30" | "ABANDONED_60" | "ABANDONED_90" | "LOST" | null;
  leads: CrmBoardLead[];
};

const ABANDON_ROLES = new Set(["ABANDONED", "ABANDONED_30", "ABANDONED_60", "ABANDONED_90"]);

type PipelineData = {
  stages: StageCol[];
  sources?: Array<{ value: string; count: number }>;
  totalCount: number;
  totalValue: number;
  newThisWeek: number;
  won: number;
  openCount: number;
  abandonedCarts?: {
    openCount: number;
    openValueCents: number;
    recoveredMonthCount: number;
    recoveredMonthCents: number;
    recoveryRate: number | null;
  } | null;
};

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function CrmPipelineBoard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"pipeline" | "list">("pipeline");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [source, setSource] = useState("");
  const [openCart, setOpenCart] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [funnelConfigOpen, setFunnelConfigOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("lead");
    if (fromUrl) setOpenLeadId(fromUrl);
  }, [searchParams]);

  const onSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQDebounced(value), 280);
  };

  const queryKey = useMemo(
    () => ["crm-pipeline", workspaceId, qDebounced, source, openCart] as const,
    [workspaceId, qDebounced, source, openCart],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, view: "pipeline" });
      if (qDebounced.trim()) params.set("q", qDebounced.trim());
      if (source) params.set("source", source);
      if (openCart) params.set("openCart", "1");
      const r = await fetch(`/api/atrako/crm/leads?${params}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<PipelineData>;
    },
    enabled: Boolean(workspaceId),
  });

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardHeight, setBoardHeight] = useState<number | null>(null);
  const boardReady = tab === "pipeline" && !!data;
  const hasCartsLine = Boolean(data?.abandonedCarts);
  useEffect(() => {
    if (!boardReady) return;
    const fit = () => {
      const el = boardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setBoardHeight(Math.max(360, Math.floor(window.innerHeight - top - 24)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [boardReady, showNew, hasCartsLine]);

  const handleDrop = useCallback(
    async (leadId: string, fromStageId: string, toStageId: string) => {
      if (!leadId || !toStageId || fromStageId === toStageId || !data) return;
      setMovingLeadId(leadId);
      const prev = data;
      const lead = prev.stages.flatMap((s) => s.leads).find((l) => l.id === leadId);
      if (!lead) return;
      // Colunas trazem só parte dos cards: ajusta o total em vez de recontar a lista.
      const value = lead.dealValue ?? 0;
      const nextStages = prev.stages.map((s) => {
        if (s.id === fromStageId) {
          return {
            ...s,
            leads: s.leads.filter((l) => l.id !== leadId),
            totalCount: Math.max(0, s.totalCount - 1),
            totalValue: s.totalValue - value,
          };
        }
        if (s.id === toStageId) {
          return {
            ...s,
            leads: [{ ...lead, stageId: toStageId }, ...s.leads],
            totalCount: s.totalCount + 1,
            totalValue: s.totalValue + value,
          };
        }
        return s;
      });
      qc.setQueryData(queryKey, { ...prev, stages: nextStages });
      setDragOverStage(null);
      try {
        const r = await fetch("/api/atrako/crm/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, leadId, stageId: toStageId }),
        });
        if (!r.ok) throw new Error("move failed");
        await qc.invalidateQueries({ queryKey: ["crm-pipeline", workspaceId] });
      } catch {
        qc.setQueryData(queryKey, prev);
      } finally {
        setMovingLeadId(null);
      }
    },
    [data, qc, queryKey, workspaceId],
  );

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/atrako/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        source: "manual",
      }),
    });
    setName("");
    setEmail("");
    setPhone("");
    setShowNew(false);
    qc.invalidateQueries({ queryKey: ["crm-pipeline", workspaceId] });
  }

  async function saveStage(stageId: string, patch: { name: string; color: string }) {
    const r = await fetch("/api/atrako/crm/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, stageId, ...patch }),
    });
    if (!r.ok) throw new Error("fail");
    await qc.invalidateQueries({ queryKey: ["crm-pipeline", workspaceId] });
    await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId] });
  }

  const allLeads = data?.stages.flatMap((s) => s.leads) ?? [];
  const boardCols = data?.stages.length ?? 0;
  const sourceOptions = useMemo(() => {
    const opts = (data?.sources ?? []).map((s) => ({
      value: s.value,
      label: `${sourceLabel(s.value)} · ${s.count}`,
    }));
    if (source && !opts.some((o) => o.value === source)) {
      opts.unshift({ value: source, label: sourceLabel(source) ?? source });
    }
    return [{ value: "", label: "Todas as origens" }, ...opts];
  }, [data?.sources, source]);
  const filtering = Boolean(qDebounced.trim() || source || openCart);
  const fieldClass =
    "h-9 min-w-[120px] flex-1 rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="crm-toolbar">
        <div className="crm-toolbar-filters">
          <div className="crm-toolbar-search">
            <SearchInput
              size="toolbar"
              placeholder="Buscar por nome, e-mail ou telefone"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <PillSelect
            aria-label="Filtrar por origem"
            value={source}
            onChange={setSource}
            options={sourceOptions}
            placeholder="Todas as origens"
          />
          <SegmentedControl
            aria-label="Visualização"
            value={tab}
            onChange={setTab}
            options={[
              { value: "pipeline", label: "Funil" },
              { value: "list", label: "Lista" },
            ]}
          />
        </div>

        <div className="crm-toolbar-actions">
          {tab === "pipeline" ? (
            <IconButton
              size="toolbar"
              onClick={() => setFunnelConfigOpen(true)}
              aria-label="Editar etapas do funil"
              title="Editar etapas do funil"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          ) : null}
          <Button type="button" variant="primary" size="toolbar" onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Novo lead
          </Button>
        </div>
      </div>

      {showNew ? (
        <form onSubmit={createLead} className="flex shrink-0 flex-wrap gap-2">
          <input
            className={fieldClass}
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <input
            className={fieldClass}
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" variant="primary" size="toolbar">
            Salvar
          </Button>
        </form>
      ) : null}

      {filtering && data ? (
        <p className="shrink-0 type-fine-print text-[var(--ink-muted-48)]">
          <span className="tabular-nums text-[var(--ink)]">{data.totalCount}</span>{" "}
          {data.totalCount === 1 ? "lead encontrado" : "leads encontrados"}
          {openCart ? " com carrinho aberto" : ""}
          {source ? ` · origem ${sourceLabel(source)}` : ""}
          {" · "}
          <button
            type="button"
            className="text-[var(--primary)] active:scale-95"
            onClick={() => {
              setQ("");
              setQDebounced("");
              setSource("");
              setOpenCart(false);
            }}
          >
            Limpar filtros
          </button>
        </p>
      ) : data?.abandonedCarts &&
        (data.abandonedCarts.openCount > 0 || data.abandonedCarts.recoveredMonthCount > 0) ? (
        <p className="shrink-0 type-fine-print text-[var(--ink-muted-48)]">
          {data.abandonedCarts.openCount > 0 ? (
            <button
              type="button"
              className="active:scale-95"
              title="Ver só quem tem carrinho aberto"
              onClick={() => setOpenCart(true)}
            >
              Carrinhos abandonados em aberto:{" "}
              <span className="tabular-nums text-[var(--primary)]">
                {data.abandonedCarts.openCount} ·{" "}
                {fmtCurrency(data.abandonedCarts.openValueCents / 100)}
              </span>
            </button>
          ) : (
            <>
              Carrinhos abandonados em aberto:{" "}
              <span className="tabular-nums text-[var(--ink)]">0</span>
            </>
          )}
          {"  ·  "}Recuperado no mês:{" "}
          <span className="tabular-nums text-[var(--ink)]">
            {fmtCurrency(data.abandonedCarts.recoveredMonthCents / 100)}
          </span>
          {data.abandonedCarts.recoveryRate != null
            ? ` (${Math.round(data.abandonedCarts.recoveryRate * 100)}% recuperados)`
            : null}
        </p>
      ) : null}

      {isLoading && !data ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : tab === "pipeline" ? (
        <div
          ref={boardRef}
          className="pipeline-board"
          style={{
            gridTemplateColumns: `repeat(${Math.max(boardCols, 1)}, minmax(280px, 1fr))`,
            height: boardHeight ?? undefined,
            flex: boardHeight ? "none" : undefined,
          }}
        >
          {(data?.stages ?? []).map((stage) => {
            const isDrop = dragOverStage === stage.id;
            const canEdit = stage.id !== "_none";
            return (
              <div
                key={stage.id}
                className="pipeline-column group"
                data-drop={isDrop ? "true" : "false"}
                style={{ ["--stage-color" as string]: stage.color }}
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
                  if (leadId && fromStageId) void handleDrop(leadId, fromStageId, stage.id);
                  setDragOverStage(null);
                }}
              >
                <CrmStageHeader
                  stageId={stage.id}
                  name={stage.name}
                  color={stage.color}
                  count={stage.totalCount}
                  valueLabel={
                    ABANDON_ROLES.has(stage.role ?? "") && stage.totalValue > 0
                      ? fmtCurrency(stage.totalValue)
                      : undefined
                  }
                  role={stage.role ?? null}
                  editable={canEdit}
                  onSave={(patch) => saveStage(stage.id, patch)}
                />
                <div className="pipeline-column-body">
                  {stage.leads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("leadId", lead.id);
                        e.dataTransfer.setData("fromStageId", stage.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragOverStage(null)}
                      className={clsx(movingLeadId === lead.id && "pointer-events-none opacity-50")}
                    >
                      <CrmLeadCard
                        lead={lead}
                        drag
                        onOpen={setOpenLeadId}
                        showOpenCart={!ABANDON_ROLES.has(stage.role ?? "")}
                      />
                    </div>
                  ))}
                  {stage.totalCount > stage.leads.length ? (
                    <p className="px-1 py-2 type-fine-print text-[var(--ink-muted-48)]">
                      +{stage.totalCount - stage.leads.length} leads · use a busca
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--canvas)] type-fine-print text-[var(--ink-muted-48)]">
              <tr>
                <th className="px-3 py-2.5 font-normal">Nome</th>
                <th className="px-3 py-2.5 font-normal">Contato</th>
                <th className="px-3 py-2.5 font-normal">Origem</th>
                <th className="px-3 py-2.5 font-normal">Etapa</th>
                <th className="px-3 py-2.5 font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {allLeads.map((l) => {
                const stageName = data?.stages.find((s) => s.id === l.stageId)?.name ?? "—";
                return (
                  <tr
                    key={l.id}
                    className="border-t border-[var(--divider-soft)] hover:bg-[var(--canvas-parchment)]/60"
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setOpenLeadId(l.id)}
                        className="type-caption-strong text-[var(--ink)] hover:text-[var(--primary)]"
                      >
                        {l.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 type-fine-print text-[var(--ink-muted-80)]">
                      {l.email || l.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5 type-fine-print text-[var(--ink-muted-48)]">
                      {sourceLabel(l.source) || "—"}
                    </td>
                    <td className="px-3 py-2.5 type-fine-print text-[var(--ink-muted-48)]">
                      {stageName}
                    </td>
                    <td className="px-3 py-2.5 type-caption tabular-nums text-[var(--ink)]">
                      {l.dealValue != null ? fmtCurrency(l.dealValue) : "—"}
                    </td>
                  </tr>
                );
              })}
              {!allLeads.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-12 text-center type-caption text-[var(--ink-muted-48)]"
                  >
                    Nenhum lead
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {openLeadId ? (
        <CrmLeadModal
          workspaceId={workspaceId}
          leadId={openLeadId}
          onClose={() => setOpenLeadId(null)}
        />
      ) : null}

      {funnelConfigOpen ? (
        <CrmFunnelConfigModal
          workspaceId={workspaceId}
          stages={(data?.stages ?? [])
            .filter((s) => s.id !== "_none")
            .map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              role: s.role ?? null,
            }))}
          onClose={() => setFunnelConfigOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["crm-pipeline", workspaceId] });
            void qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId] });
          }}
        />
      ) : null}
    </div>
  );
}
