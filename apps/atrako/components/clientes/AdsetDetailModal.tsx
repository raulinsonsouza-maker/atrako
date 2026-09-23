"use client";

import React from "react";
import {
  X,
  Target,
  MapPin,
  Users,
  Calendar,
  DollarSign,
  Zap,
  Info,
  Settings2,
  TrendingUp,
  BarChart3,
  Smartphone,
  Globe,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Insight types ──────────────────────────────────────────────────────────────

interface DailyRow  { date: string; leads: number; spend: number; impressions: number; clicks: number }
interface DemoRow   { age: string; gender: string; leads: number; spend: number; impressions: number }
interface RegionRow { region: string; leads: number; spend: number; impressions: number }
interface DeviceRow { device: string; leads: number; spend: number; impressions: number }
interface PlatRow   { platform: string; leads: number; spend: number; impressions: number }

interface InsightsData {
  daily: DailyRow[];
  demo: DemoRow[];
  region: RegionRow[];
  device: DeviceRow[];
  platform: PlatRow[];
}

// ── Config types ───────────────────────────────────────────────────────────────

interface GeoLocation  { key?: string; name: string; country?: string; region?: string }
interface Audience     { id: string; name: string }
interface FlexSpec     { interests?: Audience[]; behaviors?: Audience[] }

interface Targeting {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    regions?: GeoLocation[];
    cities?: GeoLocation[];
    location_types?: string[];
  };
  custom_audiences?: Audience[];
  excluded_custom_audiences?: Audience[];
  flexible_spec?: FlexSpec[];
  exclusions?: { custom_audiences?: Audience[]; interests?: Audience[]; behaviors?: Audience[] };
  targeting_automation?: { advantage_audience?: number };
}

interface Campaign { name: string; objective?: string; status?: string }

export interface AdsetDetail {
  id: string; name: string; status?: string; effective_status?: string;
  optimization_goal?: string; billing_event?: string; bid_strategy?: string;
  bid_amount?: string; daily_budget?: string; lifetime_budget?: string;
  start_time?: string; end_time?: string; targeting?: Targeting;
  promoted_object?: { page_id?: string; pixel_id?: string; application_id?: string };
  campaign?: Campaign;
}

// ── Label maps ─────────────────────────────────────────────────────────────────

const OBJECTIVE_LABELS: Record<string, { label: string; color: string }> = {
  OUTCOME_LEADS:         { label: "Geração de Leads",        color: "bg-[var(--primary)]/20 text-[var(--primary)]" },
  OUTCOME_SALES:         { label: "Vendas",                   color: "bg-emerald-500/20 text-emerald-400" },
  OUTCOME_AWARENESS:     { label: "Reconhecimento",           color: "bg-violet-500/20 text-violet-400" },
  OUTCOME_ENGAGEMENT:    { label: "Engajamento",              color: "bg-sky-500/20 text-sky-400" },
  OUTCOME_TRAFFIC:       { label: "Tráfego",                  color: "bg-blue-500/20 text-blue-400" },
  OUTCOME_APP_PROMOTION: { label: "Promoção de App",          color: "bg-pink-500/20 text-pink-400" },
  LEAD_GENERATION:       { label: "Geração de Leads",        color: "bg-[var(--primary)]/20 text-[var(--primary)]" },
  CONVERSIONS:           { label: "Conversões",               color: "bg-emerald-500/20 text-emerald-400" },
  LINK_CLICKS:           { label: "Cliques no Link",         color: "bg-blue-500/20 text-blue-400" },
  BRAND_AWARENESS:       { label: "Reconhecimento de Marca", color: "bg-violet-500/20 text-violet-400" },
  REACH:                 { label: "Alcance",                  color: "bg-slate-500/20 text-slate-400" },
  VIDEO_VIEWS:           { label: "Visualizações de Vídeo",  color: "bg-sky-500/20 text-sky-400" },
  MESSAGES:              { label: "Mensagens",                color: "bg-sky-500/20 text-sky-300" },
  PAGE_LIKES:            { label: "Curtidas na Página",      color: "bg-blue-500/20 text-blue-400" },
};

const OPT_GOAL_LABELS: Record<string, string> = {
  LEAD_GENERATION: "Leads", OFFSITE_CONVERSIONS: "Conversões",
  LINK_CLICKS: "Cliques no Link", IMPRESSIONS: "Impressões", REACH: "Alcance",
  LANDING_PAGE_VIEWS: "Visualizações da Página de Destino", VALUE: "Valor de Compra",
  PURCHASE_ROAS: "ROAS de Compra", REPLIES: "Respostas", CONVERSATIONS: "Conversas",
  POST_ENGAGEMENT: "Engajamento com Post", VIDEO_VIEWS: "Visualizações de Vídeo",
  THRUPLAY: "ThruPlay (Vídeo)", APP_INSTALLS: "Instalações de App",
  QUALITY_LEAD: "Leads Qualificados", ENGAGED_USERS: "Usuários Engajados", SUBSCRIBERS: "Inscrições",
};

const BID_STRATEGY_LABELS: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP:  "Menor custo (sem limite)",
  COST_CAP:                 "Meta de custo",
  LOWEST_COST_WITH_BID_CAP: "Lance máximo",
  TARGET_COST:              "Custo alvo",
  MINIMUM_ROAS:             "ROAS mínimo",
};

const BILLING_EVENT_LABELS: Record<string, string> = {
  IMPRESSIONS: "Impressões (CPM)", LINK_CLICKS: "Cliques no link (CPC)",
  APP_INSTALLS: "Instalações de app", THRUPLAY: "ThruPlay", NONE: "—",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:   "text-emerald-400 bg-emerald-400/10",
  PAUSED:   "text-amber-400 bg-amber-400/10",
  DELETED:  "text-red-400 bg-red-400/10",
  ARCHIVED: "text-slate-400 bg-slate-400/10",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo", PAUSED: "Pausado", DELETED: "Excluído", ARCHIVED: "Arquivado",
};

const GENDER_LABELS: Record<number, string> = { 1: "Masculino", 2: "Feminino" };

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Mobile", desktop: "Desktop", connected_tv: "Smart TV",
  tablet: "Tablet", unknown: "Outro",
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram",
  audience_network: "Audience Network", messenger: "Messenger",
  an_classic: "Audience Network", msite: "Facebook Mobile",
};

const AGE_BANDS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtBrl(cents: string | number | undefined) {
  if (!cents) return "—";
  const v = Number(cents) / 100;
  return "R$\u00a0" + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBrlNum(v: number) {
  return "R$\u00a0" + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDay(iso: string) {
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function label(map: Record<string, string>, key?: string, fallback?: string) {
  if (!key) return fallback ?? "—";
  return map[key] ?? (fallback ?? key);
}

// ── Recharts tooltip style ─────────────────────────────────────────────────────

const TOOLTIP = {
  contentStyle: {
    backgroundColor: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 2 },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

// ── Shared sub-components ──────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--primary)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label: lbl, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">{lbl}</span>
      <span className={`text-[12px] font-medium text-right ${accent ? "text-[var(--foreground)]" : "text-[var(--foreground)]/80"}`}>{value}</span>
    </div>
  );
}

function Pill({ text, color }: { text: string; color?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${color ?? "bg-white/[0.08] text-white/60"}`}>
      {text}
    </span>
  );
}

function ChipList({ items, empty = "Nenhum" }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-[12px] text-white/30 italic">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map((t, i) => (
        <span key={i} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-[var(--foreground)]/70">
          {t}
        </span>
      ))}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-[var(--primary)] text-[var(--primary)]"
          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function KpiCard({ title, value, sub }: { title: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 flex-1 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.20em] text-[var(--muted-foreground)] truncate">{title}</p>
      <p className="text-base font-extrabold text-[var(--foreground)] mt-1 leading-none truncate">{value}</p>
      {sub && <p className="text-[10px] text-[var(--muted-foreground)] mt-1 truncate">{sub}</p>}
    </div>
  );
}

function RankedRow({ lbl, value, max, right }: { lbl: string; value: number; max: number; right: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-[11px] text-[var(--foreground)]/70 truncate shrink-0">{lbl}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-[var(--foreground)] w-14 text-right shrink-0">{right}</span>
    </div>
  );
}

// ── Performance tab ────────────────────────────────────────────────────────────

function PerfTab({ insights }: { insights: InsightsData }) {
  const totalLeads  = insights.daily.reduce((s, d) => s + d.leads, 0);
  const totalSpend  = insights.daily.reduce((s, d) => s + d.spend, 0);
  const cpl         = totalLeads > 0 ? totalSpend / totalLeads : null;

  const hasLeads = totalLeads > 0;

  // Age+gender pivot
  const demoByAge = AGE_BANDS.map((age) => ({
    age,
    Homem:  insights.demo.find((d) => d.age === age && d.gender === "male")?.leads  ?? 0,
    Mulher: insights.demo.find((d) => d.age === age && d.gender === "female")?.leads ?? 0,
  })).filter((d) => d.Homem > 0 || d.Mulher > 0);

  const hasDemoLeads = demoByAge.some((d) => d.Homem > 0 || d.Mulher > 0);

  // Region metric: leads if available, else spend
  const regionMetric = (r: RegionRow) => hasLeads ? r.leads : r.spend;
  const regionMax = Math.max(1, ...insights.region.map(regionMetric));
  const regionFmt = (r: RegionRow) => hasLeads
    ? `${r.leads} lead${r.leads !== 1 ? "s" : ""}`
    : fmtBrlNum(r.spend);

  // Device
  const deviceMax = Math.max(1, ...insights.device.map((d) => d.spend));

  // Platform
  const platMax = Math.max(1, ...insights.platform.map((d) => d.spend));

  const noData = insights.daily.length === 0 && insights.demo.length === 0 && insights.region.length === 0;

  if (noData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <BarChart3 className="w-8 h-8 text-[var(--muted-foreground)] opacity-30" />
        <p className="text-sm font-medium text-[var(--foreground)]">Sem dados no período</p>
        <p className="text-[12px] text-[var(--muted-foreground)] max-w-[260px]">
          Nenhuma métrica encontrada para este conjunto no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* KPI cards */}
      <div className="flex gap-2">
        <KpiCard
          title="Leads"
          value={totalLeads.toLocaleString("pt-BR")}
          sub={cpl != null ? `CPL: ${fmtBrlNum(cpl)}` : undefined}
        />
        <KpiCard
          title="Investido"
          value={fmtBrlNum(totalSpend)}
          sub={totalLeads > 0 ? `${totalLeads} resultado${totalLeads !== 1 ? "s" : ""}` : undefined}
        />
      </div>

      {/* Daily line chart */}
      {insights.daily.length > 1 && (
        <Section icon={TrendingUp} title="Leads por Dia">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={insights.daily} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...TOOLTIP}
                labelFormatter={(v) => fmtDay(String(v))}
                formatter={(v: number) => [v, "Leads"]}
              />
              <Line
                type="monotone"
                dataKey="leads"
                stroke="#ff6a00"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#ff6a00" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Age + gender */}
      {demoByAge.length > 0 && (
        <Section icon={Users} title="Faixa Etária e Gênero">
          {hasDemoLeads ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={demoByAge} margin={{ top: 4, right: 8, bottom: 0, left: -28 }} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...TOOLTIP}
                  labelFormatter={(v) => `Faixa ${v}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.55)", paddingTop: 6 }}
                  iconType="circle"
                  iconSize={7}
                />
                <Bar dataKey="Homem"  stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Mulher" stackId="a" fill="#14b8a6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[12px] text-white/30 italic">
              Dados demográficos de leads indisponíveis para este conjunto.
            </p>
          )}
        </Section>
      )}

      {/* Regions */}
      {insights.region.length > 0 && (
        <Section icon={MapPin} title="Regiões">
          <div className="space-y-2">
            {insights.region.map((r) => (
              <RankedRow
                key={r.region}
                lbl={r.region}
                value={regionMetric(r)}
                max={regionMax}
                right={regionFmt(r)}
              />
            ))}
          </div>
          {!hasLeads && (
            <p className="text-[10px] text-white/25 italic mt-1">Exibindo investimento (sem leads registrados)</p>
          )}
        </Section>
      )}

      {/* Devices */}
      {insights.device.length > 0 && (
        <Section icon={Smartphone} title="Dispositivos">
          <div className="space-y-2">
            {insights.device
              .sort((a, b) => b.spend - a.spend)
              .map((d) => (
                <RankedRow
                  key={d.device}
                  lbl={DEVICE_LABEL[d.device] ?? d.device}
                  value={d.spend}
                  max={deviceMax}
                  right={fmtBrlNum(d.spend)}
                />
              ))}
          </div>
        </Section>
      )}

      {/* Platforms */}
      {insights.platform.length > 0 && (
        <Section icon={Globe} title="Plataformas">
          <div className="space-y-2">
            {insights.platform.map((p) => (
              <RankedRow
                key={p.platform}
                lbl={PLATFORM_LABEL[p.platform] ?? p.platform}
                value={p.spend}
                max={platMax}
                right={fmtBrlNum(p.spend)}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdsetDetailModal({
  adsetId,
  adsetName,
  clienteId,
  onClose,
  dateFrom,
  dateTo,
}: {
  adsetId: string;
  adsetName: string;
  clienteId: string;
  onClose: () => void;
  dateFrom?: string;
  dateTo?: string;
}) {
  const [tab, setTab] = React.useState<"config" | "perf">("config");

  // Config data
  const [data, setData] = React.useState<AdsetDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Insights data (lazy)
  const [insights, setInsights] = React.useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = React.useState(false);
  const [insightsError, setInsightsError] = React.useState<string | null>(null);
  const insightsFetched = React.useRef(false);

  // Fetch config on mount
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/clientes/${clienteId}/meta-adset/${adsetId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError("Erro ao carregar detalhes"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [adsetId, clienteId]);

  // Fetch insights lazily when perf tab is first selected
  React.useEffect(() => {
    if (tab !== "perf" || insightsFetched.current) return;
    insightsFetched.current = true;
    setInsightsLoading(true);
    setInsightsError(null);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo)   params.set("dateTo", dateTo);
    fetch(`/api/clientes/${clienteId}/meta-adset/${adsetId}/insights?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setInsightsError(d.error);
        else setInsights(d);
        setInsightsLoading(false);
      })
      .catch(() => { setInsightsError("Erro ao carregar dados"); setInsightsLoading(false); });
  }, [tab, adsetId, clienteId, dateFrom, dateTo]);

  // Escape key
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Config derived values
  const t = data?.targeting;
  const isAdvantage = (t?.targeting_automation?.advantage_audience ?? 0) === 1;
  const regions    = (t?.geo_locations?.regions ?? []).map((r) => r.name);
  const cities     = (t?.geo_locations?.cities  ?? []).map((c) => c.name + (c.region ? `, ${c.region}` : ""));
  const countries  = (t?.geo_locations?.countries ?? []);
  const locationTypes = t?.geo_locations?.location_types ?? [];
  const genders    = t?.genders ?? [];
  const genderLabel = genders.length === 0 || genders.length === 2
    ? "Todos"
    : genders.map((g) => GENDER_LABELS[g] ?? g).join(", ");
  const ageMin  = t?.age_min ?? 18;
  const ageMax  = t?.age_max;
  const ageLabel = ageMax ? `${ageMin}–${ageMax}` : `${ageMin}+`;
  const inclAudiences = (t?.custom_audiences ?? []).map((a) => a.name);
  const exclAudiences = (t?.excluded_custom_audiences ?? []).map((a) => a.name);
  const interests = (t?.flexible_spec ?? []).flatMap((s) => (s.interests ?? []).map((i) => i.name));
  const behaviors = (t?.flexible_spec ?? []).flatMap((s) => (s.behaviors ?? []).map((b) => b.name));
  const objInfo   = OBJECTIVE_LABELS[data?.campaign?.objective ?? ""] ?? null;
  const effStatus = data?.effective_status ?? data?.status;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto h-full w-full max-w-[480px] bg-[var(--card)] border-l border-[var(--border)] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Target className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Conjunto de Anúncios</p>
            <h2 className="text-[14px] font-bold text-[var(--foreground)] leading-snug mt-0.5 line-clamp-2">{adsetName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] flex-shrink-0 px-2">
          <TabBtn active={tab === "config"} onClick={() => setTab("config")} icon={Settings2}>
            Configurações
          </TabBtn>
          <TabBtn active={tab === "perf"} onClick={() => setTab("perf")} icon={BarChart3}>
            Desempenho
          </TabBtn>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* ── CONFIGURAÇÕES tab ── */}
          {tab === "config" && (
            <>
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
                  <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Buscando dados na Meta API…</span>
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <Info className="w-8 h-8 text-red-400 opacity-50" />
                  <p className="text-sm font-medium text-[var(--foreground)]">Erro ao carregar detalhes</p>
                  <p className="text-[12px] text-[var(--muted-foreground)] max-w-[280px]">{error}</p>
                </div>
              )}

              {!loading && data && (
                <>
                  <Section icon={TrendingUp} title="Campanha">
                    <Row label="Nome" value={data.campaign?.name ?? "—"} accent />
                    {objInfo && (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[var(--muted-foreground)]">Objetivo</span>
                        <Pill text={objInfo.label} color={objInfo.color} />
                      </div>
                    )}
                    {data.campaign?.status && (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[var(--muted-foreground)]">Status</span>
                        <Pill
                          text={STATUS_LABELS[data.campaign.status] ?? data.campaign.status}
                          color={STATUS_STYLE[data.campaign.status] ?? "bg-white/[0.08] text-white/60"}
                        />
                      </div>
                    )}
                  </Section>

                  <Section icon={Target} title="Conjunto">
                    {effStatus && (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[var(--muted-foreground)]">Status</span>
                        <Pill
                          text={STATUS_LABELS[effStatus] ?? effStatus}
                          color={STATUS_STYLE[effStatus] ?? "bg-white/[0.08] text-white/60"}
                        />
                      </div>
                    )}
                    {data.optimization_goal && (
                      <Row label="Meta de otimização" value={label(OPT_GOAL_LABELS, data.optimization_goal)} accent />
                    )}
                    {data.billing_event && (
                      <Row label="Cobrança" value={label(BILLING_EVENT_LABELS, data.billing_event)} />
                    )}
                    {data.promoted_object?.pixel_id && (
                      <Row label="Pixel" value={`ID: ${data.promoted_object.pixel_id}`} />
                    )}
                  </Section>

                  <Section icon={DollarSign} title="Orçamento e Lance">
                    {data.daily_budget && (
                      <Row label="Orçamento diário" value={fmtBrl(data.daily_budget)} accent />
                    )}
                    {data.lifetime_budget && (
                      <Row label="Orçamento total" value={fmtBrl(data.lifetime_budget)} accent />
                    )}
                    {data.bid_strategy && (
                      <Row label="Estratégia de lance" value={label(BID_STRATEGY_LABELS, data.bid_strategy)} />
                    )}
                    {data.bid_amount && Number(data.bid_amount) > 0 && (
                      <Row label="Valor do lance" value={fmtBrl(data.bid_amount)} />
                    )}
                    {!data.daily_budget && !data.lifetime_budget && (
                      <p className="text-[12px] text-white/30 italic">Orçamento definido na campanha</p>
                    )}
                  </Section>

                  <Section icon={Calendar} title="Período">
                    <Row label="Início" value={fmtDate(data.start_time)} accent />
                    <Row
                      label="Término"
                      value={data.end_time ? fmtDate(data.end_time) : <span className="text-white/30 italic">Sem data de encerramento</span>}
                    />
                  </Section>

                  <Section icon={Users} title="Público">
                    {isAdvantage ? (
                      <div className="flex items-center gap-2 rounded-xl bg-[var(--primary)]/8 border border-[var(--primary)]/20 px-3 py-2">
                        <Zap className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0" />
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--primary)]">Advantage+ Audience ativado</p>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            A Meta expande automaticamente o público para encontrar mais resultados.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2">
                        <Settings2 className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
                        <p className="text-[12px] text-[var(--muted-foreground)]">Segmentação manual (controles definidos)</p>
                      </div>
                    )}
                    <Row label="Faixa etária" value={ageLabel} accent />
                    <Row label="Gênero" value={genderLabel} />
                  </Section>

                  {(countries.length > 0 || regions.length > 0 || cities.length > 0) && (
                    <Section icon={MapPin} title="Localizações">
                      {countries.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Países</p>
                          <ChipList items={countries} />
                        </div>
                      )}
                      {regions.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Estados</p>
                          <ChipList items={regions} />
                        </div>
                      )}
                      {cities.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Cidades</p>
                          <ChipList items={cities} />
                        </div>
                      )}
                      {locationTypes.length > 0 && (
                        <Row
                          label="Tipo de presença"
                          value={locationTypes
                            .map((lt) => ({ home: "Moradores", recent: "Visitantes recentes", travel_in: "Viajando para" }[lt] ?? lt))
                            .join(", ")}
                        />
                      )}
                    </Section>
                  )}

                  {(inclAudiences.length > 0 || exclAudiences.length > 0) && (
                    <Section icon={Users} title="Públicos Personalizados">
                      {inclAudiences.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1.5">Incluir</p>
                          <ChipList items={inclAudiences} />
                        </div>
                      )}
                      {exclAudiences.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/70 mb-1.5">Excluir</p>
                          <ChipList items={exclAudiences} />
                        </div>
                      )}
                    </Section>
                  )}

                  {(interests.length > 0 || behaviors.length > 0) && (
                    <Section icon={Target} title="Interesses e Comportamentos">
                      {interests.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Interesses</p>
                          <ChipList items={interests} />
                        </div>
                      )}
                      {behaviors.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Comportamentos</p>
                          <ChipList items={behaviors} />
                        </div>
                      )}
                    </Section>
                  )}

                  <p className="text-center text-[10px] text-white/20 pb-2">ID do conjunto: {data.id}</p>
                </>
              )}
            </>
          )}

          {/* ── DESEMPENHO tab ── */}
          {tab === "perf" && (
            <>
              {insightsLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
                  <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Buscando métricas na Meta API…</span>
                </div>
              )}

              {!insightsLoading && insightsError && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <Info className="w-8 h-8 text-red-400 opacity-50" />
                  <p className="text-sm font-medium text-[var(--foreground)]">Erro ao carregar métricas</p>
                  <p className="text-[12px] text-[var(--muted-foreground)] max-w-[280px]">{insightsError}</p>
                </div>
              )}

              {!insightsLoading && insights && <PerfTab insights={insights} />}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
