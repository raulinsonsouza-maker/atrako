"use client";

import React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { Users, Target, TrendingUp, Zap, Building2, Wallet, RefreshCw, ChevronUp, ChevronDown, ArrowLeft, BarChart3, Eye } from "lucide-react";
import type { DateFilter } from "@/app/clientes/[id]/ClienteDashboard";
import { CampanhasPanel } from "@/components/clientes/CampanhasPanel";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function fmt(n: number | null | undefined, prefix = "R$ "): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}k`;
  return `${prefix}${n.toFixed(2)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#f59e0b",
  D: "#94a3b8",
  E: "#ef4444",
};

// Mirante: grade E significa "Sem dados" (não "Fora do perfil"), por isso usa cinza neutro
const GRADE_COLORS_MIRANTE: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#f59e0b",
  D: "#94a3b8",
  E: "#94a3b8",
};

function getGradeColor(grade: string, isMirante: boolean): string {
  const map = isMirante ? GRADE_COLORS_MIRANTE : GRADE_COLORS;
  return map[grade] ?? "#94a3b8";
}

const TIMING_COLORS: Record<string, string> = {
  "Agora": "#22c55e",
  "3 a 6 meses": "#f59e0b",
  "Estou avaliando": "#94a3b8",
  "6 meses": "#22c55e",
  "1 ano": "#84cc16",
  "Avaliando": "#94a3b8",
  "Até 3 meses": "#22c55e",
  "Ainda avaliando": "#94a3b8",
  "Não informado": "#475569",
};

const INVEST_COLORS: Record<string, string> = {
  "Acima de R$ 1M": "#22c55e",
  "R$ 700k – 1M": "#84cc16",
  "R$ 500k – 700k": "#f59e0b",
  "R$ 300k – 500k": "#fb923c",
  "Até R$ 300k": "#ef4444",
  "O quanto for necessário": "#22c55e",
  "Mais de R$5k": "#84cc16",
  "Até R$5k": "#f59e0b",
  "Menos de R$5k": "#ef4444",
  "Sim": "#22c55e",
  "Não": "#ef4444",
  "Não informado": "#475569",
};

const DEGREE_COLORS: Record<string, string> = {
  "Mestre/Doutor": "#22c55e",
  "Doutorando": "#84cc16",
  "Mestrando": "#84cc16",
  "Grad. Completa": "#f59e0b",
  "Graduando": "#fb923c",
  "Sem graduação": "#ef4444",
  "Não informado": "#475569",
};

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
  highlight,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all ${
        highlight
          ? "border-green-500/30 bg-green-500/6 hover:border-green-500/50"
          : accent
          ? "border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[var(--card)] hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))]"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]"
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.07] ${
          highlight ? "bg-green-500" : "bg-[var(--primary)]"
        }`}
      />
      <div className="mb-2 flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${highlight ? "text-green-400" : accent ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
        />
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${highlight ? "text-green-400" : "text-[var(--muted-foreground)]"}`}>
          {title}
        </span>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums ${highlight ? "text-green-400" : "text-[var(--foreground)]"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{sub}</p>
    </div>
  );
}

interface ApiResponse {
  profile: "academy" | "icarai" | "mirante";
  selectedFormId?: string | null;
  kpis: {
    totalLeads: number;
    totalMql: number;
    totalNonMql: number;
    totalInvestimento: number;
    cplMedio: number | null;
    custoMql: number | null;
    taxaMql: number;
  };
  gradeDistribuicao: { grade: string; total: number; label: string; isMql: boolean }[];
  timingDistribuicao: { timing: string; total: number }[];
  investDistribuicao: { invest: string; total: number }[];
  degreeDistribuicao?: { degree: string; total: number }[] | null;
  campanhasHierarchy: {
    campaignId: string;
    campaignName: string | null;
    leadsMeta: number;
    leadsScored: number;
    mql: number;
    taxaMql: number;
    invest: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpl: number | null;
    adsets: {
      adsetId: string;
      adsetName: string;
      leadsMeta: number;
      leadsScored: number;
      mql: number;
      taxaMql: number;
      invest: number;
      impressions: number;
      clicks: number;
      ctr: number;
      cpl: number | null;
      ads: {
        adId: string;
        adName: string;
        leadsMeta: number;
        leadsScored: number;
        mql: number;
        taxaMql: number;
        invest: number;
        impressions: number;
        clicks: number;
        ctr: number;
        cpl: number | null;
      }[];
    }[];
  }[];
  formsRanking: { formId: string; formName: string | null; total: number; mql: number; taxaMql: number }[];
  periodoSeries: { periodo: string; total: number; mql: number }[];
  leads: {
    id: string;
    createdTime: string;
    fullName: string | null;
    telefone: string | null;
    emailLead: string | null;
    formId: string | null;
    formName: string | null;
    campaignId: string | null;
    campaignName: string | null;
    adsetId: string | null;
    adsetName: string | null;
    adId: string | null;
    adName: string | null;
    platform: string | null;
    grade: string;
    isMql: boolean;
    timingLabel: string;
    investLabel: string;
    degreeLabel?: string | null;
  }[];
  leadsTruncated: boolean;
  totalFiltered: number;
  agrupamento: string;
  dataInicio: string;
  dataFim: string;
}

function SectionHeader({ sub, title }: { sub: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">{sub}</p>
        <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">{title}</h2>
      </div>
    </div>
  );
}

function formatPeriodLabel(key: string): string {
  // Weekly: 2026-S08 → "27/04-03/05"
  if (/^\d{4}-S\d{2}$/.test(key)) {
    const [yearStr, weekPart] = key.split("-S");
    const year = parseInt(yearStr ?? "0", 10);
    const week = parseInt(weekPart ?? "0", 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000 + (week - 1) * 7 * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return `${fmt(monday)}-${fmt(sunday)}`;
  }
  // Monthly: 2026-05 → "Mai/26"
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(month ?? "1", 10) - 1]}/${year?.slice(2)}`;
  }
  // Daily: 2026-05-13 → "13/05"
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const parts = key.split("-");
    return `${parts[2]}/${parts[1]}`;
  }
  return key;
}

export function ImobLeadScoringPanel({
  clienteId,
  dateFilter,
  clienteNome,
  midia,
  chartAgrupamento,
  onAgrupamentoChange,
}: {
  clienteId: string;
  dateFilter: DateFilter;
  clienteNome?: string;
  midia?: { series: Array<{ periodo: string; investimento: number; leads: number }> };
  chartAgrupamento?: "diario" | "semanal" | "mensal";
  onAgrupamentoChange?: (ag: "diario" | "semanal") => void;
}) {
  const gaugeUid = React.useId();
  const [agrupamento, setAgrupamento] = React.useState<"diario" | "semanal">("semanal");
  const [gradeFilter, setGradeFilter] = React.useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = React.useState<string | null>(null);
  const [showAllLeads, setShowAllLeads] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null);
  type Camp = ApiResponse["campanhasHierarchy"][0];
  type Adset = Camp["adsets"][0];
  const [selectedCamp, setSelectedCamp] = React.useState<Camp | null>(null);
  const [selectedAdset, setSelectedAdset] = React.useState<Adset | null>(null);

  const scoringAgrupamento = chartAgrupamento ?? agrupamento;

  const params = new URLSearchParams();
  if (dateFilter.dataInicio) params.set("dataInicio", dateFilter.dataInicio);
  if (dateFilter.dataFim) params.set("dataFim", dateFilter.dataFim);
  params.set("agrupamento", scoringAgrupamento);
  if (gradeFilter) params.set("grade", gradeFilter);
  if (selectedFormId) params.set("formId", selectedFormId);

  const { data, isLoading, error, refetch, isFetching } = useQuery<ApiResponse>({
    queryKey: ["imob-lead-scoring", clienteId, dateFilter.dataInicio, dateFilter.dataFim, scoringAgrupamento, gradeFilter, selectedFormId],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/lead-scoring-imob?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
  });

  async function triggerLeadSync() {
    setSyncStatus("syncing");
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/sync-leads`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSyncStatus("error");
        setSyncMsg(json.error ?? "Erro ao sincronizar leads");
      } else {
        setSyncStatus("ok");
        const created = json.leadsCreated ?? 0;
        const forms = json.formsFound ?? 0;
        setSyncMsg(`${forms} formulário${forms !== 1 ? "s" : ""} · ${json.leadsProcessed ?? 0} leads processados · ${created} novo${created !== 1 ? "s" : ""}`);
        await refetch();
      }
    } catch (e) {
      setSyncStatus("error");
      setSyncMsg(e instanceof Error ? e.message : "Erro desconhecido");
    }
    setTimeout(() => { if (syncStatus !== "syncing") setSyncStatus("idle"); }, 6000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-5 w-5 animate-spin text-[var(--primary)]" />
        <span className="ml-3 text-sm text-[var(--muted-foreground)]">Carregando leads…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/6 px-6 py-10 text-center">
        <p className="text-sm text-red-400">{error instanceof Error ? error.message : "Erro ao carregar leads."}</p>
      </div>
    );
  }

  if (!data) return null;

  const { profile, kpis, gradeDistribuicao, timingDistribuicao, investDistribuicao, degreeDistribuicao, campanhasHierarchy, formsRanking, periodoSeries, leads, leadsTruncated } = data;
  const isAcademy = profile === "academy";
  const isMirante = profile === "mirante";
  const isDiario = chartAgrupamento === "diario";
  // Build MQL lookup: formatted period label → mql count (from lead-scoring API)
  const mqlByPeriod = new Map<string, number>(
    periodoSeries.map((p) => [formatPeriodLabel(p.periodo), p.mql])
  );
  const chartData = (midia?.series ?? []).map((s) => ({
    periodo: s.periodo,
    Investimento: Math.round(s.investimento * 100) / 100,
    Leads: s.leads,
    MQL: mqlByPeriod.get(s.periodo) ?? 0,
    CPL: s.leads > 0 ? Math.round((s.investimento / s.leads) * 100) / 100 : 0,
  }));

  // Client-side filtering: campanha → adset (formId é server-side agora)
  let displayedLeads = leads;
  if (selectedCamp) displayedLeads = displayedLeads.filter((l) => l.campaignId === selectedCamp.campaignId);
  if (selectedAdset) displayedLeads = displayedLeads.filter((l) => l.adsetId === selectedAdset.adsetId);

  const visibleLeads = showAllLeads ? displayedLeads : displayedLeads.slice(0, 20);
  const hasData = kpis.totalLeads > 0;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader sub="Meta Lead Ads · Qualificação" title={`Lead Scoring${clienteNome ? ` — ${clienteNome}` : ""}`} />
      </div>

      {/* Sync result message */}
      {syncMsg && (
        <div className={`-mt-6 rounded-xl border px-4 py-2.5 text-xs ${
          syncStatus === "error"
            ? "border-red-500/20 bg-red-500/6 text-red-400"
            : "border-green-500/20 bg-green-500/6 text-green-400"
        }`}>
          {syncMsg}
        </div>
      )}

      {/* ── Seletor de Formulário ── */}
      {formsRanking.length > 1 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Formulário
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedFormId(null); setGradeFilter(null); }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                !selectedFormId
                  ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] hover:border-[var(--primary)]/20 hover:text-[var(--foreground)]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${!selectedFormId ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]"}`} />
              Todos os formulários
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${!selectedFormId ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
                {formsRanking.reduce((s, f) => s + f.total, 0)}
              </span>
            </button>
            {formsRanking.map((f) => {
              const isActive = selectedFormId === f.formId;
              const mqlPct = f.total > 0 ? Math.round((f.mql / f.total) * 100) : 0;
              return (
                <button
                  key={f.formId}
                  onClick={() => { setSelectedFormId(isActive ? null : f.formId); setGradeFilter(null); }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] hover:border-[var(--primary)]/20 hover:text-[var(--foreground)]"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]"}`} />
                  <span className="max-w-[200px] truncate">{f.formName ?? f.formId}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${isActive ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
                    {f.total}
                  </span>
                  <span className="text-[10px] text-green-400">{mqlPct}% MQL</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-8 py-16 text-center">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-[var(--muted-foreground)]/40" />
          <p className="text-base font-semibold text-[var(--foreground)]">Nenhum lead encontrado</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Use o botão abaixo para importar os leads dos formulários Meta.
          </p>
          <button
            onClick={triggerLeadSync}
            disabled={syncStatus === "syncing"}
            className={`mt-5 inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all ${
              syncStatus === "syncing"
                ? "border-[var(--primary)]/40 bg-[var(--primary)]/8 text-[var(--primary)] cursor-wait"
                : syncStatus === "error"
                ? "border-red-500/40 bg-red-500/8 text-red-400"
                : "border-[var(--primary)]/30 bg-[var(--primary)]/8 text-[var(--primary)] hover:bg-[var(--primary)]/15"
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            {syncStatus === "syncing" ? "Sincronizando formulários Meta…" : "Sincronizar leads agora"}
          </button>
          {syncMsg && (
            <p className={`mt-3 text-xs ${syncStatus === "error" ? "text-red-400" : "text-green-400"}`}>
              {syncMsg}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              title="Total de Leads"
              value={kpis.totalLeads.toString()}
              sub="formulários preenchidos"
              icon={Users}
            />
            <KpiCard
              title={isAcademy ? "Qualificados" : "MQL"}
              value={kpis.totalMql.toString()}
              sub={isAcademy ? "com graduação" : "leads qualificados"}
              icon={Target}
              highlight
            />
            <KpiCard
              title={isAcademy ? "Taxa Qualif." : "Taxa MQL"}
              value={fmtPct(kpis.taxaMql)}
              sub={isAcademy ? "dos leads qualificados" : "dos leads são MQL"}
              icon={TrendingUp}
              accent
            />
            <KpiCard
              title="CPL Médio"
              value={fmt(kpis.cplMedio)}
              sub="custo por lead"
              icon={Wallet}
            />
            <KpiCard
              title={isAcademy ? "Custo/Qualificado" : "Custo por MQL"}
              value={fmt(kpis.custoMql)}
              sub="investimento / qualificado"
              icon={Zap}
              accent
            />
          </div>

          {/* ── Qualificação — redesign completo ── */}
          {(() => {
            const mqlPct = kpis.taxaMql;
            const gaugeR = 54;
            const gaugeC = 2 * Math.PI * gaugeR;
            const gaugeArc = gaugeC * 0.75;
            const gaugeFill = (mqlPct / 100) * gaugeArc;
            const gaugeColor = mqlPct >= 70 ? "#22c55e" : mqlPct >= 40 ? "#f59e0b" : "#ef4444";
            return (
              <>
                {/* ── Performance geral — largura total (não Academy) ── */}
                {!isAcademy && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
                    <div className="flex flex-col">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Volume</p>
                          <h3 className="mt-0.5 text-base font-extrabold tracking-tight text-[var(--foreground)]">Performance geral</h3>
                        </div>
                        {onAgrupamentoChange && (
                          <div className="flex overflow-hidden rounded-lg border border-[var(--border)] text-xs">
                            <button
                              onClick={() => onAgrupamentoChange("diario")}
                              className={`px-2.5 py-1.5 font-semibold transition-colors ${isDiario ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"}`}
                            >
                              Diário
                            </button>
                            <button
                              onClick={() => onAgrupamentoChange("semanal")}
                              className={`px-2.5 py-1.5 font-semibold transition-colors ${!isDiario ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"}`}
                            >
                              Semanal
                            </button>
                          </div>
                        )}
                      </div>
                      {chartData.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                          <p className="text-sm text-[var(--muted-foreground)]">Sem dados de mídia no período.</p>
                        </div>
                      ) : (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="imobBarGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
                                  <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.8} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                              <XAxis
                                dataKey="periodo"
                                stroke="var(--muted-foreground)"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                interval={isDiario && chartData.length > 14 ? Math.ceil(chartData.length / 14) - 1 : 0}
                                angle={isDiario && chartData.length > 14 ? -45 : 0}
                                textAnchor={isDiario && chartData.length > 14 ? "end" : "middle"}
                                height={isDiario && chartData.length > 14 ? 50 : 30}
                              />
                              <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={55} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                              <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                              <Tooltip
                                {...tooltipStyle}
                                formatter={(value: number, name: string) => {
                                  if (name === "Investimento") return [`R$\u00a0${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                                  return [value, name];
                                }}
                              />
                              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                              <Bar yAxisId="left" dataKey="Investimento" fill="url(#imobBarGrad)" radius={[6, 6, 0, 0]} />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="Leads"
                                stroke="var(--primary)"
                                strokeWidth={2.5}
                                dot={{ fill: "var(--primary)", r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
                              />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="MQL"
                                stroke="#22c55e"
                                strokeWidth={2}
                                strokeDasharray="5 3"
                                dot={{ fill: "#22c55e", r: 3, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0, fill: "#22c55e" }}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Taxa MQL | Formação/Previsão — grid 2 colunas ── */}
                <div className={`grid gap-5 ${isAcademy ? "lg:grid-cols-5" : "md:grid-cols-2"}`}>
                  {/* Coluna esquerda: anel Taxa MQL + stats + chips */}
                  <div className={`group/gauge relative overflow-hidden ${isAcademy ? "lg:col-span-2 " : ""}rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[color-mix(in_srgb,var(--primary)_3%,var(--card))] p-6`}>
                    <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--primary)] opacity-[0.04] blur-3xl transition-opacity duration-700 group-hover/gauge:opacity-[0.08]" />
                    <div className="relative">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--primary)] to-[color-mix(in_srgb,var(--primary)_40%,transparent)]" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Qualificação</p>
                        <h3 className="mt-0.5 text-lg font-extrabold tracking-tight text-[var(--foreground)]">
                          {isAcademy ? "Taxa de qualificados" : "Taxa MQL"}
                        </h3>
                      </div>
                    </div>

                    <div className={`mt-4 ${isAcademy ? "flex flex-col items-center gap-3" : "flex flex-col sm:flex-row items-center gap-4 sm:gap-6"}`}>
                      {/* Gauge SVG */}
                      <svg width="180" height="144" viewBox="0 0 180 144" aria-hidden="true" className="shrink-0">
                        <defs>
                          <linearGradient id={`${gaugeUid}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={gaugeColor} stopOpacity="0.6" />
                            <stop offset="100%" stopColor={gaugeColor} stopOpacity="1" />
                          </linearGradient>
                          <filter id={`${gaugeUid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                          </filter>
                          <radialGradient id={`${gaugeUid}-bg`} cx="50%" cy="50%" r="50%">
                            <stop offset="60%" stopColor="transparent" />
                            <stop offset="100%" stopColor={gaugeColor} stopOpacity="0.06" />
                          </radialGradient>
                        </defs>
                        {/* Soft halo */}
                        <circle cx="90" cy="86" r={gaugeR + 6} fill={`url(#${gaugeUid}-bg)`} />
                        {/* Background arc */}
                        <circle
                          cx="90" cy="86" r={gaugeR}
                          fill="none"
                          stroke="var(--border)"
                          strokeWidth="13"
                          strokeDasharray={`${gaugeArc} ${gaugeC - gaugeArc}`}
                          strokeLinecap="round"
                          transform="rotate(135 90 86)"
                          opacity="0.6"
                        />
                        {/* Foreground arc with gradient + glow */}
                        <circle
                          cx="90" cy="86" r={gaugeR}
                          fill="none"
                          stroke={`url(#${gaugeUid}-grad)`}
                          strokeWidth="13"
                          strokeDasharray={`${gaugeFill} ${gaugeC - gaugeFill}`}
                          strokeLinecap="round"
                          transform="rotate(135 90 86)"
                          filter={`url(#${gaugeUid}-glow)`}
                          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                        />
                        {/* Percentage in center */}
                        <text
                          x="90" y="80"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="40"
                          fontWeight="900"
                          fill="var(--foreground)"
                          fontFamily="inherit"
                          letterSpacing="-1.5"
                        >
                          {mqlPct.toFixed(0)}%
                        </text>
                        <text
                          x="90" y="106"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="var(--muted-foreground)"
                          fontFamily="inherit"
                          letterSpacing="2"
                        >
                          {(isAcademy ? "QUALIFICADOS" : "TAXA MQL")}
                        </text>
                      </svg>

                      {/* Legend stat cards */}
                      <div className={isAcademy ? "grid w-full max-w-[260px] grid-cols-2 gap-2" : "flex w-full flex-1 flex-col gap-2.5"}>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: gaugeColor, boxShadow: `0 0 6px ${gaugeColor}` }} />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{isAcademy ? "Qualif." : "MQL"}</span>
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-2">
                            <p className="text-2xl font-black tabular-nums leading-none" style={{ color: gaugeColor }}>{kpis.totalMql.toLocaleString("pt-BR")}</p>
                            {!isAcademy && (
                              <span className="text-[10px] font-semibold tabular-nums text-[var(--muted-foreground)]">{mqlPct.toFixed(0)}% do total</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]/40" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Leads totais</span>
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-2">
                            <p className="text-2xl font-black tabular-nums leading-none text-[var(--foreground)]">{kpis.totalLeads.toLocaleString("pt-BR")}</p>
                            {!isAcademy && (
                              <span className="text-[10px] font-semibold tabular-nums text-[var(--muted-foreground)]">no período</span>
                            )}
                          </div>
                        </div>
                        {!isAcademy && (
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]/40" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Não qualificados</span>
                            </div>
                            <div className="mt-0.5 flex items-baseline justify-between gap-2">
                              <p className="text-2xl font-black tabular-nums leading-none text-[var(--muted-foreground)]">{(kpis.totalLeads - kpis.totalMql).toLocaleString("pt-BR")}</p>
                              <span className="text-[10px] font-semibold tabular-nums text-[var(--muted-foreground)]">{(100 - mqlPct).toFixed(0)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Icaraí (não Mirante): grade chips clicáveis */}
                    {!isAcademy && !isMirante && (
                      <div className="mt-5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Filtrar por grau</p>
                        <div className="flex flex-wrap gap-2">
                          {gradeDistribuicao.filter((g) => g.total > 0).map((g) => {
                            const isActive = gradeFilter === g.grade;
                            const color = getGradeColor(g.grade, isMirante);
                            return (
                              <button
                                key={g.grade}
                                onClick={() => setGradeFilter(isActive ? null : g.grade)}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                                  isActive
                                    ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
                                    : "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] hover:border-[var(--primary)]/20 hover:text-[var(--foreground)]"
                                }`}
                              >
                                <span
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
                                  style={{ backgroundColor: color }}
                                >
                                  {g.grade}
                                </span>
                                {g.total}
                                {g.isMql && <span className="text-green-400">●</span>}
                              </button>
                            );
                          })}
                          {gradeFilter && (
                            <button
                              onClick={() => setGradeFilter(null)}
                              className="rounded-full border border-[var(--primary)]/30 px-2 py-1 text-[10px] text-[var(--primary)] hover:bg-[var(--primary)]/8 transition-colors"
                            >
                              ✕ limpar
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Academy: dois pills Qualificado/Não qualificado clicáveis */}
                    {isAcademy && (
                      <div className="mt-5 flex gap-2">
                        {[
                          { grade: "A", label: "Qualificados", color: "#22c55e", count: kpis.totalMql },
                          { grade: "E", label: "Não qualificados", color: "#ef4444", count: kpis.totalNonMql },
                        ].map(({ grade, label, color, count }) => {
                          const isActive = gradeFilter === grade;
                          return (
                            <button
                              key={grade}
                              onClick={() => setGradeFilter(isActive ? null : grade)}
                              className={`flex-1 rounded-xl border p-3 text-left transition-all ${
                                isActive
                                  ? "border-[var(--primary)]/40 bg-[var(--primary)]/8"
                                  : "border-[var(--border)] bg-[var(--muted)]/30 hover:border-[var(--primary)]/20"
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{label}</span>
                              </div>
                              <p className="mt-1 text-2xl font-black tabular-nums" style={{ color }}>{count}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Coluna direita: Academy = Formação acadêmica; outros = Previsão/Intenção de compra */}
                  <div className={`group/right relative overflow-hidden ${isAcademy ? "lg:col-span-3 min-h-[360px] " : ""}rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[color-mix(in_srgb,var(--primary)_3%,var(--card))] p-6 flex flex-col`}>
                    <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-[var(--primary)] opacity-[0.04] blur-3xl transition-opacity duration-700 group-hover/right:opacity-[0.08]" />
                    {isAcademy ? (
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--primary)] to-[color-mix(in_srgb,var(--primary)_40%,transparent)]" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Critério de qualificação</p>
                            <h3 className="mt-0.5 text-lg font-extrabold tracking-tight text-[var(--foreground)]">Formação acadêmica dos leads</h3>
                          </div>
                        </div>
                        {(degreeDistribuicao ?? []).length === 0 ? (
                          <p className="mt-6 text-sm text-[var(--muted-foreground)]">Sem dados de formação no período.</p>
                        ) : (() => {
                          const filtered = (degreeDistribuicao ?? []).filter((d) => d.total > 0);
                          const top = filtered.reduce((a, b) => (b.total > a.total ? b : a), filtered[0]);
                          const topPct = kpis.totalLeads > 0 && top ? (top.total / kpis.totalLeads) * 100 : 0;
                          const topColor = top ? (DEGREE_COLORS[top.degree] ?? "#94a3b8") : "#94a3b8";
                          const maxCount = Math.max(...filtered.map((x) => x.total), 1);
                          return (
                            <>
                              {top && (
                                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5">
                                  <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Formação predominante</p>
                                    <p className="mt-0.5 truncate text-sm font-bold text-[var(--foreground)]">{top.degree}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-black tabular-nums leading-none" style={{ color: topColor }}>{topPct.toFixed(0)}%</p>
                                    <p className="text-[10px] font-semibold tabular-nums text-[var(--muted-foreground)]">{top.total} leads</p>
                                  </div>
                                </div>
                              )}
                              <div className="mt-4 flex-1 space-y-2.5">
                                {filtered.map((d) => {
                                  const pct = kpis.totalLeads > 0 ? (d.total / kpis.totalLeads) * 100 : 0;
                                  const color = DEGREE_COLORS[d.degree] ?? "#94a3b8";
                                  return (
                                    <div key={d.degree} className="group/row -mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.025]">
                                      <div className="mb-1.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
                                          <span className="text-[12.5px] font-medium text-[var(--foreground)]">{d.degree}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                          <span className="text-[15px] font-extrabold tabular-nums text-[var(--foreground)]">{d.total}</span>
                                          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--muted-foreground)]">{pct.toFixed(0)}%</span>
                                        </div>
                                      </div>
                                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]/40">
                                        <div
                                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                                          style={{
                                            width: `${(d.total / maxCount) * 100}%`,
                                            background: `linear-gradient(90deg, ${color}99 0%, ${color} 100%)`,
                                            boxShadow: `0 0 10px ${color}55`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--primary)] to-[color-mix(in_srgb,var(--primary)_40%,transparent)]" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                              {isMirante ? "Previsão de compra" : "Intenção de compra"}
                            </p>
                            <h3 className="mt-0.5 text-lg font-extrabold tracking-tight text-[var(--foreground)]">
                              {isMirante ? "Qual é sua previsão para compra?" : "Quando pretende adquirir?"}
                            </h3>
                          </div>
                        </div>
                        {timingDistribuicao.length === 0 ? (
                          <p className="mt-6 text-sm text-[var(--muted-foreground)]">Campo não encontrado.</p>
                        ) : (() => {
                          const top = timingDistribuicao.reduce((a, b) => (b.total > a.total ? b : a), timingDistribuicao[0]);
                          const topPct = kpis.totalLeads > 0 && top ? (top.total / kpis.totalLeads) * 100 : 0;
                          const topColor = top ? (TIMING_COLORS[top.timing] ?? "#94a3b8") : "#94a3b8";
                          const maxCount = Math.max(...timingDistribuicao.map((x) => x.total), 1);
                          return (
                            <>
                              {top && (
                                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5">
                                  <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Maior previsão</p>
                                    <p className="mt-0.5 truncate text-sm font-bold text-[var(--foreground)]">{top.timing}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-black tabular-nums leading-none" style={{ color: topColor }}>{topPct.toFixed(0)}%</p>
                                    <p className="text-[10px] font-semibold tabular-nums text-[var(--muted-foreground)]">{top.total} leads</p>
                                  </div>
                                </div>
                              )}
                              <div className="mt-4 flex-1 space-y-2.5">
                                {timingDistribuicao.map((t) => {
                                  const pct = kpis.totalLeads > 0 ? (t.total / kpis.totalLeads) * 100 : 0;
                                  const color = TIMING_COLORS[t.timing] ?? "#94a3b8";
                                  return (
                                    <div key={t.timing} className="group/row -mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.025]">
                                      <div className="mb-1.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
                                          <span className="text-[12.5px] font-medium text-[var(--foreground)]">{t.timing}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                          <span className="text-[15px] font-extrabold tabular-nums text-[var(--foreground)]">{t.total}</span>
                                          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--muted-foreground)]">{pct.toFixed(0)}%</span>
                                        </div>
                                      </div>
                                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]/40">
                                        <div
                                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                                          style={{
                                            width: `${(t.total / maxCount) * 100}%`,
                                            background: `linear-gradient(90deg, ${color}99 0%, ${color} 100%)`,
                                            boxShadow: `0 0 10px ${color}55`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Capacidade financeira — standalone para Icaraí (não Mirante, não Academy) */}
                {!isAcademy && !isMirante && (
                  <div className="group/cap relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[color-mix(in_srgb,var(--primary)_3%,var(--card))] p-6">
                    <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-[var(--primary)] opacity-[0.04] blur-3xl transition-opacity duration-700 group-hover/cap:opacity-[0.08]" />
                    <div className="relative flex items-start gap-2.5">
                      <div className="mt-0.5 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--primary)] to-[color-mix(in_srgb,var(--primary)_40%,transparent)]" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                          Capacidade financeira
                        </p>
                        <h3 className="mt-0.5 text-lg font-extrabold tracking-tight text-[var(--foreground)]">
                          Quanto pretende investir?
                        </h3>
                      </div>
                    </div>
                    <div className="relative mt-4 space-y-2.5">
                      {investDistribuicao.map((t) => {
                        const pct = kpis.totalLeads > 0 ? (t.total / kpis.totalLeads) * 100 : 0;
                        const color = INVEST_COLORS[t.invest] ?? "#94a3b8";
                        const maxCount = Math.max(...investDistribuicao.map((x) => x.total), 1);
                        return (
                          <div key={t.invest} className="group/row -mx-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.025]">
                            <div className="mb-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
                                <span className="text-[12.5px] font-medium text-[var(--foreground)]">{t.invest}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[15px] font-extrabold tabular-nums text-[var(--foreground)]">{t.total}</span>
                                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--muted-foreground)]">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]/40">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${(t.total / maxCount) * 100}%`,
                                  background: `linear-gradient(90deg, ${color}99 0%, ${color} 100%)`,
                                  boxShadow: `0 0 10px ${color}55`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {investDistribuicao.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">Campo não encontrado.</p>}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* ── Campanhas ── */}
          <CampanhasPanel
            clienteId={clienteId}
            dateFilter={dateFilter}
            canal="meta"
            mqlByCampaignName={new Map(
              campanhasHierarchy
                .filter((c) => (c.campaignName ?? "").trim().length > 0)
                .map((c) => [c.campaignName as string, c.mql])
            )}
            mqlByAdsetId={new Map(campanhasHierarchy.flatMap((c) => c.adsets.map((a) => [a.adsetId, a.mql])))}
            mqlByAdId={new Map(campanhasHierarchy.flatMap((c) => c.adsets.flatMap((a) => a.ads.map((ad) => [ad.adId, ad.mql]))))}
          />

          {/* Tabela de leads individuais */}
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeader sub="Leads" title="Lista detalhada" />
              <div className="flex flex-wrap items-center gap-2">
                {/* Chips de filtros ativos */}
                {selectedCamp && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/8 px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
                    <span className="text-[var(--primary)]">Campanha:</span>
                    <span className="max-w-[140px] truncate">{selectedCamp.campaignName}</span>
                    <button onClick={() => { setSelectedCamp(null); setSelectedAdset(null); }} className="ml-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
                  </span>
                )}
                {selectedAdset && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/8 px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
                    <span className="text-[var(--primary)]">Conjunto:</span>
                    <span className="max-w-[120px] truncate">{selectedAdset.adsetName}</span>
                    <button onClick={() => setSelectedAdset(null)} className="ml-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
                  </span>
                )}
                {selectedFormId && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/8 px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
                    <span className="text-[var(--primary)]">Form:</span>
                    <span className="max-w-[120px] truncate">{formsRanking.find((f) => f.formId === selectedFormId)?.formName ?? selectedFormId}</span>
                    <button onClick={() => setSelectedFormId(null)} className="ml-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
                  </span>
                )}
                <span className="text-xs text-[var(--muted-foreground)]">
                  {displayedLeads.length} lead{displayedLeads.length !== 1 ? "s" : ""}
                  {leadsTruncated && !selectedCamp && !selectedAdset && !selectedFormId ? " (limitado a 500)" : ""}
                </span>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className={`w-full text-sm ${isAcademy ? "min-w-[900px]" : "min-w-[820px]"}`}>
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {(isAcademy
                      ? ["Data", "Nome", "Status", "Formação", "Formulário", "Campanha", "Conjunto", "Anúncio"]
                      : ["Data", "Nome", "Grau", "Timing", "Campanha"]
                    ).map((h) => (
                      <th key={h} className="pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visibleLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-2.5 pr-3 text-xs tabular-nums text-[var(--muted-foreground)] whitespace-nowrap">
                        {new Date(lead.createdTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-[var(--foreground)]">
                        <div className="max-w-[130px] truncate">{lead.fullName ?? "—"}</div>
                        {lead.telefone && (
                          <div className="text-[10px] text-[var(--muted-foreground)]">{lead.telefone}</div>
                        )}
                      </td>

                      {/* Status — Academy: Qualificado/Não qualificado pill; Icaraí: letter grade badge */}
                      {isAcademy ? (
                        <td className="py-2.5 pr-3">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
                            style={
                              lead.isMql
                                ? { backgroundColor: "#22c55e20", color: "#22c55e" }
                                : { backgroundColor: "#ef444420", color: "#ef4444" }
                            }
                          >
                            {lead.isMql ? "Qualificado" : "Não qualificado"}
                          </span>
                        </td>
                      ) : (
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                              style={{ backgroundColor: getGradeColor(lead.grade, isMirante) }}
                            >
                              {lead.grade}
                            </span>
                            {lead.isMql && (
                              <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-400">
                                MQL
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Academy: Formação pill */}
                      {isAcademy ? (
                        <td className="py-2.5 pr-3 text-xs">
                          {lead.degreeLabel ? (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: `${DEGREE_COLORS[lead.degreeLabel] ?? "#94a3b8"}20`,
                                color: DEGREE_COLORS[lead.degreeLabel] ?? "#94a3b8",
                              }}
                            >
                              {lead.degreeLabel}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                      ) : (
                        /* Icaraí: Timing pill */
                        <td className="py-2.5 pr-3 text-xs">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${TIMING_COLORS[lead.timingLabel] ?? "#94a3b8"}20`,
                              color: TIMING_COLORS[lead.timingLabel] ?? "#94a3b8",
                            }}
                          >
                            {lead.timingLabel}
                          </span>
                        </td>
                      )}

                      {/* Icaraí only: Investimento — removido */}

                      {isAcademy && (
                        <td className="py-2.5 pr-3 text-xs text-[var(--muted-foreground)]">
                          <div className="max-w-[120px] truncate">{lead.formName ?? "—"}</div>
                        </td>
                      )}
                      <td className="py-2.5 pr-3 text-xs text-[var(--muted-foreground)]">
                        <div className="max-w-[120px] truncate">{lead.campaignName ?? "—"}</div>
                      </td>

                      {/* Academy: Conjunto + Anúncio */}
                      {isAcademy && (
                        <>
                          <td className="py-2.5 pr-3 text-xs text-[var(--muted-foreground)]">
                            <div className="max-w-[120px] truncate">{lead.adsetName ?? "—"}</div>
                          </td>
                          <td className="py-2.5 text-xs text-[var(--muted-foreground)]">
                            <div className="max-w-[120px] truncate">{lead.adName ?? "—"}</div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-[var(--muted-foreground)]">
                        Nenhum lead encontrado para os filtros selecionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {leads.length > 20 && (
              <button
                onClick={() => setShowAllLeads((v) => !v)}
                className="mt-3 flex items-center gap-1.5 text-xs text-[var(--primary)] underline underline-offset-2"
              >
                {showAllLeads ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Ver todos os {displayedLeads.length} leads
                  </>
                )}
              </button>
            )}
          </div>

          {/* Legenda MQL */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              Critérios de qualificação MQL
            </p>
            {isAcademy ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { color: "#22c55e", title: "Qualificado", desc: "Lead tem graduação (cursando ou completa, em qualquer nível)" },
                  { color: "#ef4444", title: "Não qualificado", desc: "Lead não informou ou não possui nenhuma graduação" },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color, marginTop: 4 }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">{item.title}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(isMirante
                  ? [
                      { grade: "A", color: "#22c55e", title: "MQL — Até 3 meses", desc: "Lead com previsão de compra de até 3 meses (único nível qualificado)" },
                      { grade: "B", color: "#84cc16", title: "Quente — 3 a 6 meses", desc: "Lead com intenção de compra em 3 a 6 meses (não MQL)" },
                      { grade: "C", color: "#f59e0b", title: "Em avaliação", desc: "Lead ainda avaliando a compra (não MQL)" },
                      { grade: "E", color: "#94a3b8", title: "Sem dados", desc: "Lead não informou previsão de compra" },
                    ]
                  : [
                      { grade: "A", color: "#22c55e", title: "Hot MQL", desc: "Agora + R$ 700k ou acima de R$ 1M" },
                      { grade: "B", color: "#84cc16", title: "MQL", desc: "Agora + R$ 300k até R$ 700k" },
                      { grade: "C", color: "#f59e0b", title: "MQL Morno", desc: "3 a 6 meses + qualquer valor acima de R$ 300k" },
                      { grade: "D", color: "#94a3b8", title: "Potencial", desc: "Avaliando, mas com orçamento qualificado (≥ R$ 300k)" },
                    ]
                ).map((item) => (
                  <div key={item.grade} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.grade}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">{item.title}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
