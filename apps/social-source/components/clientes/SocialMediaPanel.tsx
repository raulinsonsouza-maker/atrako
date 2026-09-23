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
} from "recharts";
import {
  Users, Heart, Eye, TrendingUp, Instagram, ImageIcon,
  MessageCircle, ThumbsUp, X, ChevronRight,
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
}

interface MonthRow {
  mes: string;
  label: string;
  alcance: number;
  engajamento: number;
  novosSeguidores: number;
  followersTotal: number;
}

interface WeekRow {
  semana: string;
  label: string;
  gains: number;
  followersTotal: number;
}

interface Demographics {
  genero: { F: number; M: number; U: number };
  faixaEtaria: Record<string, number>;
  cidades: Array<{ cidade: string; seguidores: number }>;
}

interface SocialMediaData {
  configured: boolean;
  error?: string;
  periodoLabel?: string;
  profile?: { nome: string; followersTotal: number };
  period?: {
    alcanceTotal: number;
    engajamentoTotal: number;
    novosSeguidores: number;
    taxaEngajamento: number;
    curtidasTotal: number;
    comentariosTotal: number;
  };
  monthly?: MonthRow[];
  weeklyData?: WeekRow[] | null;
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
            {post.mediaType === "VIDEO" ? "Vídeo" : post.mediaType === "CAROUSEL_ALBUM" ? "Carrossel" : "Imagem"}
          </div>
        </div>

        {/* Info */}
        <div className="p-5 space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: "Alcance", value: fmt(post.alcance) },
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

// ── Gender/Age colors ──────────────────────────────────────────────────────
const GENDER_COLORS = { F: "#ff6a00", M: "#3b82f6", U: "#94a3b8" };
const GENDER_LABELS = { F: "Feminino", M: "Masculino", U: "Não especificado" };
const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

// ── Main component ─────────────────────────────────────────────────────────

export function SocialMediaPanel({ clienteId, dateFilter }: Props) {
  const [granularity, setGranularity] = React.useState<"mensal" | "semanal">("mensal");
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);

  // Auto-switch granularity based on period
  React.useEffect(() => {
    const p = dateFilter.periodo ?? "";
    const isLong = p === "ytd" || p === "365d" || p === "semestreAtual" || p === "anual";
    setGranularity(isLong ? "mensal" : "semanal");
  }, [dateFilter.periodo, dateFilter.dataInicio, dateFilter.dataFim]);

  const params = new URLSearchParams();
  if (dateFilter.dataInicio) params.set("dataInicio", dateFilter.dataInicio);
  if (dateFilter.dataFim) params.set("dataFim", dateFilter.dataFim);
  params.set("granularity", granularity);

  const { data, isLoading, error } = useQuery<SocialMediaData>({
    queryKey: ["social-media", clienteId, dateFilter.dataInicio, dateFilter.dataFim, granularity],
    queryFn: async () => {
      const r = await fetch(`/api/clientes/${clienteId}/social-media?${params}`);
      if (!r.ok) throw new Error("Erro ao carregar dados de Social Media");
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
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

  const { profile, period, monthly, weeklyData, topPosts, demographics, periodoLabel } = data;

  // Followers chart data
  const followerChartData = granularity === "semanal" && weeklyData && weeklyData.length > 0
    ? weeklyData.map((w) => ({ label: w.label, gains: w.gains, followersTotal: w.followersTotal }))
    : (monthly ?? []).map((m) => ({ label: m.label, gains: m.novosSeguidores, followersTotal: m.followersTotal }));

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

  return (
    <>
      {/* Post preview modal */}
      {selectedPost && <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />}

      <div className="space-y-10">

        {/* ── KPI row (6 cards) ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Seguidores"
            value={fmt(profile?.followersTotal ?? 0)}
            sub="Total atual"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Novos seguidores"
            value={fmt(period?.novosSeguidores ?? 0)}
            sub={periodoLabel ? "No período" : "No período (12 meses)"}
          />
          <KpiCard
            icon={<Heart className="h-4 w-4" />}
            label="Taxa de engajamento"
            value={fmtPct(period?.taxaEngajamento ?? 0)}
            sub="Interações / alcance"
          />
          <KpiCard
            icon={<Eye className="h-4 w-4" />}
            label="Alcance total"
            value={fmt(period?.alcanceTotal ?? 0)}
            sub={periodoLabel ?? "Últimos 12 meses"}
          />
          <KpiCard
            icon={<ThumbsUp className="h-4 w-4" />}
            label="Curtidas"
            value={fmt(period?.curtidasTotal ?? 0)}
            sub="Top 10 posts"
          />
          <KpiCard
            icon={<MessageCircle className="h-4 w-4" />}
            label="Comentários"
            value={fmt(period?.comentariosTotal ?? 0)}
            sub="Top 10 posts"
          />
        </div>

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
            {/* Granularity toggle */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] p-1">
              {(["mensal", "semanal"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all ${
                    granularity === g
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60"
                  }`}
                >
                  {g === "mensal" ? "Mensal" : "Semanal"}
                </button>
              ))}
            </div>
          </div>

          {followerChartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-[var(--muted-foreground)]">
              Sem dados no período selecionado
            </div>
          ) : granularity === "semanal" && (!weeklyData || weeklyData.length === 0) ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                Dados semanais disponíveis apenas para os últimos 90 dias
              </p>
              <button
                onClick={() => setGranularity("mensal")}
                className="text-xs text-[var(--primary)] underline underline-offset-2"
              >
                Ver visão mensal
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={followerChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
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
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  name="Novos seguidores"
                />
                <Line
                  yAxisId="total"
                  type="monotone"
                  dataKey="followersTotal"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name="Total"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Mini charts: Engajamento + Alcance ── */}
        <div>
          <SectionHeader sub="Evolução mensal" title="Performance orgânica" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MiniChart
              data={monthly}
              dataKey="engajamento"
              title="Engajamento total"
              sub="Interações"
              valueLabel="Interações"
            />
            <MiniChart
              data={monthly}
              dataKey="alcance"
              title="Alcance das publicações"
              sub="Alcance"
              valueLabel="Alcance"
              color="#f97316"
            />
          </div>
        </div>

        {/* ── Demographics ── */}
        {demographics && (generoData.length > 0 || faixaEtariaData.length > 0) && (
          <div>
            <SectionHeader sub="Audiência" title="Gênero e Faixa Etária" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Gender pie */}
              {generoData.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Distribuição</p>
                  <p className="mb-3 text-base font-bold text-[var(--foreground)]">Gênero</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={generoData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={72}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {generoData.map((entry, i) => (
                            <Cell key={i} fill={GENDER_COLORS[entry.key as keyof typeof GENDER_COLORS] ?? "#cbd5e1"} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${fmtFull(value)} (${((value / totalGenero) * 100).toFixed(1)}%)`, ""]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {generoData.map((entry) => (
                        <div key={entry.key} className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: GENDER_COLORS[entry.key as keyof typeof GENDER_COLORS] ?? "#cbd5e1" }}
                          />
                          <span className="text-xs text-[var(--foreground)]">{entry.name}</span>
                          <span className="ml-auto text-xs font-bold text-[var(--foreground)]">
                            {((entry.value / totalGenero) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Age bar */}
              {faixaEtariaData.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Distribuição</p>
                  <p className="mb-3 text-base font-bold text-[var(--foreground)]">Faixa Etária</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={faixaEtariaData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        formatter={(v: number) => [fmtFull(v), "Seguidores"]}
                        cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
                      />
                      <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Cities */}
            {demographics.cidades && demographics.cidades.length > 0 && (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className="text-sm font-bold text-[var(--foreground)]">Seguidores por Cidade</p>
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

        {/* ── Top 10 posts by ALCANCE ── */}
        {topPosts && topPosts.length > 0 && (
          <div>
            <SectionHeader sub="Orgânico · Top 10 por alcance" title="Melhores posts" />
            <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[680px] text-sm">
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
                      Comentários
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                      Taxa Eng.
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Salvos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {topPosts.map((post, idx) => (
                    <tr
                      key={post.id}
                      className={`cursor-pointer transition-colors hover:bg-[var(--primary)]/5 ${idx % 2 === 0 ? "" : "bg-[var(--muted)]/5"}`}
                      onClick={() => setSelectedPost(post)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--muted)]/40 group-hover:ring-2">
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
                            {/* Rank badge */}
                            <div className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-extrabold text-white">
                              {idx + 1}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-[var(--foreground)] max-w-[220px]" title={post.caption}>
                              {post.caption || <span className="text-[var(--muted-foreground)]">(sem legenda)</span>}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{fmtDate(post.timestamp)}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]/40" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-[var(--primary)]">{fmt(post.alcance)}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.curtidas)}</td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.comentarios)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--primary)]">
                          {fmtPct(post.taxaEngajamento)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--foreground)]">{fmt(post.salvos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-right text-[11px] text-[var(--muted-foreground)]">
              Clique em um post para ver preview completo
            </p>
          </div>
        )}

        {topPosts && topPosts.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Nenhuma publicação encontrada no período selecionado.</p>
          </div>
        )}
      </div>
    </>
  );
}
