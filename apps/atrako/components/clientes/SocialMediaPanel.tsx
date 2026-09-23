"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Bar,
  Line,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
  ReferenceLine,
} from "recharts";
import {
  Users, Heart, Eye, TrendingUp, Instagram, ImageIcon,
  MessageCircle, ThumbsUp, X, ChevronRight, Film, Share2, Layers,
  MousePointerClick, BarChart2, Zap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  caption: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  mediaType: string;
  timestamp: string;
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvos: number;
  compartilhamentos: number;
  taxaEngajamento: number;
  videoViews?: number;
}

interface MonthRow {
  mes: string;
  label: string;
  alcance: number;
  engajamento: number;
  novosSeguidores: number | null;
  followersTotal: number;
  impressoes?: number;
}

interface WeekRow {
  semana: string;
  label: string;
  gains: number;
  followersTotal: number;
}

interface OnlineActivity {
  byDay: { day: string; count: number }[];
  byHour: { hour: string; count: number }[];
}

interface Demographics {
  genero: { F: number; M: number; U: number };
  faixaEtaria: Record<string, number>;
  cidades: Array<{ cidade: string; seguidores: number }>;
  onlineActivity?: OnlineActivity | null;
}

interface SocialMediaData {
  configured: boolean;
  error?: string;
  periodoLabel?: string;
  profile?: { nome: string; followersTotal: number };
  period?: {
    alcanceTotal: number;
    engajamentoTotal: number;
    novosSeguidores: number | null;
    taxaEngajamento: number;
    curtidasTotal: number | null;
    comentariosTotal: number | null;
    compartilhamentosTotal?: number | null;
    salvosTotal?: number | null;
    websiteClicks?: number | null;
    impressoesTotal?: number | null;
    visualizacoesTotal?: number | null;
    publicacoesTotal?: number;
    alcancePostsTotal?: number;
    interacoesTotaisTotal?: number;
    visitasPerfil?: number;
    perdaSeguidores?: number;
    insightsFetched?: boolean;
  };
  monthly?: MonthRow[];
  monthlyHistory?: MonthRow[];
  weeklyData?: WeekRow[] | null;
  dailyData?: Array<{ label: string; date: string; gains: number; followersTotal: number }> | null;
  topPosts?: Post[];
  demographics?: Demographics | null;
}

interface Props {
  clienteId: string;
  dateFilter: { periodo?: string; dataInicio?: string | null; dataFim?: string | null };
}

// ── Formatters ─────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString("pt-BR");
}

function fmtFull(n: number) { return n.toLocaleString("pt-BR"); }

function fmtPct(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).replace(".", "");
}

// ── UI primitives ──────────────────────────────────────────────────────────

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

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.05]" />
      <div className="mb-2 flex items-center gap-2 text-[var(--primary)]">{icon}</div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

function SkeletonCard({ h = 24 }: { h?: number }) {
  return <div className={`h-${h} animate-pulse rounded-2xl bg-[var(--muted)]/40`} />;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

const CustomTooltip = ({
  active, payload, label, valueLabel, secondaryLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  valueLabel?: string;
  secondaryLabel?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-[var(--foreground)]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {i === 0 ? (valueLabel ?? p.name) : (secondaryLabel ?? p.name)}:{" "}
          <span className="font-bold">{fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ── Post type badge ─────────────────────────────────────────────────────────

function MediaBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    VIDEO: { label: "Reel", cls: "bg-purple-500/15 text-purple-400" },
    CAROUSEL_ALBUM: { label: "Carrossel", cls: "bg-blue-500/15 text-blue-400" },
    IMAGE: { label: "Imagem", cls: "bg-[var(--muted)]/60 text-[var(--muted-foreground)]" },
  };
  const cfg = map[type] ?? { label: type, cls: "bg-[var(--muted)]/60 text-[var(--muted-foreground)]" };
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Post Preview Modal ─────────────────────────────────────────────────────

function PostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-[var(--muted)]/80 p-1.5 text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-t-3xl bg-[var(--muted)]/30">
          {post.thumbnailUrl ? (
            <img
              src={post.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Instagram className="h-16 w-16 text-[var(--muted-foreground)]/30" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {post.mediaType === "VIDEO" ? "Reel / Vídeo" : post.mediaType === "CAROUSEL_ALBUM" ? "Carrossel" : "Imagem"}
          </div>
        </div>

        {/* Info */}
        <div className="p-5 space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {[
              { label: "Alcance", value: fmt(post.alcance) },
              ...(post.videoViews ? [{ label: "Visualizações", value: fmt(post.videoViews) }] : []),
              { label: "Curtidas", value: fmt(post.curtidas) },
              { label: "Comentários", value: fmt(post.comentarios) },
              { label: "Salvos", value: fmt(post.salvos) },
              { label: "Compart.", value: fmt(post.compartilhamentos) },
              { label: "Taxa Eng.", value: fmtPct(post.taxaEngajamento) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-[var(--muted)]/30 p-2.5 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
                <p className="mt-0.5 text-sm font-extrabold text-[var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>

          {/* Caption */}
          {post.caption && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Legenda</p>
              <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{post.caption}</p>
            </div>
          )}

          <p className="text-[11px] text-[var(--muted-foreground)]">{fmtDate(post.timestamp)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Mini chart ─────────────────────────────────────────────────────────────

function MiniChart({ data, dataKey, title, sub, valueLabel, color = "var(--primary)" }: {
  data: MonthRow[] | undefined;
  dataKey: string;
  title: string;
  sub: string;
  valueLabel: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{sub}</p>
      <p className="mb-4 text-base font-bold text-[var(--foreground)]">{title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip content={<CustomTooltip valueLabel={valueLabel} />} cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Organic Performance (unified: bars = alcance, line = taxa engajamento) ──
// data        = evolutionData (always 12 months — for the chart)
// periodData  = monthly       (date-filtered — for the KPI strip)

function OrganicPerformanceSection({ data, periodData }: { data: MonthRow[] | undefined; periodData?: MonthRow[] }) {
  if (!data || data.length === 0) return null;

  // Chart data enriched with taxa de engajamento and MoM (alcance)
  const enriched = data.map((m, i) => {
    const taxa = m.alcance > 0 ? (m.engajamento / m.alcance) * 100 : 0;
    const prevAlc = i > 0 ? data[i - 1].alcance : null;
    const momAlc  = prevAlc && prevAlc > 0 ? ((m.alcance - prevAlc) / prevAlc) * 100 : null;
    return { ...m, taxaEngajamento: taxa, momAlc };
  });

  // KPI strip: use period-filtered data when available, otherwise fall back to chart data
  const stripSrc = (periodData && periodData.length > 0) ? periodData : data;
  const stripRows = stripSrc.map((m) => ({
    ...m,
    taxaEngajamento: m.alcance > 0 ? (m.engajamento / m.alcance) * 100 : 0,
  }));

  const avgTaxa = stripRows.reduce((s, d) => s + d.taxaEngajamento, 0) / stripRows.length;
  const totalEng = stripRows.reduce((s, d) => s + d.engajamento, 0);
  const peakEng  = stripRows.reduce((b, d) => d.taxaEngajamento > b.taxaEngajamento ? d : b, stripRows[0]);

  // Reference line on chart uses 12-month average (from enriched = chart data)
  const avgTaxaChart = enriched.reduce((s, d) => s + d.taxaEngajamento, 0) / enriched.length;

  const isPeriodFiltered = periodData && periodData.length > 0 && periodData !== data;
  const stripLabel = isPeriodFiltered ? "no período" : "últimos 12 meses";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Evolução mensal · últimos 12 meses</p>
        <h3 className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">Performance orgânica</h3>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">
        <div className="px-5 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Taxa média</p>
          <p className="text-2xl font-extrabold text-[var(--primary)]">
            {avgTaxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{stripLabel}</p>
        </div>
        <div className="px-5 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Total engajadas</p>
          <p className="text-2xl font-extrabold text-[var(--foreground)]">{fmt(totalEng)}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{stripLabel}</p>
        </div>
        <div className="px-5 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Melhor taxa</p>
          <p className="text-2xl font-extrabold text-[var(--foreground)]">
            {peakEng.taxaEngajamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{peakEng.label}</p>
        </div>
      </div>

      {/* ── Chart: bars = alcance, line = taxa engajamento ── */}
      <div className="px-4 pb-5 pt-4">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={enriched} margin={{ top: 18, right: 62, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="orgAlcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => fmt(v)} width={52} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#60a5fa" }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={46} />
            <Tooltip
              content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as typeof enriched[0];
                return (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-xl min-w-[168px]">
                    <p className="mb-1.5 font-semibold text-[var(--foreground)]">{lbl}</p>
                    <p style={{ color: "var(--primary)" }}>Alcance: <span className="font-bold">{fmtFull(d?.alcance ?? 0)}</span></p>
                    <p className="text-blue-400">Taxa de engaj.: <span className="font-bold">{(d?.taxaEngajamento ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span></p>
                    <p className="text-[var(--muted-foreground)]">Interações: <span className="font-bold">{fmtFull(d?.engajamento ?? 0)}</span></p>
                    {d?.momAlc != null && (
                      <p className={`mt-1 ${d.momAlc >= 0 ? "text-green-400" : "text-red-400"}`}>
                        MoM: {d.momAlc >= 0 ? "+" : ""}{d.momAlc.toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine yAxisId="right" y={avgTaxaChart} stroke="#60a5fa" strokeDasharray="4 4" strokeOpacity={0.5}
              label={{ value: `Média 12m ${avgTaxaChart.toFixed(1)}%`, position: "insideTopRight", fontSize: 9, fill: "#60a5fa", dy: -6 }} />
            <Bar yAxisId="left" dataKey="alcance" fill="url(#orgAlcGrad)" radius={[4, 4, 0, 0]} maxBarSize={40}>
              <LabelList dataKey="alcance" position="top" formatter={(v: number) => fmt(v)} style={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="taxaEngajamento" stroke="#60a5fa" strokeWidth={2}
              dot={{ r: 3, fill: "#60a5fa" }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 px-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: "var(--primary)" }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">Alcance orgânico</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded-full bg-blue-400" />
            <span className="text-[10px] text-[var(--muted-foreground)]">Taxa de engajamento</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-blue-400/60" />
            <span className="text-[10px] text-[var(--muted-foreground)]">Média 12 meses</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Activity Chart (day / hour) ────────────────────────────────────────────

function ActivityChart({ data, dataKey, labelKey, title, sub, color = "#3b82f6" }: {
  data: { [k: string]: number | string }[];
  dataKey: string;
  labelKey: string;
  title: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{sub}</p>
      <p className="mb-4 text-base font-bold text-[var(--foreground)]">{title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            formatter={(v: number) => [fmtFull(v), "Seguidores online"]}
            cursor={{ fill: color, fillOpacity: 0.06 }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Gender/Age colors ──────────────────────────────────────────────────────
const GENDER_COLORS = { F: "#ff6a00", M: "#3b82f6", U: "#94a3b8" };
const GENDER_LABELS = { F: "Feminino", M: "Masculino", U: "Não especificado" };
const AGE_ORDER = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];


// ── Main component ─────────────────────────────────────────────────────────

export function SocialMediaPanel({ clienteId, dateFilter }: Props) {
  const [granularity, setGranularity] = React.useState<"diario" | "semanal" | "mensal">("semanal");
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);

  // Periods that force monthly view
  const isYtdPeriod = (p: string) =>
    p === "ytd" || p === "365d" || p === "semestreAtual" || p === "anual";

  const isYtd = isYtdPeriod(dateFilter.periodo ?? "");

  // Effective granularity: YTD always forces "mensal" regardless of toggle state
  const effectiveGranularity: "diario" | "semanal" | "mensal" = isYtd ? "mensal" : granularity;


  const params = new URLSearchParams();
  if (dateFilter.dataInicio) params.set("dataInicio", dateFilter.dataInicio);
  if (dateFilter.dataFim) params.set("dataFim", dateFilter.dataFim);
  params.set("granularity", effectiveGranularity);

  // Query 1: KPI — fast, served from DB + supplement + demographics in parallel
  const kpiParams = new URLSearchParams(params);
  kpiParams.set("section", "kpi");
  const { data, isLoading, error } = useQuery<SocialMediaData>({
    queryKey: ["social-media-kpi", clienteId, dateFilter.dataInicio, dateFilter.dataFim, effectiveGranularity],
    queryFn: async () => {
      const r = await fetch(`/api/clientes/${clienteId}/social-media?${kpiParams}`);
      if (!r.ok) throw new Error("Erro ao carregar dados de Social Media");
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  // Query 2: Posts — slow (N per-post insights calls), loads after KPI is visible
  const postsParams = new URLSearchParams();
  if (dateFilter.dataInicio) postsParams.set("dataInicio", dateFilter.dataInicio);
  if (dateFilter.dataFim) postsParams.set("dataFim", dateFilter.dataFim);
  postsParams.set("section", "posts");
  const { data: postsData, isLoading: postsLoading } = useQuery<SocialMediaData>({
    queryKey: ["social-media-posts", clienteId, dateFilter.dataInicio, dateFilter.dataFim],
    queryFn: async () => {
      const r = await fetch(`/api/clientes/${clienteId}/social-media?${postsParams}`);
      if (!r.ok) return {} as SocialMediaData;
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
    enabled: !!data?.configured,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} h={24} />)}
        </div>
        <SkeletonCard h={64} />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-[var(--muted)]/40" />)}
        </div>
      </div>
    );
  }

  if (error || data?.error) {
    const msg = data?.error ?? (error instanceof Error ? error.message : "Erro desconhecido");
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/6 px-6 py-10 text-center">
        <p className="text-sm font-medium text-red-400">{msg}</p>
        <p className="mt-1 text-xs text-red-400/60">Verifique se o token Meta tem permissões de Instagram Insights.</p>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
        <Instagram className="mb-4 h-10 w-10 text-[var(--muted-foreground)]/40" />
        <p className="text-base font-semibold text-[var(--foreground)]">Instagram não configurado</p>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          Adicione o <strong>Instagram Business Account ID</strong> no cadastro deste cliente.
        </p>
      </div>
    );
  }

  const { profile, period, monthly, monthlyHistory, weeklyData, dailyData, demographics, periodoLabel } = data;
  // Posts come from the separate slow query
  const topPosts = postsData?.topPosts ?? [];
  const postsPeriod = postsData?.period;
  const evolutionData = (monthlyHistory && monthlyHistory.length > 1) ? monthlyHistory : monthly;

  // Followers chart data — diario → dailyData, semanal → weeklyData, mensal → monthly
  const followerChartData =
    effectiveGranularity === "diario" && dailyData && dailyData.length > 0
      ? dailyData.map((d) => ({ label: d.label, gains: d.gains, followersTotal: d.followersTotal }))
      : effectiveGranularity === "semanal" && weeklyData && weeklyData.length > 0
        ? weeklyData.map((w) => ({ label: w.label, gains: w.gains, followersTotal: w.followersTotal }))
        : (monthly ?? []).map((m) => ({ label: m.label, gains: m.novosSeguidores ?? 0, followersTotal: m.followersTotal }));

  const followerMax = Math.max(...followerChartData.map((d) => d.followersTotal), 1);
  const gainMax = Math.max(...followerChartData.map((d) => d.gains), 1);

  // Demographics
  const generoData = demographics
    ? Object.entries(demographics.genero)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: GENDER_LABELS[k as keyof typeof GENDER_LABELS], value: v, key: k }))
    : [];

  const totalGenero = generoData.reduce((s, d) => s + d.value, 0);

  const faixaEtariaData = demographics
    ? AGE_ORDER
        .filter((age) => demographics.faixaEtaria[age] > 0)
        .map((age) => ({ label: age, value: demographics.faixaEtaria[age] }))
    : [];

  // Post filter tabs
  const allPosts = topPosts ?? [];
  const reels = allPosts.filter(p => p.mediaType === "VIDEO");
  const nonReels = allPosts.filter(p => p.mediaType !== "VIDEO");

  // Online activity
  const onlineActivity = demographics?.onlineActivity;

  return (
    <>
      {/* Post preview modal */}
      {selectedPost && <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />}

      <div className="space-y-10">

        {/* ── KPI grid (10 cards, 2×5) ── */}
        {(() => {
          const novosSegs = period?.novosSeguidores ?? null;
          const followersStart = (profile?.followersTotal ?? 0) - (novosSegs ?? 0);
          const taxaCrescimento = novosSegs !== null && followersStart > 0
            ? (novosSegs / followersStart) * 100
            : null;
          const visualizacoes = period?.visualizacoesTotal ?? postsPeriod?.visualizacoesTotal ?? null;
          const curtidas = period?.curtidasTotal ?? postsPeriod?.curtidasTotal ?? null;
          const comentarios = period?.comentariosTotal ?? postsPeriod?.comentariosTotal ?? null;
          const compartilhamentos =
            period?.compartilhamentosTotal ?? postsPeriod?.compartilhamentosTotal ?? null;
          return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {/* Row 1 — audience & reach */}
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label="Seguidores"
                value={fmtFull(profile?.followersTotal ?? 0)}
                sub="Total atual"
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Novos seguidores"
                value={novosSegs !== null ? fmtFull(novosSegs) : "—"}
                sub={taxaCrescimento !== null ? `↑ ${taxaCrescimento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% de crescimento` : "No período"}
              />
              <KpiCard
                icon={<Eye className="h-4 w-4" />}
                label="Alcance"
                value={fmtFull(period?.alcanceTotal ?? 0)}
                sub="Contas alcançadas"
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Pessoas engajadas"
                value={fmtFull(period?.engajamentoTotal ?? 0)}
                sub="Contas únicas engajadas"
              />
              <KpiCard
                icon={<Heart className="h-4 w-4" />}
                label="Taxa de engajamento"
                value={fmtPct(period?.taxaEngajamento ?? 0)}
                sub="Contas engajadas / alcance"
              />
              {/* Row 2 — content & interactions */}
              <KpiCard
                icon={<MousePointerClick className="h-4 w-4" />}
                label="Visitas no perfil"
                value={period?.visitasPerfil != null ? fmtFull(period.visitasPerfil) : "—"}
                sub="No período"
              />
              <KpiCard
                icon={<Eye className="h-4 w-4" />}
                label="Visualizações"
                value={visualizacoes != null ? fmtFull(visualizacoes) : "—"}
                sub="No período"
              />
              <KpiCard
                icon={<Heart className="h-4 w-4" />}
                label="Curtidas"
                value={curtidas != null ? fmtFull(curtidas) : "—"}
                sub="No período"
              />
              <KpiCard
                icon={<MessageCircle className="h-4 w-4" />}
                label="Comentários"
                value={comentarios != null ? fmtFull(comentarios) : "—"}
                sub="No período"
              />
              <KpiCard
                icon={<Share2 className="h-4 w-4" />}
                label="Compartilhamentos"
                value={compartilhamentos != null ? fmtFull(compartilhamentos) : "—"}
                sub="No período"
              />
            </div>
          );
        })()}

        {/* ── Followers chart (full width, ComposedChart) ── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Seguidores</p>
              <h3 className="text-lg font-bold text-[var(--foreground)]">Ganho de seguidores</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Barras = ganho · Linha = total acumulado
              </p>
            </div>
            {/* Granularity toggle — hidden when YTD (forced mensal) */}
            {isYtd ? (
              <span className="rounded-full border border-[var(--border)] bg-[var(--muted)]/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Mensal
              </span>
            ) : (
              <div className="flex overflow-hidden rounded-lg border border-[var(--border)] text-xs">
                {(["diario", "semanal", "mensal"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-2.5 py-1.5 font-semibold transition-colors ${
                      effectiveGranularity === g
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {g === "diario" ? "Diário" : g === "semanal" ? "Semanal" : "Mensal"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {followerChartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-[var(--muted-foreground)]">
              Sem dados no período selecionado
            </div>
          ) : (effectiveGranularity === "semanal" && (!weeklyData || weeklyData.length === 0)) ||
              (effectiveGranularity === "diario" && (!dailyData || dailyData.length === 0)) ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                Dados {effectiveGranularity === "diario" ? "diários" : "semanais"} disponíveis apenas para os últimos 90 dias
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={followerChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="followerBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: effectiveGranularity === "semanal" ? 9 : 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                {/* Left Y: gains */}
                <YAxis
                  yAxisId="gains"
                  orientation="left"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  domain={[0, Math.ceil(gainMax * 1.3)]}
                />
                {/* Right Y: total */}
                <YAxis
                  yAxisId="total"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  domain={[Math.floor(followerMax * 0.92), Math.ceil(followerMax * 1.02)]}
                />
                <Tooltip
                  content={<CustomTooltip valueLabel="Novos seguidores" secondaryLabel="Total" />}
                  cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
                />
                <Bar
                  yAxisId="gains"
                  dataKey="gains"
                  fill="url(#followerBarGrad)"
                  radius={[6, 6, 0, 0]}
                  name="Novos seguidores"
                />
                <Line
                  yAxisId="total"
                  type="monotone"
                  dataKey="followersTotal"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--primary)" }}
                  name="Total"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Organic Performance (tabbed) ── */}
        <OrganicPerformanceSection data={evolutionData} periodData={monthly} />

        {/* ── Demographics ── */}
        {demographics && (generoData.length > 0 || faixaEtariaData.length > 0) && (
          <div>
            <SectionHeader sub="Audiência" title="Gênero e Faixa Etária" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Gender pie */}
              {generoData.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-[var(--primary)]" />
                    <p className="text-base font-bold text-[var(--foreground)]">Gênero</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={generoData}
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={1}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const pct = ((value / totalGenero) * 100).toFixed(1);
                            return (
                              <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                                {pct}%
                              </text>
                            );
                          }}
                          labelLine={false}
                        >
                          {generoData.map((entry, i) => (
                            <Cell key={i} fill={GENDER_COLORS[entry.key as keyof typeof GENDER_COLORS] ?? "#cbd5e1"} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${fmtFull(value)} (${((value / totalGenero) * 100).toFixed(1)}%)`, ""]}
                          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10, fontSize: 12, color: "#fafafa" }}
                          labelStyle={{ color: "#a1a1aa", fontWeight: 600, marginBottom: 2 }}
                          itemStyle={{ color: "#fafafa" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {generoData.map((entry) => (
                        <div key={entry.key} className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ background: GENDER_COLORS[entry.key as keyof typeof GENDER_COLORS] ?? "#cbd5e1" }}
                            />
                            <span className="text-xs text-[var(--muted-foreground)]">{entry.name}</span>
                          </div>
                          <p className="pl-4 text-sm font-bold text-[var(--foreground)]">{fmtFull(entry.value)}</p>
                          <p className="pl-4 text-[10px] text-[var(--muted-foreground)]">{((entry.value / totalGenero) * 100).toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Age bar — vertical bars */}
              {faixaEtariaData.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-[var(--primary)]" />
                    <p className="text-base font-bold text-[var(--foreground)]">Faixa Etária</p>
                  </div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={faixaEtariaData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.3} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        label={{ value: "Seguidores", angle: -90, position: "insideLeft", offset: 16, style: { fontSize: 9, fill: "var(--muted-foreground)" } }}
                      />
                      <Tooltip
                        formatter={(v: number) => [fmtFull(v), "Seguidores"]}
                        cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" }}
                        labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 2 }}
                      />
                      <Bar dataKey="value" fill="url(#ageGrad)" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        <LabelList dataKey="value" position="top" formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} style={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Cities */}
            {demographics.cidades && demographics.cidades.length > 0 && (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[var(--foreground)]">Seguidores por Cidade</p>
                  </div>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {demographics.cidades.map(({ cidade, seguidores }) => (
                    <div key={cidade} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--muted)]/20">
                      <span className="text-xs text-[var(--foreground)]">{cidade}</span>
                      <span className="text-xs font-bold text-[var(--foreground)]">{fmtFull(seguidores)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}


        {/* ── Resumo das publicações do período ── */}
        {(postsLoading || (postsPeriod?.publicacoesTotal ?? 0) > 0) && (
          <div>
            <SectionHeader sub="Publicações · Orgânico" title="Resumo das publicações do período" />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Desempenho acumulado dos conteúdos publicados no período selecionado.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(() => {
                const pubs = postsPeriod?.publicacoesTotal ?? 0;
                const alcancePosts = postsPeriod?.alcancePostsTotal ?? 0;
                const views = postsPeriod?.visualizacoesTotal ?? 0;
                const interacoes = postsPeriod?.interacoesTotaisTotal ?? 0;
                const taxaInteracao = alcancePosts > 0 ? (interacoes / alcancePosts) * 100 : 0;
                const mediaAlcance = pubs > 0 ? alcancePosts / pubs : 0;
                const loading = postsLoading;
                const val = (n: number) => loading ? "…" : fmt(n);
                return (
                  <>
                    <KpiCard
                      icon={<Layers className="h-4 w-4" />}
                      label="Publicações"
                      value={val(pubs)}
                      sub={periodoLabel ?? "No período"}
                    />
                    <KpiCard
                      icon={<Eye className="h-4 w-4" />}
                      label="Alcance acumulado"
                      value={val(alcancePosts)}
                      sub="Soma do alcance individual por post"
                    />
                    <KpiCard
                      icon={<Film className="h-4 w-4" />}
                      label="Visualizações"
                      value={val(views)}
                      sub="Soma de views (Reels)"
                    />
                    <KpiCard
                      icon={<ThumbsUp className="h-4 w-4" />}
                      label="Interações totais"
                      value={val(interacoes)}
                      sub="Curtidas + coment. + salvos + comp."
                    />
                    <KpiCard
                      icon={<Zap className="h-4 w-4" />}
                      label="Taxa de interação"
                      value={loading ? "…" : fmtPct(taxaInteracao)}
                      sub="Interações / alcance acumulado"
                    />
                    <KpiCard
                      icon={<BarChart2 className="h-4 w-4" />}
                      label="Média de alcance"
                      value={loading ? "…" : fmt(Math.round(mediaAlcance))}
                      sub="Alcance médio por publicação"
                    />
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Top Reels ── */}
        {reels.length > 0 && (
          <div>
            <SectionHeader sub="Orgânico · Top Reels por alcance" title="Melhores Reels" />

            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
              {(() => {
                const totalInterPeriod = postsPeriod?.interacoesTotaisTotal ?? allPosts.reduce((s, p) => s + p.curtidas + p.comentarios + p.salvos + p.compartilhamentos, 0);
                return (
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Publicação
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                          Visualizações
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Curtidas
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Coment.
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Salvos
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          <Share2 className="h-3 w-3 inline-block" />
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Interações
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                          Peso
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {reels.map((post, idx) => {
                        const interacoes = post.curtidas + post.comentarios + post.salvos + post.compartilhamentos;
                        const peso = totalInterPeriod > 0 ? (interacoes / totalInterPeriod) * 100 : 0;
                        return (
                          <tr
                            key={post.id}
                            className={`cursor-pointer transition-colors hover:bg-[var(--primary)]/5 ${idx % 2 === 0 ? "" : "bg-[var(--muted)]/5"}`}
                            onClick={() => setSelectedPost(post)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--muted)]/40">
                                  {post.thumbnailUrl ? (
                                    <img
                                      src={post.thumbnailUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <ImageIcon className="h-5 w-5 text-[var(--muted-foreground)]/40" />
                                    </div>
                                  )}
                                  <div className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-extrabold text-white">
                                    {idx + 1}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <MediaBadge type={post.mediaType} />
                                  </div>
                                  <p className="truncate text-xs text-[var(--foreground)] max-w-[200px]" title={post.caption}>
                                    {post.caption || <span className="text-[var(--muted-foreground)]">(sem legenda)</span>}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{fmtDate(post.timestamp)}</p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]/40" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-bold text-[var(--primary)]">
                                {fmt(post.videoViews ?? post.alcance)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.curtidas)}</td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.comentarios)}</td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.salvos)}</td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.compartilhamentos)}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--foreground)]">{fmt(interacoes)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--primary)]">
                                {fmtPct(peso)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <p className="mt-2 text-right text-[11px] text-[var(--muted-foreground)]">
              Clique em um Reel para ver detalhes completos
            </p>
          </div>
        )}

        {/* ── Top Posts (fotos & carrossel) ── */}
        {nonReels.length > 0 && (
          <div>
            <SectionHeader sub="Orgânico · Fotos e Carrossel por alcance" title="Melhores Posts" />

            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
              {(() => {
                const totalInterPeriod = postsPeriod?.interacoesTotaisTotal ?? allPosts.reduce((s, p) => s + p.curtidas + p.comentarios + p.salvos + p.compartilhamentos, 0);
                return (
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Publicação
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                          Alcance
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Curtidas
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Coment.
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Salvos
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          <Share2 className="h-3 w-3 inline-block" />
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Interações
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                          Peso
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {nonReels.map((post, idx) => {
                        const interacoes = post.curtidas + post.comentarios + post.salvos + post.compartilhamentos;
                        const peso = totalInterPeriod > 0 ? (interacoes / totalInterPeriod) * 100 : 0;
                        return (
                          <tr
                            key={post.id}
                            className={`cursor-pointer transition-colors hover:bg-[var(--primary)]/5 ${idx % 2 === 0 ? "" : "bg-[var(--muted)]/5"}`}
                            onClick={() => setSelectedPost(post)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--muted)]/40">
                                  {post.thumbnailUrl ? (
                                    <img
                                      src={post.thumbnailUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <ImageIcon className="h-5 w-5 text-[var(--muted-foreground)]/40" />
                                    </div>
                                  )}
                                  <div className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-extrabold text-white">
                                    {idx + 1}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <MediaBadge type={post.mediaType} />
                                  </div>
                                  <p className="truncate text-xs text-[var(--foreground)] max-w-[200px]" title={post.caption}>
                                    {post.caption || <span className="text-[var(--muted-foreground)]">(sem legenda)</span>}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{fmtDate(post.timestamp)}</p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]/40" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-bold text-[var(--primary)]">
                                {fmt(post.alcance)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.curtidas)}</td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.comentarios)}</td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.salvos)}</td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.compartilhamentos)}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--foreground)]">{fmt(interacoes)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--primary)]">
                                {fmtPct(peso)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <p className="mt-2 text-right text-[11px] text-[var(--muted-foreground)]">
              Clique em um post para ver detalhes completos
            </p>
          </div>
        )}

        {reels.length === 0 && nonReels.length === 0 && allPosts.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Nenhuma publicação encontrada no período selecionado.</p>
          </div>
        )}

        {allPosts.length === 0 && postsLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-[var(--muted)]/40" />
            ))}
          </div>
        )}

        {allPosts.length === 0 && !postsLoading && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Nenhuma publicação encontrada no período selecionado.</p>
          </div>
        )}
      </div>
    </>
  );
}
