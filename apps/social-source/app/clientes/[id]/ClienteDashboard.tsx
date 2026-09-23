"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DefaultPanel } from "@/components/clientes/DefaultPanel";
import { GoogleKeywordsPanel } from "@/components/clientes/GoogleKeywordsPanel";
import { AnalyticsGA4Section } from "@/components/clientes/AnalyticsGA4Section";
import { ImoveisPanel } from "@/components/clientes/ImoveisPanel";

import { CrmTab } from "@/components/clientes/CrmTab";
import { SocialMediaPanel } from "@/components/clientes/SocialMediaPanel";
import { HotelFazendaSaoJoaoPanel } from "@/components/clientes/HotelFazendaSaoJoaoPanel";
import { TertuliaPanel } from "@/components/clientes/TertuliaPanel";
import { VarellaMotosPanel } from "@/components/clientes/VarellaMotosPanel";
import { CampanhasPanel } from "@/components/clientes/CampanhasPanel";
import { GoogleCampanhasPanel } from "@/components/clientes/GoogleCampanhasPanel";
import { isHotelFazendaSaoJoao, isTertulia, isVarellaMotos, isMiguelImoveis, isDrFernandoGuena, isClinicaESpa, isDor, isGranarolo, isFlorien, isAcademyAmericana, isVitoBalducci, isKombucha, isBeBlueSchool, isSouIcarai, isImobClient } from "@/lib/clientProfiles";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal, BarChart3, Play, TrendingUp, X, Wallet, AlertTriangle, Zap, Target, Film, MousePointerClick, Eye, EyeOff, CheckCircle2, Circle, Trash2, Flag, Clock, ChevronDown, RefreshCw } from "lucide-react";
import { upgradeFbCdnImageUrl } from "@/lib/utils";

/* ─── data fetchers (unchanged) ─── */

async function fetchCliente(id: string) {
  const res = await fetch(`/api/clientes/${id}`);
  if (!res.ok) throw new Error("Cliente não encontrado");
  return res.json();
}

function formatRelativeTime(value: string | Date): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export type DateFilter = {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
};

function buildQueryParams(filter: DateFilter) {
  const params = new URLSearchParams();
  params.set("periodo", filter.periodo);
  if (filter.dataInicio) params.set("dataInicio", filter.dataInicio);
  if (filter.dataFim) params.set("dataFim", filter.dataFim);
  return params.toString();
}

async function fetchResumo(id: string, canal: "geral" | "meta" | "google", filter: DateFilter) {
  const params = new URLSearchParams(buildQueryParams(filter));
  params.set("canal", canal);
  const res = await fetch(`/api/clientes/${id}/resumo?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar resumo");
  return res.json();
}

async function fetchMidia(id: string, canal: string, filter: DateFilter, preset?: string, agrupamentoOverride?: string) {
  const params = buildQueryParams(filter);
  const autoAgrupamento = (preset === "ytd" || preset === "365d" || preset === "semestreAtual") ? "mensal" : "semanal";
  const agrupamento = agrupamentoOverride ?? autoAgrupamento;
  const res = await fetch(
    `/api/clientes/${id}/midia?canal=${canal}&agrupamento=${agrupamento}&${params}`
  );
  if (!res.ok) throw new Error("Falha ao carregar mídia");
  return res.json();
}

async function fetchFinanceiro(id: string, canal: "geral" | "meta" | "google") {
  const res = await fetch(`/api/clientes/${id}/financeiro?canal=${canal}`);
  if (!res.ok) throw new Error("Falha ao carregar financeiro");
  return res.json();
}

async function fetchPainelEspecial(
  id: string,
  canal: "geral" | "meta" | "google",
  filter: DateFilter,
  preset?: string,
  agrupamentoOverride?: string
) {
  const autoAgrupamento = (preset === "ytd" || preset === "365d" || preset === "semestreAtual") ? "mensal" : "semanal";
  const agrupamento = agrupamentoOverride ?? autoAgrupamento;
  const params = new URLSearchParams(buildQueryParams(filter));
  params.set("canal", canal);
  params.set("agrupamento", agrupamento);
  const res = await fetch(`/api/clientes/${id}/painel-especial?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar painel especial");
  return res.json();
}

async function fetchPainelTertulia(
  id: string,
  canal: "geral" | "meta" | "google",
  filter: DateFilter,
  preset?: string,
  agrupamentoOverride?: string
) {
  const autoAgrupamento = (preset === "ytd" || preset === "365d" || preset === "semestreAtual") ? "mensal" : "semanal";
  const agrupamento = agrupamentoOverride ?? autoAgrupamento;
  const params = new URLSearchParams(buildQueryParams(filter));
  params.set("canal", canal);
  params.set("agrupamento", agrupamento);
  const res = await fetch(`/api/clientes/${id}/painel-tertulia?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar painel da Tertúlia");
  return res.json();
}

async function fetchPainelVarella(
  id: string,
  canal: "geral" | "meta" | "google",
  filter: DateFilter,
  preset?: string,
  agrupamentoOverride?: string
) {
  const autoAgrupamento = (preset === "ytd" || preset === "365d" || preset === "semestreAtual") ? "mensal" : "semanal";
  const agrupamento = agrupamentoOverride ?? autoAgrupamento;
  const params = new URLSearchParams(buildQueryParams(filter));
  params.set("canal", canal);
  params.set("agrupamento", agrupamento);
  const res = await fetch(`/api/clientes/${id}/painel-varella?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar painel da Varella Motos");
  return res.json();
}

async function fetchMetaAds(clienteId: string, filter: DateFilter, live = false) {
  const params = new URLSearchParams(buildQueryParams(filter));
  params.set("clienteId", clienteId);
  if (live) params.set("live", "1");
  const res = await fetch(`/api/meta/ads?${params.toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: string }).error ?? "Falha ao carregar anúncios";
    throw new Error(msg);
  }
  return body;
}


async function fetchGoogleKeywords(id: string, filter: DateFilter) {
  const params = buildQueryParams(filter);
  const res = await fetch(`/api/clientes/${id}/google-keywords?${params}`);
  if (!res.ok) throw new Error("Falha ao carregar keywords Google Ads");
  return res.json();
}

async function fetchAnalytics(id: string, filter: DateFilter) {
  const params = buildQueryParams(filter);
  const res = await fetch(`/api/clientes/${id}/analytics?${params}`);
  if (!res.ok) throw new Error("Falha ao carregar analytics");
  return res.json();
}

/* ─── date helpers (unchanged) ─── */

type PresetPeriodo =
  | "hoje"
  | "ontem"
  | "7d"
  | "14d"
  | "30d"
  | "60d"
  | "90d"
  | "180d"
  | "365d"
  | "mesAtual"
  | "mesAnterior"
  | "trimestreAtual"
  | "semestreAtual"
  | "ytd"
  | "custom";

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value?: string) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDatePt(value?: string) {
  const date = fromDateInputValue(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateDiffInDays(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

function getDateFilterFromPreset(
  preset: PresetPeriodo,
  customInicio?: string,
  customFim?: string
): DateFilter & { label: string } {
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicio = new Date(fim);

  const make = (start: Date, end: Date, label: string): DateFilter & { label: string } => ({
    periodo: String(dateDiffInDays(start, end)),
    dataInicio: toDateInputValue(start),
    dataFim: toDateInputValue(end),
    label,
  });

  if (preset === "custom" && customInicio && customFim) {
    const [y1, m1, d1] = customInicio.split("-").map(Number);
    const [y2, m2, d2] = customFim.split("-").map(Number);
    if (y1 && m1 && d1 && y2 && m2 && d2) {
      const start = new Date(y1, m1 - 1, d1);
      const end = new Date(y2, m2 - 1, d2);
      if (start <= end) {
        return {
          ...make(start, end, "Personalizado"),
          label: `${formatDatePt(customInicio)} - ${formatDatePt(customFim)}`,
        };
      }
    }
  }

  switch (preset) {
    case "hoje": {
      return make(fim, fim, "Hoje");
    }
    case "ontem": {
      const ontem = new Date(fim);
      ontem.setDate(fim.getDate() - 1);
      return make(ontem, ontem, "Ontem");
    }
    case "7d":
    case "14d":
    case "30d":
    case "60d":
    case "90d":
    case "180d":
    case "365d": {
      const dias = parseInt(preset.replace("d", ""), 10);
      inicio.setDate(fim.getDate() - (dias - 1));
      return make(inicio, fim, `Últimos ${dias} dias`);
    }
    case "mesAtual": {
      const start = new Date(fim.getFullYear(), fim.getMonth(), 1);
      return make(start, fim, "Mês atual");
    }
    case "mesAnterior": {
      const start = new Date(fim.getFullYear(), fim.getMonth() - 1, 1);
      const end = new Date(fim.getFullYear(), fim.getMonth(), 0);
      return make(start, end, "Mês anterior");
    }
    case "trimestreAtual": {
      const quarterStartMonth = Math.floor(fim.getMonth() / 3) * 3;
      const start = new Date(fim.getFullYear(), quarterStartMonth, 1);
      return make(start, fim, "Trimestre atual");
    }
    case "semestreAtual": {
      const semesterStartMonth = fim.getMonth() < 6 ? 0 : 6;
      const start = new Date(fim.getFullYear(), semesterStartMonth, 1);
      return make(start, fim, "Semestre atual");
    }
    case "ytd": {
      const start = new Date(fim.getFullYear(), 0, 1);
      return make(start, fim, "Ano atual (YTD)");
    }
    default: {
      inicio.setDate(fim.getDate() - 89);
      return make(inicio, fim, "Últimos 90 dias");
    }
  }
}

/* ─── shared tooltip style ─── */

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

/* ─── section header helper ─── */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p> : null}
    </div>
  );
}

/* ─── main page ─── */

// Guard de sessão: o disparo global "1x/dia ao abrir o painel" roda uma única
// vez por carregamento da aba (a trava real é no servidor; isto só evita repetir
// a chamada a cada troca de cliente na mesma sessão).
let dailyGlobalSyncFired = false;

export function ClienteDashboard({ id, portalMode = false }: { id: string; portalMode?: boolean }) {
  const [canal, setCanal] = React.useState<"geral" | "meta" | "google" | "imoveis" | "crm">("geral");
  const [subView, setSubView] = React.useState<"dados" | "criativos" | "social-media">("dados");
  const [saldoVisible, setSaldoVisible] = React.useState(false);
  const [presetPeriodo, setPresetPeriodo] = React.useState<PresetPeriodo>("mesAtual");
  const [chartAgrupamento, setChartAgrupamento] = React.useState<"diario" | "semanal" | "mensal">("semanal");
  const [customInicio, setCustomInicio] = React.useState("");
  const [customFim, setCustomFim] = React.useState("");

  React.useEffect(() => {
    const stored = localStorage.getItem("inout-date-preset") as PresetPeriodo | null;
    if (stored) setPresetPeriodo(stored);
    const inicio = localStorage.getItem("inout-date-custom-inicio");
    if (inicio) setCustomInicio(inicio);
    const fim = localStorage.getItem("inout-date-custom-fim");
    if (fim) setCustomFim(fim);
  }, []);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() - 1, 1);
  });
  const filterRef = React.useRef<HTMLDivElement | null>(null);

  // ── Sync state ──
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "syncing" | "done" | "error">("idle");
  const [lastSyncedLabel, setLastSyncedLabel] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const triggerSync = React.useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background ?? false;
    if (syncStatus === "syncing") return;
    setSyncStatus("syncing");
    try {
      const url = `/api/clientes/${id}/sync${background ? "?background=1" : ""}`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as { skipped?: boolean }));
        if (data?.skipped) {
          // Dados já estavam frescos — nada a atualizar, volta ao estado neutro.
          setSyncStatus("idle");
          return;
        }
        setSyncStatus("done");
        setLastSyncedLabel(`agora mesmo`);
        await queryClient.invalidateQueries({ queryKey: ["resumo", id] });
        await queryClient.invalidateQueries({ queryKey: ["midia", id] });
        await queryClient.invalidateQueries({ queryKey: ["campanhas", id] });
      } else {
        // Em segundo plano não alarmamos o usuário (ex.: portal do cliente).
        setSyncStatus(background ? "idle" : "error");
      }
    } catch {
      setSyncStatus(background ? "idle" : "error");
    }
  }, [id, syncStatus, queryClient]);

  // Auto-sync em segundo plano ao abrir o cliente (uma vez por cliente).
  // O servidor decide se realmente sincroniza (só se os dados estiverem velhos),
  // então isso não trava a página nem martela as APIs.
  const autoSyncedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!id) return;
    if (autoSyncedRef.current === id) return;
    autoSyncedRef.current = id;
    void triggerSync({ background: true });
  }, [id, triggerSync]);

  // Disparo "1x por dia ao abrir o painel" (apenas admin): sincroniza TODAS as
  // contas + alertas em segundo plano. O servidor aplica a trava global (no
  // máximo 1x/dia), então isto é fire-and-forget e não trava a página. Roda uma
  // vez por sessão (guard de módulo) para não repetir a cada troca de cliente.
  React.useEffect(() => {
    if (portalMode) return;
    if (dailyGlobalSyncFired) return;
    dailyGlobalSyncFired = true;
    void fetch("/api/sync/daily-global", { method: "POST" }).catch(() => {});
  }, [portalMode]);

  React.useEffect(() => {
    localStorage.setItem("inout-date-preset", presetPeriodo);
    if (presetPeriodo === "custom") {
      localStorage.setItem("inout-date-custom-inicio", customInicio);
      localStorage.setItem("inout-date-custom-fim", customFim);
    }
  }, [presetPeriodo, customInicio, customFim]);

  const isLongPeriod = presetPeriodo === "ytd" || presetPeriodo === "365d" || presetPeriodo === "semestreAtual";
  React.useEffect(() => {
    if (isLongPeriod) {
      setChartAgrupamento("mensal");
    } else if (chartAgrupamento === "mensal") {
      setChartAgrupamento("semanal");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPeriodo]);

  const dateFilter = React.useMemo(
    () => getDateFilterFromPreset(presetPeriodo, customInicio, customFim),
    [presetPeriodo, customInicio, customFim]
  );

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!filterOpen) return;
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [filterOpen]);

  React.useEffect(() => {
    const end = fromDateInputValue(dateFilter.dataFim);
    if (end) {
      setVisibleMonth(new Date(end.getFullYear(), end.getMonth() - 1, 1));
    }
  }, [dateFilter.dataFim]);

  const leftMonth = visibleMonth;
  const rightMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const startSelected = fromDateInputValue(customInicio);
  const endSelected = fromDateInputValue(customFim);

  const topRangeLabelFull =
    presetPeriodo === "custom" && customInicio && customFim
      ? `Personalizado: ${formatDatePt(customInicio)} a ${formatDatePt(customFim)}`
      : `${dateFilter.label}: ${formatDatePt(dateFilter.dataInicio)} a ${formatDatePt(dateFilter.dataFim)}`;

  const topRangeLabelShort = dateFilter.label;

  const handleDayClick = (day: Date) => {
    const clicked = toDateInputValue(day);
    if (!startSelected || (startSelected && endSelected)) {
      setPresetPeriodo("custom");
      setCustomInicio(clicked);
      setCustomFim("");
      return;
    }
    if (day < startSelected) {
      setPresetPeriodo("custom");
      setCustomInicio(clicked);
      setCustomFim(toDateInputValue(startSelected));
      return;
    }
    setPresetPeriodo("custom");
    setCustomFim(clicked);
  };

  const isInRange = (day: Date) => {
    if (!startSelected || !endSelected) return false;
    return day >= startSelected && day <= endSelected;
  };

  const { data: cliente, isLoading: clienteLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => fetchCliente(id),
  });

  // Inicializa o rótulo "atualizado há…" a partir do último sync salvo,
  // a menos que já tenhamos sincronizado nesta sessão ("agora mesmo").
  React.useEffect(() => {
    if (!cliente?.ultimoSyncAt) return;
    setLastSyncedLabel((prev) => (prev ? prev : formatRelativeTime(cliente.ultimoSyncAt)));
  }, [cliente?.ultimoSyncAt]);

  // Controls the fullscreen loader: visible until first cliente data arrives
  const [loaderVisible, setLoaderVisible] = React.useState(true);
  const [loaderFading, setLoaderFading] = React.useState(false);
  React.useEffect(() => {
    if (!clienteLoading && cliente) {
      setLoaderFading(true);
      const t = setTimeout(() => setLoaderVisible(false), 450);
      return () => clearTimeout(t);
    }
  }, [clienteLoading, cliente]);
  const { data: resumo } = useQuery({
    queryKey: ["resumo", id, canal, dateFilter.periodo, dateFilter.dataInicio, dateFilter.dataFim],
    queryFn: () => fetchResumo(id, canal as "geral" | "meta" | "google", dateFilter),
    enabled: !!id && canal !== "imoveis" && canal !== "crm",
  });

  // Auto-sync when data is stale (last fato more than 24h behind today)
  const autoSyncFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (autoSyncFiredRef.current) return;
    const lastFatoDate = (resumo as { lastFatoDate?: string | null })?.lastFatoDate;
    if (!lastFatoDate) return;
    const last = new Date(lastFatoDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (last < yesterday) {
      autoSyncFiredRef.current = true;
      // Sempre pelo caminho com trava/throttle no servidor (nunca força).
      void triggerSync({ background: true });
    } else {
      const diffDays = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays === 0) {
        setLastSyncedLabel("hoje");
      } else if (diffDays === 1) {
        setLastSyncedLabel("ontem");
      } else {
        setLastSyncedLabel(`${last.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumo]);

  const { data: midia } = useQuery({
    queryKey: ["midia", id, canal, presetPeriodo, dateFilter.dataInicio, dateFilter.dataFim, chartAgrupamento],
    queryFn: () => fetchMidia(id, canal as string, dateFilter, presetPeriodo, isLongPeriod ? undefined : chartAgrupamento),
    enabled: !!id && canal !== "imoveis" && canal !== "crm",
  });

  const { data: financeiro } = useQuery({
    queryKey: ["financeiro", id, canal],
    queryFn: () => fetchFinanceiro(id, canal as "geral" | "meta" | "google"),
    enabled: !!id,
  });
  const { data: metaAdsData, isLoading: metaAdsLoading, error: metaAdsError } = useQuery({
    queryKey: ["meta-ads", id, dateFilter.periodo, dateFilter.dataInicio, dateFilter.dataFim],
    queryFn: () => fetchMetaAds(id, dateFilter, true),
    enabled: !!id && canal === "meta",
  });
  const { data: googleKeywordsData, isLoading: googleKeywordsLoading } = useQuery({
    queryKey: ["google-keywords", id, dateFilter.periodo, dateFilter.dataInicio, dateFilter.dataFim],
    queryFn: () => fetchGoogleKeywords(id, dateFilter),
    enabled: !!id && canal === "google" && subView === "criativos",
  });

  const { data: crmFunil } = useQuery<{ configured: boolean }>({
    queryKey: ["crm-funil-status", id],
    queryFn: () => fetch(`/api/clientes/${id}/crm/funil`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const hasCrm = crmFunil?.configured === true;

  const isHotelPanel = isHotelFazendaSaoJoao(cliente) && canal !== "google" && canal !== "imoveis" && canal !== "crm";
  const isTertuliaPanel = isTertulia(cliente) && canal !== "google" && canal !== "imoveis" && canal !== "crm";
  const isVarellaPanel = isVarellaMotos(cliente) && canal !== "imoveis" && canal !== "crm";
  const isMiguelImoveisPanel = isMiguelImoveis(cliente) && canal !== "google" && canal !== "imoveis" && canal !== "crm";
  const isMiguelGooglePanel = isMiguelImoveis(cliente) && canal === "google";
  const isMiguelPanel = isDrFernandoGuena(cliente) && canal !== "google";
  const isClinicaESpaPanel = isClinicaESpa(cliente) && !isImobClient(cliente) && canal !== "google";
  const isComprasPanel = (isDor(cliente) || isGranarolo(cliente) || isVitoBalducci(cliente)) && canal !== "google";
  const isVisitasPanel = isFlorien(cliente) && canal !== "google";
  const isAcademyPanel = isAcademyAmericana(cliente) && canal !== "google";
  const isKombuchaPanel = isKombucha(cliente) && canal !== "google";
  const isBeBluePanel = isBeBlueSchool(cliente) && canal !== "google";
  const isEcommerceMode = isGranarolo(cliente) || isDor(cliente) || isVitoBalducci(cliente);
  const convLabels = React.useMemo(() => isComprasPanel
    ? { singular: "compra", plural: "compras", metric: "Custo/Compra", metricFull: "Custo / Compra", kpi: "Meta Custo/Compra", dbKey: "COMPRAS", taxa: "TAXA COMPRA", cust: "CUSTO / COMPRA", semResult: "sem compras", crLabel: "CR (clique→compra)", chartKey: "Compras", sub: "Total do período" }
    : isVisitasPanel
    ? { singular: "visita", plural: "visitas", metric: "Custo/Visita", metricFull: "Custo / Visita", kpi: "Meta Custo/Visita", dbKey: "VISITAS", taxa: "VISITAS / 1K", cust: "CUSTO / VISITA", semResult: "sem visitas", crLabel: "Visitas/1k impr.", chartKey: "Visitas", sub: "Visitas ao perfil do Instagram no período" }
    : isMiguelImoveisPanel
    ? { singular: "resultado", plural: "resultados", metric: "Custo/Result.", metricFull: "Custo / Resultado", kpi: "Meta Custo/Result.", dbKey: "RESULTADOS", taxa: "TAXA RESULT.", cust: "CUSTO / RESULT.", semResult: "sem resultados", crLabel: "CR (clique→result.)", chartKey: "Resultados", sub: "Total de conversas iniciadas e cadastros no período" }
    : (isMiguelPanel || isClinicaESpaPanel)
    ? { singular: "conv.", plural: "conversas", metric: "Custo/conv.", metricFull: "Custo / Conversa", kpi: "Meta Custo/Conv.", dbKey: "CONVERSAS", taxa: "TAXA CONVERSA", cust: "CUSTO / CONVERSA", semResult: "sem conversas", crLabel: "CR (clique→conv.)", chartKey: "Conversas", sub: "Conversas por mensagem iniciadas no período" }
    : isKombuchaPanel
    ? { singular: "carrinho", plural: "carrinhos", metric: "Custo/Carrinho", metricFull: "Custo / Carrinho", kpi: "Meta Custo/Carrinho", dbKey: "CARRINHOS", taxa: "TAXA CARRINHO", cust: "CUSTO / CARRINHO", semResult: "sem carrinhos", crLabel: "CR (clique→carrinho)", chartKey: "Carrinhos", sub: "Adições ao carrinho no período" }
    : isBeBluePanel
    ? { singular: "view de LP", plural: "views de LP", metric: "Custo/View LP", metricFull: "Custo / View LP", kpi: "Meta Custo/View LP", dbKey: "VIEWS LP", taxa: "VIEWS / 1K", cust: "CUSTO / VIEW LP", semResult: "sem views de LP", crLabel: "Views LP/1k impr.", chartKey: "Views LP", sub: "Visualizações da página de destino no período" }
    : { singular: "lead", plural: "leads", metric: "CPL", metricFull: "CPL", kpi: "CPL Alvo", dbKey: "LEADS", taxa: "TAXA CONV.", cust: "CPL", semResult: "sem leads", crLabel: "CR (clique→lead)", chartKey: "Leads", sub: "Total do período" }
  , [isComprasPanel, isVisitasPanel, isMiguelImoveisPanel, isMiguelPanel, isClinicaESpaPanel, isKombuchaPanel, isBeBluePanel]);
  const isSpecialPanel = isHotelPanel || isTertuliaPanel || isVarellaPanel;
  const { data: painelEspecial } = useQuery({
    queryKey: ["painel-especial", id, canal, presetPeriodo, dateFilter.dataInicio, dateFilter.dataFim, chartAgrupamento],
    queryFn: () => fetchPainelEspecial(id, canal as "geral" | "meta" | "google", dateFilter, presetPeriodo, isLongPeriod ? undefined : chartAgrupamento),
    enabled: !!id && isHotelPanel,
  });
  const { data: painelTertulia } = useQuery({
    queryKey: ["painel-tertulia", id, canal, presetPeriodo, dateFilter.dataInicio, dateFilter.dataFim, chartAgrupamento],
    queryFn: () => fetchPainelTertulia(id, canal as "geral" | "meta" | "google", dateFilter, presetPeriodo, isLongPeriod ? undefined : chartAgrupamento),
    enabled: !!id && isTertuliaPanel,
  });
  const { data: painelVarella } = useQuery({
    queryKey: ["painel-varella", id, canal, presetPeriodo, dateFilter.dataInicio, dateFilter.dataFim, chartAgrupamento],
    queryFn: () => fetchPainelVarella(id, canal as "geral" | "meta" | "google", dateFilter, presetPeriodo, isLongPeriod ? undefined : chartAgrupamento),
    enabled: !!id && isVarellaPanel,
  });

  const { data: analytics } = useQuery({
    queryKey: ["analytics", id, dateFilter.periodo, dateFilter.dataInicio, dateFilter.dataFim],
    queryFn: () => fetchAnalytics(id, dateFilter),
    enabled: !!id && (canal === "geral" || subView === "dados"),
  });

  const { data: saldoMeta } = useQuery<{ saldo: number | null; moeda?: string; spendCap?: number | null; motivo?: string }>({
    queryKey: ["saldo-meta", id],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${id}/saldo?canal=meta`);
      return res.json();
    },
    enabled: !!id && canal === "meta",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: saldoGoogle } = useQuery<{ saldo: number | null; totalAprovado?: number | null; utilizado?: number; moeda?: string; motivo?: string; fonte?: string }>({
    queryKey: ["saldo-google", id],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${id}/saldo?canal=google`);
      return res.json();
    },
    enabled: !!id && canal === "google",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const series = midia?.series ?? [];
  const latestFiveSeries = series.slice(-5);
  const chartConversionKey = isEcommerceMode ? "Compras" : canal === "google" ? "Conversões" : convLabels.chartKey;
  const chartData = series.map((s: { periodo: string; investimento: number; leads: number; conversas?: number; purchases?: number; valorConversao?: number }) => {
    const inv = Math.round(s.investimento * 100) / 100;
    const conv = isMiguelImoveisPanel
      ? (s.conversas ?? 0) + s.leads
      : (isMiguelPanel || isClinicaESpaPanel)
      ? (s.conversas ?? 0)
      : isEcommerceMode
        ? (s.purchases ?? s.leads)
        : s.leads;
    const entry: Record<string, string | number> = {
      periodo: s.periodo,
      Investimento: inv,
      [chartConversionKey]: conv,
      CPL: conv > 0 ? Math.round((s.investimento / conv) * 100) / 100 : 0,
    };
    if (isEcommerceMode) {
      entry["Faturamento"] = Math.round((s.valorConversao ?? 0) * 100) / 100;
    }
    return entry;
  });
  const chartRevenueKey = isEcommerceMode ? "Faturamento" : undefined;

  const canalLabels: Record<string, string> = {
    geral: "Geral",
    google: "Google",
    meta: "META",
  };

  type MetricTrend = "higher" | "lower" | "neutral";
  type MetricRow = { investimento: number; leads: number; conversas?: number; impressoes: number; cliques: number; purchases?: number };

  const metricDefinitions = React.useMemo(() => {
    const conversionLabel = isEcommerceMode ? "COMPRAS" : canal === "google" ? "CONVERSÕES" : convLabels.dbKey;
    const conversionDesc = isEcommerceMode
      ? "Compras no site atribuídas ao período (pedidos confirmados)."
      : canal === "google"
        ? "Total de conversões atribuídas (alinhado ao relatório de campanhas do Google Ads)."
        : isComprasPanel
          ? "Compras no site atribuídas ao período (objetivo principal das campanhas)."
          : isVisitasPanel
            ? "Visitas ao perfil do Instagram geradas no período."
            : isMiguelImoveisPanel
              ? "Total de conversas iniciadas via mensagem + cadastros via formulário no período."
              : (isMiguelPanel || isClinicaESpaPanel)
              ? "Conversas por mensagem iniciadas no período (objetivo principal das campanhas)."
              : "Conversões atribuídas ao período.";
    const taxaDesc =
      canal === "google"
        ? "Conversões em relação aos cliques (taxa de conversão aproximada)."
        : isComprasPanel
          ? "Percentual de compras sobre os cliques gerados."
          : isVisitasPanel
            ? "Visitas ao perfil por mil impressões (taxa de entrega de visitas)."
            : isMiguelImoveisPanel
              ? "Percentual do total de resultados (conversas + cadastros) sobre os cliques gerados."
              : (isMiguelPanel || isClinicaESpaPanel)
              ? "Percentual de conversas iniciadas sobre os cliques gerados."
              : "Percentual de leads sobre cliques.";
    const custoPorResultadoLabel = isEcommerceMode ? "CUSTO / COMPRA" : canal === "google" ? "CUSTO / CONV." : convLabels.cust;
    const custoPorResultadoDesc = isEcommerceMode
      ? "Investimento ÷ compras no site da semana (custo de aquisição por pedido)."
      : canal === "google"
        ? "Investimento ÷ conversões da semana (equivalente ao custo por conversão do Google)."
        : isComprasPanel
          ? "Investimento ÷ compras no site da semana."
          : isVisitasPanel
            ? "Investimento ÷ visitas ao perfil da semana."
            : isMiguelImoveisPanel
              ? "Investimento ÷ total de resultados (conversas + cadastros) da semana."
              : (isMiguelPanel || isClinicaESpaPanel)
              ? "Investimento ÷ conversas iniciadas da semana."
              : "Custo médio por lead da semana.";
    return [
      {
        label: "INVESTIMENTO",
        description: "Valor investido em mídia na semana.",
        trend: "neutral" as MetricTrend,
        value: (s: MetricRow) => s.investimento,
        format: (value: number) => formatCurrency(value),
      },
      {
        label: "IMPRESSÕES",
        description: "Volume total de entregas dos anúncios.",
        trend: "higher" as MetricTrend,
        value: (s: MetricRow) => s.impressoes,
        format: (value: number) => formatInteger(value),
      },
      {
        label: "CLIQUES",
        description:
          canal === "google"
            ? "Cliques nos anúncios (no Google Ads, “interações” pode incluir outros tipos)."
            : "Interações geradas pelos anúncios.",
        trend: "higher" as MetricTrend,
        value: (s: MetricRow) => s.cliques,
        format: (value: number) => formatInteger(value),
      },
      {
        label: "CTR (%)",
        description: "Taxa de clique sobre impressões.",
        trend: "higher" as MetricTrend,
        value: (s: MetricRow) => (s.impressoes > 0 ? (s.cliques / s.impressoes) * 100 : 0),
        format: (value: number) => formatPercentage(value),
      },
      {
        label: conversionLabel,
        description: conversionDesc,
        trend: "higher" as MetricTrend,
        value: (s: MetricRow) => isMiguelImoveisPanel ? (s.conversas ?? 0) + s.leads : (isMiguelPanel || isClinicaESpaPanel) ? (s.conversas ?? 0) : isEcommerceMode ? (s.purchases ?? s.leads) : s.leads,
        format: (value: number) => formatInteger(value),
      },
      ...(isMiguelImoveisPanel ? [
        {
          label: "CONVERSAS MENSAGEM",
          description: "Conversas iniciadas via WhatsApp e mensagens diretas.",
          trend: "higher" as MetricTrend,
          value: (s: MetricRow) => s.conversas ?? 0,
          format: (value: number) => formatInteger(value),
          isSubRow: true,
        },
        {
          label: "CADASTROS FORMULÁRIO",
          description: "Leads via formulário de cadastro e contato no site.",
          trend: "higher" as MetricTrend,
          value: (s: MetricRow) => s.leads,
          format: (value: number) => formatInteger(value),
          isSubRow: true,
        },
      ] : []),
      {
        label: isEcommerceMode ? "TAXA COMPRA" : convLabels.taxa,
        description: isEcommerceMode ? "Percentual de compras sobre os cliques gerados." : taxaDesc,
        trend: "higher" as MetricTrend,
        value: (s: MetricRow) => {
          const conv = isMiguelImoveisPanel ? (s.conversas ?? 0) + s.leads : (isMiguelPanel || isClinicaESpaPanel) ? (s.conversas ?? 0) : isEcommerceMode ? (s.purchases ?? s.leads) : s.leads;
          if (isVisitasPanel) return s.impressoes > 0 ? (conv / s.impressoes) * 1000 : 0;
          return s.cliques > 0 ? (conv / s.cliques) * 100 : 0;
        },
        format: (value: number) => isVisitasPanel ? value.toFixed(2) : formatPercentage(value),
      },
      {
        label: "CPC",
        description: "Custo médio por clique gerado.",
        trend: "lower" as MetricTrend,
        value: (s: MetricRow) => (s.cliques > 0 ? s.investimento / s.cliques : 0),
        format: (value: number) => formatCurrency(value),
      },
      {
        label: custoPorResultadoLabel,
        description: custoPorResultadoDesc,
        trend: "lower" as MetricTrend,
        value: (s: MetricRow) => {
          const conv = isMiguelImoveisPanel ? (s.conversas ?? 0) + s.leads : (isMiguelPanel || isClinicaESpaPanel) ? (s.conversas ?? 0) : isEcommerceMode ? (s.purchases ?? s.leads) : s.leads;
          return conv > 0 ? s.investimento / conv : 0;
        },
        format: (value: number) => formatCurrency(value),
      },
      ...(isClinicaESpaPanel ? [{
        label: "CPM",
        description: "Custo por mil impressões (eficiência do alcance dos anúncios).",
        trend: "lower" as MetricTrend,
        value: (s: MetricRow) => s.impressoes > 0 ? (s.investimento / s.impressoes) * 1000 : 0,
        format: (value: number) => formatCurrency(value),
      }] : []),
    ];
  }, [canal, isMiguelImoveisPanel, isMiguelPanel, isClinicaESpaPanel, isComprasPanel, isVisitasPanel, isEcommerceMode, convLabels]);

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatPercentage(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
}

  return (
    <main className="space-y-8 pb-12">
      {/* ── Fullscreen loading overlay ── */}
      {loaderVisible && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--background)]"
          style={{
            opacity: loaderFading ? 0 : 1,
            transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: loaderFading ? "none" : "all",
          }}
        >
          {/* 2×2 grid of orange squares */}
          <div className="grid grid-cols-2 gap-[10px]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-[6px] bg-[var(--primary)]"
                style={{
                  animation: "inout-square 1.1s ease-in-out infinite",
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Carregando
          </p>
        </div>
      )}

      {/* ── Breadcrumb + Title + Channel tabs ── */}
      <section className="space-y-5">
        {!portalMode && (
          <Link
            href="/clientes"
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Central de clientes
          </Link>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              Acompanhamento estratégico
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {cliente?.nome ?? "…"}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Monitoramento de performance do projeto
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
            {([
              "geral",
              "meta",
              "google",
              ...(isMiguelImoveis(cliente) ? ["imoveis"] : []),
              ...(hasCrm ? ["crm"] : []),
            ] as const).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCanal(c as typeof canal);
                  setSubView("dados");
                  setSaldoVisible(false);
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all sm:px-4 ${
                  canal === c
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/20"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {c === "geral" ? "Geral" : c === "meta" ? "META" : c === "google" ? "Google" : c === "imoveis" ? "Imóveis" : c === "crm" ? "CRM" : "Lead Scoring"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Date filter + sub-aba Criativos / Análise de dados (Meta/Google) ── */}
      <div className="flex flex-col gap-2" ref={filterRef}>
        {/* Linha 1: Saldo chip (esquerda) + Filtro de data (direita) */}
        <div className="flex items-center gap-2">
          {/* Saldo chip — só em Meta/Google */}
          {!portalMode && canal !== "geral" && canal !== "imoveis" && canal !== "crm" && (() => {
            const saldo = canal === "meta" ? saldoMeta : saldoGoogle;
            const plataforma = canal === "meta" ? "META" : "Google";
            const value = saldo?.saldo;
            const isLoading = saldo === undefined;
            // fonte "gasto_mes" = sem orçamento, mostra investido do mês
            const isGastoMes = canal === "google" && (saldo as { fonte?: string })?.fonte === "gasto_mes";
            const utilizado = (saldo as { utilizado?: number })?.utilizado;
            const displayValue = isGastoMes ? utilizado : value;
            const isCritical = !isGastoMes && value != null && value < 100;
            const isWarning  = !isGastoMes && value != null && value >= 100 && value < 200;

            const containerClass = isCritical
              ? "border-red-500/40 bg-red-500/8 text-red-400"
              : isWarning
                ? "border-amber-400/40 bg-amber-400/8 text-amber-400"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]";

            const labelClass = isCritical
              ? "text-red-400/70"
              : isWarning
                ? "text-amber-400/70"
                : "text-[var(--muted-foreground)]";

            return (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all sm:gap-3 sm:px-4 sm:py-2.5 ${containerClass}`}>
                <Wallet className={`h-4 w-4 shrink-0 ${isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-[var(--primary)]"}`} />
                <div className="flex flex-col leading-tight">
                  <span className={`text-[9px] font-semibold uppercase tracking-widest sm:text-[10px] ${labelClass}`}>
                    {isGastoMes ? `Investido ${plataforma}` : `Saldo ${plataforma}`}
                  </span>
                  {isLoading ? (
                    <span className="text-xs animate-pulse text-[var(--muted-foreground)]">carregando…</span>
                  ) : displayValue != null ? (
                    <span className="text-sm font-bold tabular-nums">
                      {saldoVisible ? formatCurrency(displayValue) : "R$ ••••••"}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </div>
                {(isCritical || isWarning) && saldoVisible && (
                  <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isCritical ? "text-red-400" : "text-amber-400"}`} />
                )}
                <button
                  onClick={() => setSaldoVisible((v) => !v)}
                  className={`ml-1 flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-black/10 ${labelClass}`}
                  title={saldoVisible ? "Ocultar saldo" : "Revelar saldo"}
                >
                  {saldoVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })()}

          {/* Sync chip — icon-only, same height as Saldo chip; label aparece em hover (title) */}
          {!portalMode && (
            <button
              onClick={() => triggerSync()}
              disabled={syncStatus === "syncing"}
              title={
                syncStatus === "syncing"
                  ? "Sincronizando…"
                  : syncStatus === "error"
                    ? "Erro ao sincronizar"
                    : lastSyncedLabel
                      ? `Atualizado ${lastSyncedLabel}`
                      : "Sincronizar dados agora"
              }
              aria-label={
                syncStatus === "syncing"
                  ? "Sincronizando"
                  : syncStatus === "error"
                    ? "Erro ao sincronizar"
                    : lastSyncedLabel
                      ? `Atualizado ${lastSyncedLabel}`
                      : "Sincronizar"
              }
              className={`inline-flex self-stretch w-11 items-center justify-center rounded-xl border transition-all ${
                syncStatus === "syncing"
                  ? "border-[var(--primary)]/40 bg-[var(--primary)]/8 text-[var(--primary)] cursor-wait"
                  : syncStatus === "error"
                    ? "border-red-500/40 bg-red-500/8 text-red-400 hover:bg-red-500/12"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
              }`}
            >
              <RefreshCw className={`h-4 w-4 shrink-0 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Filtro de data — direita */}
          <div className="ml-auto">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs transition-all hover:bg-[var(--muted)]/60 sm:gap-2.5 sm:px-4"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--primary)]" />
              <span className="min-w-0 truncate text-[var(--foreground)]">
                <span className="sm:hidden">{topRangeLabelShort}</span>
                <span className="hidden sm:inline max-w-[280px] truncate">{topRangeLabelFull}</span>
              </span>
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Linha 2: Toggle Análise / Criativos / Lead Scoring — só em Meta e Google */}
        {(canal === "meta" || canal === "google") && (
          <div className="flex items-center gap-1 self-end rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
            {(
              canal === "meta"
                  ? (cliente?.socialMediaAtivo
                      ? (["dados", "criativos", "social-media"] as const)
                      : (["dados", "criativos"] as const))
                  : (["dados", "criativos"] as const)
            ).map((view) => (
              <button
                key={view}
                onClick={() => setSubView(view)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all sm:px-4 sm:py-2 ${
                  subView === view
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/20"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                }`}
              >
                {view === "dados" ? "Análise" : view === "criativos" ? "Criativos" : view === "social-media" ? "Social Media" : "Lead Scoring"}
              </button>
            ))}
          </div>
        )}

        {filterOpen && (
          <div className="absolute right-4 top-28 z-40 w-[min(920px,100%-2rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl shadow-black/40">
            <div className="grid md:grid-cols-[260px_1fr]">
              {/* Presets sidebar */}
              <div className="border-b border-[var(--border)] p-4 md:border-b-0 md:border-r">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  Períodos predefinidos
                </p>
                <div className="space-y-0.5">
                  {[
                    ["hoje", "Hoje"],
                    ["ontem", "Ontem"],
                    ["7d", "Últimos 7 dias"],
                    ["14d", "Últimos 14 dias"],
                    ["30d", "Últimos 30 dias"],
                    ["60d", "Últimos 60 dias"],
                    ["90d", "Últimos 90 dias"],
                    ["mesAtual", "Este mês"],
                    ["mesAnterior", "Mês passado"],
                    ["trimestreAtual", "Este trimestre"],
                    ["ytd", "Ano atual (YTD)"],
                    ["custom", "Personalizado"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
                        presetPeriodo === value
                          ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)]"
                          : "text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                      }`}
                      onClick={() => setPresetPeriodo(value as PresetPeriodo)}
                    >
                      <span>{label}</span>
                      <span
                        className={`h-2 w-2 rounded-full transition-all ${
                          presetPeriodo === value
                            ? "bg-[var(--primary)] shadow-sm shadow-[var(--primary)]/40"
                            : "bg-[var(--border)]"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar */}
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">
                    {formatDatePt(customInicio)} {customFim ? `a ${formatDatePt(customFim)}` : ""}
                  </p>
                  <button
                    onClick={() =>
                      setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {[leftMonth, rightMonth].map((monthDate) => {
                    const grid = buildMonthGrid(monthDate);
                    return (
                      <div
                        key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                        className="rounded-xl border border-[var(--border)] p-3"
                      >
                        <p className="mb-2 text-sm font-semibold capitalize text-[var(--foreground)]">
                          {monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </p>
                        <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
                            <span key={d}>{d}</span>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {grid.map((day, idx) => {
                            if (!day) return <span key={idx} className="h-8" />;
                            const selectedStart = !!startSelected && isSameDay(day, startSelected);
                            const selectedEnd = !!endSelected && isSameDay(day, endSelected);
                            const inRange = isInRange(day);
                            return (
                              <button
                                key={toDateInputValue(day)}
                                onClick={() => handleDayClick(day)}
                                className={`h-8 rounded-md text-xs font-medium transition-all ${
                                  selectedStart || selectedEnd
                                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm shadow-[var(--primary)]/30"
                                    : inRange
                                      ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                      : "text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                                }`}
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={customInicio}
                      onChange={(e) => {
                        setPresetPeriodo("custom");
                        setCustomInicio(e.target.value);
                      }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                    />
                    <input
                      type="date"
                      value={customFim}
                      onChange={(e) => {
                        setPresetPeriodo("custom");
                        setCustomFim(e.target.value);
                      }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Criativos / Anúncios (Meta) ── */}
      {canal === "meta" && subView === "criativos" && (
        <div className="space-y-6">
          {metaAdsLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-[var(--muted-foreground)]">Carregando anúncios META…</p>
            </div>
          ) : metaAdsError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/6 px-6 py-8 text-center">
              <p className="text-sm text-red-400">
                {metaAdsError instanceof Error ? metaAdsError.message : "Erro ao carregar anúncios META."}
              </p>
            </div>
          ) : metaAdsData?.data?.length ? (
            <MetaCriativosGrid
              ads={metaAdsData.data}
              formatCurrency={formatCurrency}
              conversasMode={isMiguelImoveis(cliente) || isDrFernandoGuena(cliente) || (isClinicaESpa(cliente) && !isImobClient(cliente))}
              isComprasPanel={isComprasPanel}
              isVisitasPanel={isVisitasPanel}
              convLabels={convLabels}
            />
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-[var(--muted-foreground)]">Nenhum anúncio META ativo encontrado.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Social Media (Instagram Orgânico — sub-tab do Meta) ── */}
      {canal === "meta" && subView === "social-media" && id && (
        <SocialMediaPanel clienteId={id} dateFilter={dateFilter} />
      )}

      {/* ── Google Ads: Keywords (Criativos tab) ── */}
      {canal === "google" && subView === "criativos" && (
        <GoogleKeywordsPanel
          data={
            googleKeywordsData ?? {
              keywords: [],
              totals: { impressions: 0, clicks: 0, cost: 0, conversions: 0, cpl: 0, ctr: 0 },
              dateFrom: "",
              dateTo: "",
            }
          }
          formatCurrency={formatCurrency}
          isLoading={googleKeywordsLoading}
        />
      )}

      {/* ── Imóveis panel (only for Miguel Imóveis on the imoveis tab) ── */}
      {canal === "imoveis" && isMiguelImoveis(cliente) && (
        <ImoveisPanel clienteId={id} dateFilter={dateFilter} />
      )}


      {/* ── CRM tab ── */}
      {canal === "crm" && id && (
        <CrmTab
          clienteId={id}
          dateRange={{
            from: dateFilter.dataInicio ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
            to: dateFilter.dataFim ?? new Date().toISOString().slice(0, 10),
          }}
          perfilPanel={cliente?.perfilPanel}
        />
      )}

      {/* ── Default panel (KPIs, chart, weekly table, financial) ── */}
      {canal !== "imoveis" && canal !== "crm" && (canal === "geral" || subView === "dados") && !isSpecialPanel && resumo && (
        <DefaultPanel
          resumo={
            isMiguelImoveisPanel
              ? (() => {
                  const conversas = (resumo as { messagingConversationsStarted?: number }).messagingConversationsStarted ?? 0;
                  const formLeads = resumo.leads;
                  const total = conversas + formLeads;
                  return {
                    ...resumo,
                    leads: total,
                    cpl: total > 0 ? Math.round((resumo.investimento / total) * 100) / 100 : 0,
                    conversasMensagem: conversas,
                    leadsForm: formLeads,
                  };
                })()
              : (isMiguelPanel || isClinicaESpaPanel)
              ? {
                  ...resumo,
                  leads: (resumo as { messagingConversationsStarted?: number }).messagingConversationsStarted ?? resumo.leads,
                  cpl: (resumo as { custoPorConversa?: number }).custoPorConversa ?? resumo.cpl,
                }
              : isKombuchaPanel
              ? {
                  ...resumo,
                  conversasB2b: (resumo as { messagingConversationsStarted?: number }).messagingConversationsStarted ?? 0,
                  custoPorConversaB2b: (resumo as { custoPorConversa?: number }).custoPorConversa ?? 0,
                }
              : resumo
          }
          chartData={chartData}
          chartConversionKey={chartConversionKey}
          latestFiveSeries={latestFiveSeries}
          metricDefinitions={metricDefinitions}
          dateFilter={dateFilter}
          canal={canal}
          canalLabels={canalLabels}
          formatCurrency={formatCurrency}
          conversasMode={isMiguelPanel || isClinicaESpaPanel}
          miguelImoveisMode={isMiguelImoveisPanel}
          miguelGoogleMode={isMiguelGooglePanel}
          comprasMode={isComprasPanel}
          visitasMode={isVisitasPanel}
          ecommerceGoogleMode={isEcommerceMode}
          agrupamento={chartAgrupamento}
          onAgrupamentoChange={isLongPeriod ? undefined : (ag) => setChartAgrupamento(ag)}
          chartRevenueKey={chartRevenueKey}
          conversasEngajamentoMode={isClinicaESpaPanel}
          academyEngajamentoMode={isAcademyPanel || isClinicaESpaPanel}
          kombuchaMode={isKombuchaPanel}
          lpViewsMode={isBeBluePanel}
        />
      )}

      {(canal === "geral" || subView === "dados") && isHotelPanel && painelEspecial && (
        <HotelFazendaSaoJoaoPanel
          data={painelEspecial}
          canalLabel={canal === "geral" ? "geral" : canal === "meta" ? "meta" : "google"}
          onAgrupamentoChange={isLongPeriod ? undefined : (ag) => setChartAgrupamento(ag)}
        />
      )}

      {(canal === "geral" || subView === "dados") && isTertuliaPanel && painelTertulia && (
        <TertuliaPanel
          data={painelTertulia}
          canalLabel={canal === "geral" ? "geral" : canal === "meta" ? "meta" : "google"}
          onAgrupamentoChange={isLongPeriod ? undefined : (ag) => setChartAgrupamento(ag)}
        />
      )}

      {(canal === "geral" || subView === "dados") && isVarellaPanel && painelVarella && (
        <VarellaMotosPanel
          data={painelVarella}
          canalLabel={canal === "geral" ? "geral" : canal === "meta" ? "meta" : "google"}
          onAgrupamentoChange={isLongPeriod ? undefined : (ag) => setChartAgrupamento(ag)}
        />
      )}

      {/* ── Painel de Campanhas Meta (só na aba Meta > Análise) ── */}
      {canal === "meta" && !isFlorien(cliente) && subView === "dados" && (
        <CampanhasPanel
          clienteId={id}
          dateFilter={dateFilter}
          canal={canal}
        />
      )}

      {/* ── Google Ads: Campanhas (nível de campanha, aba Análise) ── */}
      {canal === "google" && subView === "dados" && (
        <GoogleCampanhasPanel clienteId={id} filter={dateFilter} />
      )}

      {/* ── Financial tracking (Plano x Real) ── */}
      {canal !== "imoveis" && canal !== "crm" && (canal === "geral" || subView === "dados") && financeiro && financeiro.meses && (
        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <SectionHeader
                title="Acompanhamento financeiro · Plano x Real"
                subtitle="Status de investimento no ano atual (planejado versus realizado em todos os canais)"
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted-foreground)]/60" />
                  <span className="text-[var(--muted-foreground)]">Orçado</span>
                  <strong className="text-[var(--foreground)]">
                    R${" "}
                    {Number(financeiro.totalPlanejado ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-3 py-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                  <span className="text-[var(--muted-foreground)]">Realizado</span>
                  <strong className="text-[var(--primary)]">
                    R${" "}
                    {Number(financeiro.totalRealizado ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={financeiro.meses.map(
                    (m: { ano: number; mes: number; planejadoTotal: number; realizadoTotal: number }) => ({
                      mes: new Date(m.ano, m.mes - 1, 1)
                        .toLocaleString("pt-BR", { month: "short" })
                        .toUpperCase(),
                      Orcado: m.planejadoTotal,
                      Realizado: m.realizadoTotal,
                    })
                  )}
                >
                  <defs>
                    <linearGradient id="finBarGradSpecial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="finRealGradSpecial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="mes"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(Number(value)),
                      name,
                    ]}
                    {...tooltipStyle}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="Orcado" fill="url(#finBarGradSpecial)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Realizado" fill="url(#finRealGradSpecial)" radius={[6, 6, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ── Pace do mês atual ── */}
            {(() => {
              const today = new Date();
              const currentMonth = today.getMonth() + 1;
              const currentYear = today.getFullYear();
              const cmd = (financeiro.meses as Array<{ ano: number; mes: number; planejadoTotal: number; realizadoTotal: number }>)
                .find(m => m.mes === currentMonth && m.ano === currentYear);
              if (!cmd || cmd.planejadoTotal <= 0) return null;
              const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
              const dayOfMonth = today.getDate();
              const paceIdeal = (cmd.planejadoTotal / daysInMonth) * dayOfMonth;
              const delta = cmd.realizadoTotal - paceIdeal;
              const deltaPercent = paceIdeal > 0 ? (delta / paceIdeal) * 100 : 0;
              const isAhead = delta >= 0;
              const pctRealizado = Math.min(100, (cmd.realizadoTotal / cmd.planejadoTotal) * 100);
              const pctEsperado = Math.min(100, (paceIdeal / cmd.planejadoTotal) * 100);
              const monthName = new Date(currentYear, currentMonth - 1, 1)
                .toLocaleString("pt-BR", { month: "long" });
              const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
              return (
                <div className="mt-5 rounded-2xl border border-[var(--border)]/60 bg-white/[0.025] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                      Ritmo do mês · {monthLabel} — dia {dayOfMonth} de {daysInMonth}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${isAhead ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                      {isAhead ? "▲" : "▼"} {Math.abs(deltaPercent).toFixed(1)}% {isAhead ? "acima do ritmo" : "abaixo do ritmo"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/[0.04] p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Orçado no mês</p>
                      <p className="text-[15px] font-bold text-[var(--foreground)]">{formatCurrency(cmd.planejadoTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--primary)]/[0.06] p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Realizado até hoje</p>
                      <p className="text-[15px] font-bold text-[var(--primary)]">{formatCurrency(cmd.realizadoTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Ritmo esperado (dia {dayOfMonth})</p>
                      <p className="text-[15px] font-bold text-[var(--foreground)]">{formatCurrency(paceIdeal)}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${isAhead ? "bg-emerald-500/[0.07]" : "bg-rose-500/[0.07]"}`}>
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Diferença do ritmo</p>
                      <p className={`text-[15px] font-bold ${isAhead ? "text-emerald-400" : "text-rose-400"}`}>
                        {isAhead ? "+" : ""}{formatCurrency(delta)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10" style={{ left: `${pctEsperado}%` }} />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${isAhead ? "bg-emerald-500/70" : "bg-[var(--primary)]/70"}`}
                      style={{ width: `${pctRealizado}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 text-[10px] text-[var(--muted-foreground)]">
                    <span>{pctRealizado.toFixed(0)}% realizado do mês</span>
                    <span className="text-white/20">|</span>
                    <span>Ritmo esperado: {pctEsperado.toFixed(0)}%</span>
                    <span className="text-white/20">|</span>
                    <span>{(100 - pctRealizado).toFixed(0)}% restante para fechar o mês</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ── Comportamento GA4 (todos os painéis quando configurado) ── */}
      {canal !== "imoveis" && canal !== "crm" && (canal === "geral" || subView === "dados") && analytics?.hasAnalytics && (
        <AnalyticsGA4Section data={analytics} />
      )}

      {/* ── Pauta da semana (geral only, internal only) ── */}
      {id && canal === "geral" && !portalMode && <PautaDaSemana clienteId={id} />}

      {/* ── Empty state ── */}
      {id && (canal === "geral" || subView === "dados") && resumo && resumo.leads === 0 && Number(resumo.investimento) === 0 && (
        <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)]">
              <BarChart3 className="h-6 w-6 text-[var(--muted-foreground)]" />
            </div>
            <p className="mb-1 text-sm font-medium text-[var(--foreground)]">
              Nenhum dado de mídia ainda
            </p>
            <p className="mx-auto max-w-md text-sm text-[var(--muted-foreground)]">
              A sincronização é feita na <strong className="text-[var(--foreground)]">Administração</strong>:
              configure as credenciais do Google Sheets e clique em{" "}
              <strong className="text-[var(--foreground)]">Sincronizar</strong>.
            </p>
            {!portalMode && (
              <Link
                href="/admin/clientes"
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/10 px-4 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/20"
              >
                Ir para Administração
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}


/* ─── Meta Criativos Grid ─── */

type MetaAdCreative = {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  image_url_full?: string;
  video_id?: string;
  video_source_url?: string;
  video_picture_url?: string;
  video_embed_html?: string;
  body?: string;
  title?: string;
};

type MetaAdItem = {
  id: string;
  name: string;
  adcreatives?: { data: MetaAdCreative[] };
  insights?: { data: Array<{ spend?: string; impressions?: string; clicks?: string; inline_link_clicks?: string; ctr?: string; cpc?: string; frequency?: string; actions?: Array<{ action_type: string; value: string }>; video_p100_watched_actions?: Array<{ action_type: string; value: string }> }> };
};

function CriativoPreview({
  creative,
  creativeId,
  adId,
  alt,
  mode,
  priority = false,
  adFormat = "MOBILE_FEED_STANDARD",
  useFallback = false,
}: {
  creative: MetaAdCreative | undefined;
  creativeId?: string;
  adId?: string;
  alt: string;
  mode: "featured" | "card";
  priority?: boolean;
  adFormat?: "MOBILE_FEED_STANDARD";
  useFallback?: boolean;
}) {
  const [imgError, setImgError] = React.useState(false);
  const [previewIframeBody, setPreviewIframeBody] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const [metaPreview, setMetaPreview] = React.useState<{ src: string; w: number; h: number } | null>(null);

  const previewId = creativeId ?? adId;
  const shouldFetchMetaPreview = mode === "featured" && previewId && !useFallback;

  React.useEffect(() => {
    if (!shouldFetchMetaPreview) {
      setPreviewIframeBody(null);
      setMetaPreview(null);
      setPreviewFailed(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewFailed(false);
    const params = new URLSearchParams({ adFormat });
    if (creativeId) params.set("creativeId", creativeId);
    else if (adId) params.set("adId", adId);
    fetch(`/api/meta/preview?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Preview indisponível");
        return res.json();
      })
      .then((data: { body?: string }) => {
        if (data?.body) setPreviewIframeBody(data.body);
        else setPreviewFailed(true);
      })
      .catch(() => setPreviewFailed(true))
      .finally(() => setPreviewLoading(false));
  }, [shouldFetchMetaPreview, adFormat, creativeId, adId]);

  React.useEffect(() => {
    if (mode !== "featured" || useFallback || !previewIframeBody || previewFailed) return;
    try {
      const doc = new DOMParser().parseFromString(previewIframeBody, "text/html");
      const iframe = doc.querySelector("iframe");
      const src = iframe?.getAttribute("src") ?? "";
      const w = parseInt(iframe?.getAttribute("width") ?? "0", 10) || 274;
      const h = parseInt(iframe?.getAttribute("height") ?? "0", 10) || 213;
      if (src) setMetaPreview({ src, w, h });
      else setMetaPreview(null);
    } catch {
      setMetaPreview(null);
    }
  }, [mode, useFallback, previewIframeBody, previewFailed]);

  const isVideo = !!(creative?.video_source_url || creative?.video_embed_html || creative?.video_id);
  const rawImgUrl =
    creative?.image_url_full ||
    creative?.image_url ||
    creative?.video_picture_url ||
    creative?.thumbnail_url;
  const imgUrl = upgradeFbCdnImageUrl(rawImgUrl) || rawImgUrl;
  const rawPosterUrl = creative?.video_picture_url || creative?.thumbnail_url;
  const posterUrl = upgradeFbCdnImageUrl(rawPosterUrl) || rawPosterUrl;
  const containerClass =
    mode === "featured"
      ? "flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20"
      : "flex h-56 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-3";

  const Placeholder = ({ message = "Preview indisponível" }: { message?: string }) => (
    <div className={`${containerClass} flex-col gap-2 text-center text-[var(--muted-foreground)]`}>
      <BarChart3 className="h-8 w-8 opacity-50" />
      <span className="text-xs">{message}</span>
    </div>
  );

  if (mode === "featured" && !useFallback && metaPreview && !previewFailed) {
    const scale = 360 / metaPreview.w;
    const iframeH = Math.round(metaPreview.h / scale) + 210;
    const displayH = Math.round(iframeH * scale);
    return (
      <div
        className="mx-auto overflow-hidden rounded-2xl border-[8px] border-[#2c2c2e] bg-[#2c2c2e] shadow-xl"
        style={{ width: 360, height: displayH }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: metaPreview.w, height: iframeH }}>
          <iframe
            title="Prévia do anúncio (Meta)"
            src={metaPreview.src}
            scrolling="no"
            style={{ border: "none", display: "block", width: metaPreview.w, height: iframeH }}
          />
        </div>
      </div>
    );
  }

  if (mode === "featured" && !useFallback && previewLoading) {
    return (
      <div className={`${containerClass} flex-col gap-2`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <span className="text-xs text-[var(--muted-foreground)]">Carregando prévia do Meta…</span>
      </div>
    );
  }

  if (mode === "featured" && isVideo && creative?.video_source_url) {
    return (
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border-[8px] border-[#2c2c2e] bg-[#2c2c2e] shadow-xl">
        <video
          src={creative.video_source_url}
          controls
          playsInline
          preload="metadata"
          poster={posterUrl}
          className="h-auto w-full object-contain"
          style={{ maxHeight: "70vh" }}
        >
          Seu navegador não suporta vídeo.
        </video>
      </div>
    );
  }

  if (mode === "featured" && isVideo && creative?.video_embed_html) {
    return (
      <div className={`${containerClass} overflow-hidden bg-black`}>
        <div className="aspect-video w-full max-w-2xl" dangerouslySetInnerHTML={{ __html: creative.video_embed_html }} />
      </div>
    );
  }

  if ((imgUrl || posterUrl) && !imgError) {
    const mediaUrl = imgUrl || posterUrl;
    if (mediaUrl) {
      return mode === "featured" ? (
        <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border-[8px] border-[#2c2c2e] bg-[#2c2c2e] shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            className="h-auto w-full object-contain"
            style={{ maxHeight: "70vh" }}
            onError={() => setImgError(true)}
          />
          {isVideo && (
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
                <Play className="h-3 w-3 fill-current" />
                {creative?.video_source_url || creative?.video_embed_html ? "Vídeo com player" : "Thumbnail"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative overflow-hidden ${containerClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            className="max-h-[72vh] h-full w-full rounded-xl object-contain"
            onError={() => setImgError(true)}
          />
          {isVideo && (
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
                <Play className="h-3 w-3 fill-current" />
                {creative?.video_source_url || creative?.video_embed_html ? "Vídeo com player" : "Thumbnail"}
              </span>
            </div>
          )}
        </div>
      );
    }
  }

  if (isVideo && creative?.video_source_url) {
    return (
      <div className={`relative overflow-hidden ${containerClass}`}>
        <video src={creative.video_source_url} preload="metadata" muted playsInline className="h-full w-full object-contain" />
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
            <Play className="h-3 w-3 fill-current" />
            Vídeo
          </span>
        </div>
      </div>
    );
  }

  if (isVideo) return <Placeholder message="Vídeo sem thumbnail disponível" />;
  return <Placeholder />;
}

type ConvLabels = {
  singular: string; plural: string; metric: string; metricFull: string; kpi: string;
  dbKey: string; taxa: string; cust: string; semResult: string; crLabel: string;
  chartKey: string; sub: string;
};

function MetaCriativosGrid({
  ads,
  formatCurrency,
  conversasMode = false,
  isComprasPanel = false,
  isVisitasPanel = false,
  convLabels,
}: {
  ads: MetaAdItem[];
  formatCurrency: (v: number) => string;
  conversasMode?: boolean;
  isComprasPanel?: boolean;
  isVisitasPanel?: boolean;
  convLabels: ConvLabels;
}) {
  const sorted = React.useMemo(() => {
    const nameCounts: Record<string, number> = {};
    for (const ad of ads) {
      const k = ad.name.toLowerCase().trim();
      nameCounts[k] = (nameCounts[k] || 0) + 1;
    }
    const nameVersion: Record<string, number> = {};
    return ads
      .map((ad) => {
        const creative = ad.adcreatives?.data?.[0];
        const insightRows = ad.insights?.data ?? [];

        // Aggregate metrics across ALL daily rows (API returns time_increment=1)
        const spend = insightRows.reduce((s, r) => s + (r.spend ? parseFloat(r.spend) : 0), 0);
        const impressions = insightRows.reduce((s, r) => s + (r.impressions ? parseInt(r.impressions, 10) : 0), 0);
        const linkClicks = insightRows.reduce((s, r) => s + (r.inline_link_clicks ? parseInt(r.inline_link_clicks, 10) : 0), 0);
        const allClicks = insightRows.reduce((s, r) => s + (r.clicks ? parseInt(r.clicks, 10) : 0), 0);
        const clicks = linkClicks || allClicks;

        // Merge actions by type (sum across all daily rows)
        const actionsMap = new Map<string, number>();
        for (const row of insightRows) {
          for (const action of row.actions ?? []) {
            actionsMap.set(action.action_type, (actionsMap.get(action.action_type) ?? 0) + (parseInt(action.value, 10) || 0));
          }
        }
        const actions = Array.from(actionsMap.entries()).map(([action_type, value]) => ({ action_type, value: String(value) }));

        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpcFromApi = insightRows[0]?.cpc ? parseFloat(insightRows[0].cpc) : 0;
        const cpc = clicks > 0 ? spend / clicks : cpcFromApi;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const mediaType = creative?.video_source_url || creative?.video_embed_html || creative?.video_id ? "video" : "image";
        const getAction = (type: string) =>
          parseInt(actions.find((a) => a.action_type === type)?.value ?? "0", 10) || 0;
        const leadCount = getAction("lead");
        const onFbLeads = getAction("onsite_conversion.lead_grouped");
        const websiteLeads = getAction("offsite_conversion.fb_pixel_lead") || getAction("website_lead");
        const conventionalLeads = leadCount || onFbLeads || websiteLeads;
        const conversasCount =
          getAction("onsite_conversion.messaging_conversation_started_7d") ||
          getAction("messaging_conversation_started_7d") ||
          getAction("onsite_messaging_conversation_started_7d") ||
          getAction("messaging_first_reply");
        const comprasCount =
          getAction("offsite_conversion.fb_pixel_purchase") ||
          getAction("purchase");
        const visitasCount =
          getAction("ig_profile_visit") ||
          getAction("onsite_conversion.post_save");
        const leads = isComprasPanel ? comprasCount : isVisitasPanel ? visitasCount : conversasMode ? conversasCount : conventionalLeads;
        const video3sViews = getAction("video_view");
        // Sum video 100% completions across all daily rows
        const video100Views = insightRows.reduce((s, r) => s + (parseInt(r.video_p100_watched_actions?.[0]?.value ?? "0", 10) || 0), 0);
        // Use last row's frequency (it's an average, not a sum)
        const frequency = insightRows.at(-1)?.frequency ? parseFloat(insightRows.at(-1)!.frequency!) : 0;
        const cr = isVisitasPanel
          ? (impressions > 0 ? (leads / impressions) * 1000 : 0)
          : clicks > 0 ? (leads / clicks) * 100 : 0;
        const hookRate = impressions > 0 && video3sViews > 0 ? (video3sViews / impressions) * 100 : 0;
        const holdRate = video3sViews > 0 && video100Views > 0 ? (video100Views / video3sViews) * 100 : 0;
        const nameKey = ad.name.toLowerCase().trim();
        const displayName =
          nameCounts[nameKey] > 1
            ? (() => { nameVersion[nameKey] = (nameVersion[nameKey] || 0) + 1; return `${ad.name} — v${nameVersion[nameKey]}`; })()
            : ad.name;
        return {
          ad,
          creative,
          spend,
          impressions,
          clicks,
          ctr,
          cpc,
          cpm,
          leads,
          video3sViews,
          video100Views,
          frequency,
          cr,
          hookRate,
          holdRate,
          mediaType,
          primaryText: creative?.body || creative?.title || "",
          displayName,
        };
      })
      .sort((a, b) => {
        if (b.spend !== a.spend) return b.spend - a.spend;
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        return b.impressions - a.impressions;
      })
      .filter((item) => !isVisitasPanel || item.spend > 0);
  }, [ads, conversasMode, isVisitasPanel, isComprasPanel]);

  const [modalAdId, setModalAdId] = React.useState<string | null>(null);
  const [modalFallback, setModalFallback] = React.useState(false);

  React.useEffect(() => {
    setModalFallback(false);
  }, [modalAdId]);

  React.useEffect(() => {
    if (!modalAdId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModalAdId(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modalAdId]);

  const topCtr = React.useMemo(
    () =>
      [...sorted].sort((a, b) => {
        if (b.ctr !== a.ctr) return b.ctr - a.ctr;
        return b.clicks - a.clicks;
      })[0],
    [sorted]
  );
  const totalSpend = sorted.reduce((acc, item) => acc + item.spend, 0);
  const totalImpressions = sorted.reduce((acc, item) => acc + item.impressions, 0);
  const totalClicks = sorted.reduce((acc, item) => acc + item.clicks, 0);
  const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const previewFormat = "MOBILE_FEED_STANDARD" as const;

  if (!sorted.length) {
    return <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Nenhum criativo encontrado.</p>;
  }

  // ── Motor de decisão baseado em CPL ──────────────────────────────────────────
  const totalLeads = sorted.reduce((acc, d) => acc + d.leads, 0);
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  // CPL Alvo = média ponderada por investimento entre criativos com leads
  // Se não houver leads ainda, usamos um teto estimado baseado no gasto médio
  const cplAlvo: number = (() => {
    const withLeads = sorted.filter((d) => d.leads > 0);
    if (withLeads.length === 0) return totalSpend / sorted.length || 100;
    const totalSpendWithLeads = withLeads.reduce((a, d) => a + d.spend, 0);
    const totalLeadsWithLeads = withLeads.reduce((a, d) => a + d.leads, 0);
    return totalSpendWithLeads / totalLeadsWithLeads;
  })();
  const cplLimite = cplAlvo * 1.5;

  const scoredItems = sorted
    .map((item) => {
      const cpl = item.leads > 0 ? item.spend / item.leads : Infinity;
      const spShare = totalSpend > 0 ? (item.spend / totalSpend) * 100 : 0;

      // ── Status por CPL + significância estatística ────────────────────────
      let status: "ESCALAR" | "OTIMIZAR" | "PAUSAR" | "VALIDANDO";
      if (item.leads === 0 && item.spend < cplAlvo) {
        status = "VALIDANDO";
      } else if (item.leads === 0 && item.spend >= cplLimite) {
        status = "PAUSAR";
      } else if (item.leads > 0 && cpl <= cplAlvo) {
        status = "ESCALAR";
      } else if (item.leads > 0 && cpl < cplLimite) {
        status = "OTIMIZAR";
      } else if (item.leads > 0 && cpl >= cplLimite) {
        status = "PAUSAR";
      } else {
        status = "VALIDANDO";
      }

      // ── Alertas inteligentes ──────────────────────────────────────────────
      const alerts: string[] = [];

      // Alertas só fazem sentido quando o criativo está com problema
      const isUnderperforming = status === "PAUSAR" || status === "OTIMIZAR";
      const isNotEscalar = status !== "ESCALAR";

      // Falso Positivo (clickbait) — CTR alto mas leads não chegam
      if (isNotEscalar && item.ctr > 1.5 && item.cr < 5 && item.leads > 0 && cpl > cplAlvo) {
        alerts.push("Clickbait: cliques não convertem na LP");
      }
      // Leilão Hostil — só relevante quando o CPM alto está prejudicando resultado
      if (isUnderperforming && avgCpm > 0 && item.cpm > avgCpm * 1.5) {
        alerts.push("CPM alto: rever segmentação ou público");
      }
      // Verba concentrada em criativo ruim — escalar não conta
      if (isUnderperforming && spShare > 35) {
        alerts.push("Verba concentrada em criativo de baixa performance");
      }
      // Oportunidade de escala — criativo bom mas sub-investido
      if (spShare < 10 && (status === "ESCALAR" || status === "VALIDANDO") && item.ctr >= averageCtr) {
        alerts.push("Oportunidade: aumentar verba neste criativo");
      }

      // Vídeo — Hook fraco (só quando o criativo está mal performando)
      if (item.mediaType === "video" && item.hookRate > 0 && item.hookRate < 25 && isUnderperforming) {
        alerts.push("Hook fraco: refaça os primeiros 3s");
      }
      // Vídeo — Conteúdo maçante (bom hook, baixa retenção)
      if (item.mediaType === "video" && item.hookRate >= 25 && item.holdRate > 0 && item.holdRate < 10 && isUnderperforming) {
        alerts.push("Retenção baixa: roteiro perde ritmo no meio");
      }
      // Imagem — Cegueira de banner
      if (item.mediaType === "image" && item.ctr < 0.6 && item.impressions > 2000 && isUnderperforming) {
        alerts.push("Arte ignorável: sem thumbstop no scroll");
      }

      // Score auxiliar (mantém ordenação visual)
      const cplScore = cpl === Infinity ? 0 : Math.max(0, 1 - cpl / (cplLimite * 2));
      const ctrNorm = averageCtr > 0 ? Math.min(1, item.ctr / (averageCtr * 2)) : 0;
      const score = parseFloat((cplScore * 1.4 + ctrNorm * 0.6).toFixed(2));

      return { ...item, cpl, score, status, alerts: alerts.slice(0, 3), spShare };
    })
    .sort((a, b) => {
      // Primeiro: agrupa por status (melhor → pior decisão)
      const order = { ESCALAR: 0, OTIMIZAR: 1, VALIDANDO: 2, PAUSAR: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];

      // Dentro do mesmo status: critério de desempenho específico
      if (a.status === "ESCALAR" || a.status === "OTIMIZAR") {
        // Menor CPL = melhor resultado
        return a.cpl - b.cpl;
      }
      if (a.status === "VALIDANDO") {
        // Maior CTR = mais promissor
        return b.ctr - a.ctr;
      }
      // PAUSAR: maior gasto = mais urgente de pausar
      return b.spend - a.spend;
    });

  const countEscalar = scoredItems.filter((i) => i.status === "ESCALAR").length;
  const countOtimizar = scoredItems.filter((i) => i.status === "OTIMIZAR").length;
  const countPausar = scoredItems.filter((i) => i.status === "PAUSAR").length;
  const countValidando = scoredItems.filter((i) => i.status === "VALIDANDO").length;
  const pausarSpend = scoredItems.filter((i) => i.status === "PAUSAR").reduce((acc, i) => acc + i.spend, 0);
  const pctPausar = totalSpend > 0 ? Math.round((pausarSpend / totalSpend) * 100) : 0;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null;

  const topEscalar = scoredItems.find((i) => i.status === "ESCALAR");
  const metricLabel = convLabels.metric;
  const decisionInsight =
    pctPausar > 30
      ? `${pctPausar}% da verba está em criativos sem retorno — redistribuição urgente para preservar o ${metricLabel}.`
    : countValidando === sorted.length
      ? isComprasPanel
        ? `Ainda sem dados de compras suficientes. Aguarde mais investimento para o sistema avaliar cada criativo.`
        : conversasMode
          ? `Ainda sem dados de conversas suficientes. Aguarde mais investimento para o sistema avaliar cada criativo.`
          : `Ainda sem dados de conversão suficientes. Aguarde mais investimento para o sistema avaliar cada criativo.`
    : countEscalar === 0 && countValidando === 0
      ? isComprasPanel
        ? `Nenhum criativo está batendo a meta de custo por compra. Considere testar novos formatos, textos ou ofertas.`
        : conversasMode
          ? `Nenhum criativo está batendo a meta de custo por conversa. Considere testar novos formatos, textos ou abordagens.`
          : `Nenhum criativo está batendo a meta de CPL. Considere testar novos formatos, textos ou ofertas.`
    : countEscalar >= sorted.length * 0.5
      ? isComprasPanel
        ? `Conjunto saudável: a maioria dos criativos está gerando compras dentro do custo-alvo.`
        : conversasMode
          ? `Conjunto saudável: a maioria dos criativos está gerando conversas dentro do custo-alvo.`
          : `Conjunto saudável: a maioria dos criativos está convertendo dentro da meta de CPL.`
    : countEscalar === 1 && topEscalar
      ? `"${topEscalar.displayName}" é o único dentro da meta — concentre o orçamento nele e contenha o restante.`
    : `${countEscalar} criativos estão dentro da meta de ${metricLabel} — direcione o orçamento para eles.`;

  const modalItem = modalAdId ? scoredItems.find((i) => i.ad.id === modalAdId) ?? null : null;

  const statusConfig = {
    ESCALAR:   { label: "Escalar",      color: "text-green-500",  bg: "bg-green-500/10",  border: "border-green-500/30",  bar: "bg-green-500"  },
    OTIMIZAR:  { label: "Otimizar",     color: "text-amber-500",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  bar: "bg-amber-500"  },
    PAUSAR:    { label: "Pausar",       color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/30",    bar: "bg-red-500"    },
    VALIDANDO: { label: "Em Validação", color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   bar: "bg-blue-400"   },
  };

  return (
    <div className="space-y-5">

      {/* ── Section header — mesma linguagem visual do Semana a Semana ── */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--primary))] text-white shadow-[0_12px_30px_rgba(220,38,38,0.25)]">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Análise de Criativos</p>
          <h2 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)]">
            Criativos{" "}
            <span className="bg-[linear-gradient(90deg,var(--accent),var(--primary))] bg-clip-text text-transparent">META</span>
          </h2>
        </div>
      </div>

      {/* 1. KPI tiles — mesmo estilo do KpiCard do painel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          {
            label: "Em Veiculação",
            value: sorted.length.toLocaleString("pt-BR"),
            sub: "Criativos ativos no período",
            icon: Zap,
            accent: true,
          },
          {
            label: "CTR Médio",
            value: averageCtr > 0 ? `${averageCtr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—",
            sub: "Taxa de clique por impressão",
            icon: MousePointerClick,
            accent: false,
          },
          {
            label: convLabels.kpi,
            value: totalLeads > 0 ? formatCurrency(cplAlvo) : "—",
            sub: "Meta de custo por resultado",
            icon: Target,
            accent: false,
          },
          {
            label: "Retenção Vídeo",
            value: (() => {
              const videos = scoredItems.filter((i) => i.mediaType === "video" && i.video3sViews > 0 && i.holdRate > 0);
              if (!videos.length) return "—";
              const totalHooks = videos.reduce((acc, i) => acc + i.video3sViews, 0);
              const weighted = videos.reduce((acc, i) => acc + i.holdRate * i.video3sViews, 0) / totalHooks;
              return `${weighted.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
            })(),
            sub: "Visualizações 100% / views 3s",
            icon: Film,
            accent: false,
          },
        ] as const).map((kpi) => (
          <Card
            key={kpi.label}
            className="group relative overflow-hidden rounded-2xl border-[var(--border)] transition-all hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.05]" />
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <kpi.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{kpi.label}</p>
                <p className={`mt-1 text-2xl font-extrabold tabular-nums leading-none ${kpi.accent ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                  {kpi.value}
                </p>
                <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">{kpi.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Tabela de criativos */}
      <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)]/60 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--foreground)]">Performance por Criativo</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">Análise individual de cada anúncio no período selecionado.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="pl-6 pr-4 py-3 font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">Criativo</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">Invest.</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">Impr.</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">Cliques</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">{convLabels.chartKey}</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">{convLabels.metric}</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--muted-foreground)]">CTR</th>
                <th className="px-5 py-3 text-center font-semibold uppercase tracking-[0.18em] text-[10px] text-[var(--accent)] bg-[rgba(180,60,10,0.18)]">Taxa Conv.</th>
              </tr>
            </thead>
            <tbody>
              {scoredItems.map((item) => {
                const rawUrl = item.creative?.image_url_full || item.creative?.image_url || item.creative?.video_picture_url || item.creative?.thumbnail_url;
                const thumbUrl = rawUrl ? upgradeFbCdnImageUrl(rawUrl) || rawUrl : null;
                return (
                  <tr
                    key={item.ad.id}
                    className="group cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-white/[0.03]"
                    onClick={() => setModalAdId(item.ad.id)}
                  >
                    {/* Criativo — nome bold + descrição muted */}
                    <td className="relative pl-6 pr-4 py-5">
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-[var(--accent)] opacity-60" />
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--muted)]/30">
                          {thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumbUrl} alt={item.displayName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <BarChart3 className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                            </div>
                          )}
                          {item.mediaType === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="h-3 w-3 text-white drop-shadow" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate font-bold uppercase tracking-wide text-[var(--foreground)]">{item.displayName}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                            {item.mediaType === "video" ? "Vídeo" : "Imagem"} · Clique para detalhes
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Invest. */}
                    <td className="px-5 py-5 text-right tabular-nums text-[var(--foreground)]">
                      <span className="font-semibold">{formatCurrency(item.spend)}</span>
                    </td>
                    {/* Impressões */}
                    <td className="px-5 py-5 text-right tabular-nums text-[var(--muted-foreground)]">
                      {item.impressions > 0 ? item.impressions.toLocaleString("pt-BR") : <span className="opacity-40">—</span>}
                    </td>
                    {/* Cliques */}
                    <td className="px-5 py-5 text-right tabular-nums text-[var(--muted-foreground)]">
                      {item.clicks > 0 ? item.clicks.toLocaleString("pt-BR") : <span className="opacity-40">—</span>}
                    </td>
                    {/* Leads / resultado */}
                    <td className="px-5 py-5 text-right tabular-nums font-bold text-[var(--foreground)]">
                      {item.leads > 0 ? item.leads.toLocaleString("pt-BR") : <span className="font-normal opacity-40">—</span>}
                    </td>
                    {/* CPL / custo */}
                    <td className="px-5 py-5 text-right tabular-nums">
                      {item.leads > 0 ? (
                        <span className={`font-bold ${item.cpl <= cplAlvo ? "text-green-400" : item.cpl < cplLimite ? "text-amber-400" : "text-red-400"}`}>
                          {formatCurrency(item.cpl)}
                        </span>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
                    </td>
                    {/* CTR */}
                    <td className="px-5 py-5 text-right tabular-nums text-[var(--foreground)]">{item.ctr.toFixed(2)}%</td>
                    {/* Taxa de Conversão — coluna em destaque */}
                    <td className="px-5 py-5 text-center tabular-nums bg-[rgba(180,60,10,0.15)] group-hover:bg-[rgba(180,60,10,0.22)] transition-colors">
                      {item.leads > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-lg font-black leading-none text-[var(--accent)]">{item.cr.toFixed(1)}%</span>
                          <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--accent)]/60">conv.</span>
                        </div>
                      ) : (
                        <span className="text-[var(--muted-foreground)] opacity-40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Distribuição de verba */}
      <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="flex items-start gap-4 border-b border-[var(--border)]/60 px-6 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--primary))] text-white shadow-[0_12px_30px_rgba(220,38,38,0.25)]">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Criativos META</p>
            <h2 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)]">
              Distribuição{" "}
              <span className="bg-[linear-gradient(90deg,var(--accent),var(--primary))] bg-clip-text text-transparent">de Verba</span>
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">Participação de cada criativo no investimento total do período.</p>
          </div>
        </div>
        <div className="space-y-3 p-6">
          {[...scoredItems].sort((a, b) => b.spend - a.spend).map((item) => {
            const cfg = statusConfig[item.status];
            return (
              <div
                key={item.ad.id}
                className="group flex cursor-pointer items-center gap-4"
                onClick={() => setModalAdId(item.ad.id)}
              >
                <span
                  className="w-24 shrink-0 truncate text-[11px] font-medium text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)] sm:w-36"
                  title={item.displayName}
                >
                  {item.displayName}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all ${cfg.bar} opacity-70 group-hover:opacity-100`}
                    style={{ width: `${item.spShare}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--foreground)] sm:w-24">{formatCurrency(item.spend)}</span>
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[var(--muted-foreground)]">{item.spShare.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Plano de ação */}
      {(() => {
        const acaoEscalar = scoredItems.filter((i) => i.status === "ESCALAR");
        const acaoPausar  = scoredItems.filter((i) => i.status === "PAUSAR");
        const acaoOtimizar = scoredItems.filter((i) => i.status === "OTIMIZAR");
        const verbaPausar = acaoPausar.reduce((acc, i) => acc + i.spend, 0);
        const hasPlan = acaoEscalar.length > 0 || acaoPausar.length > 0 || acaoOtimizar.length > 0;
        if (!hasPlan) return null;
        return (
          <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <div className="flex items-start gap-4 border-b border-[var(--border)]/60 px-6 py-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--primary))] text-white shadow-[0_12px_30px_rgba(220,38,38,0.25)]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Criativos META</p>
                <h2 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)]">
                  Plano{" "}
                  <span className="bg-[linear-gradient(90deg,var(--accent),var(--primary))] bg-clip-text text-transparent">de Ação</span>
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">Recomendações automáticas baseadas na performance do período.</p>
              </div>
            </div>
              <div className="p-6 space-y-5">

                {/* Escalar */}
                {acaoEscalar.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-green-500">↑ Aumentar verba</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {acaoEscalar.map((item) => (
                        <button
                          key={item.ad.id}
                          type="button"
                          onClick={() => setModalAdId(item.ad.id)}
                          className="flex items-center gap-3 rounded-xl border border-green-500/25 bg-green-500/6 px-4 py-3 text-left transition hover:border-green-500/50 hover:bg-green-500/10"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-500 text-[11px] font-bold">↑</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[var(--foreground)]">{item.displayName}</p>
                            <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                              {convLabels.metric} {formatCurrency(item.cpl)} · {item.leads} {convLabels.singular}{item.leads > 1 && !convLabels.singular.endsWith(".") ? "s" : ""} · CTR {item.ctr.toFixed(2)}%
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium text-green-500">Top performer</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Otimizar */}
                {acaoOtimizar.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-500">⟳ Otimizar</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {acaoOtimizar.map((item) => (
                        <button
                          key={item.ad.id}
                          type="button"
                          onClick={() => setModalAdId(item.ad.id)}
                          className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/6 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-amber-500/10"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 text-[11px] font-bold">⟳</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[var(--foreground)]">{item.displayName}</p>
                            <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                              {convLabels.metric} {formatCurrency(item.cpl)} · acima da meta de {formatCurrency(cplAlvo)}
                            </p>
                          </div>
                          {item.alerts[0] && (
                            <span className="shrink-0 max-w-[100px] text-right text-[9px] font-medium text-amber-400 leading-tight">{item.alerts[0]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pausar */}
                {acaoPausar.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-500">✕ Pausar</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {acaoPausar.map((item) => (
                        <button
                          key={item.ad.id}
                          type="button"
                          onClick={() => setModalAdId(item.ad.id)}
                          className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/6 px-4 py-3 text-left transition hover:border-red-500/50 hover:bg-red-500/10"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500 text-[11px] font-bold">✕</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[var(--foreground)]">{item.displayName}</p>
                            <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                              {formatCurrency(item.spend)} investido{item.leads === 0 ? ` ${convLabels.semResult}` : ` · ${convLabels.metric} ${formatCurrency(item.cpl)}`}
                            </p>
                          </div>
                          {item.alerts[0] ? (
                            <span className="shrink-0 max-w-[100px] text-right text-[9px] font-medium text-red-400 leading-tight">{item.alerts[0]}</span>
                          ) : (
                            <span className="shrink-0 text-[9px] font-medium text-red-400">Sem resultado</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Redistribuição */}
                {verbaPausar > 0 && acaoEscalar.length > 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/8 px-4 py-3">
                    <span className="text-base">→</span>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Redistribuir{" "}
                      <span className="font-bold text-[var(--foreground)]">{formatCurrency(verbaPausar)}</span>
                      {" "}dos criativos pausados para{" "}
                      <span className="font-bold text-green-500">{acaoEscalar.map((i) => i.displayName).join(", ")}</span>
                    </p>
                  </div>
                )}

              </div>
            </div>
        );
      })()}

      {/* Modal de criativo */}
      {modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalAdId(null); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="font-bold text-[var(--foreground)]">{modalItem.displayName}</p>
                <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                  {modalItem.mediaType === "video" ? "Vídeo" : "Imagem"}{modalItem.leads > 0 ? ` · ${modalItem.leads} lead${modalItem.leads > 1 ? "s" : ""} · CPL ${formatCurrency(modalItem.cpl)}` : " · sem leads"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusConfig[modalItem.status].color} ${statusConfig[modalItem.status].bg} ${statusConfig[modalItem.status].border}`}>
                  {statusConfig[modalItem.status].label}
                </span>
                <button
                  type="button"
                  onClick={() => setModalAdId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 md:flex-row md:gap-6">
              <div className="shrink-0 flex justify-center md:block">
                {modalFallback && (
                  <p className="mb-2 text-center text-[10px] text-[var(--muted-foreground)]">
                    Mídia alternativa.{" "}
                    <button type="button" onClick={() => setModalFallback(false)} className="font-medium text-[var(--primary)] underline underline-offset-2">
                      Prévia Meta
                    </button>
                  </p>
                )}
                <CriativoPreview
                  creative={modalItem.creative}
                  creativeId={modalItem.creative?.id}
                  adId={modalItem.ad.id}
                  alt={modalItem.displayName}
                  mode="featured"
                  priority
                  adFormat={previewFormat}
                  useFallback={modalFallback}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {/* Investimento — destaque */}
                <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/8 px-4 py-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--primary)]/80">Investimento</p>
                  <p className="text-xl font-bold tabular-nums text-[var(--primary)]">{formatCurrency(modalItem.spend)}</p>
                </div>

                {/* Funil: Alcance → Engajamento → Resultado */}
                {[
                  {
                    label: "Alcance",
                    cols: [
                      { label: "Impressões", value: modalItem.impressions.toLocaleString("pt-BR") },
                      { label: "CPM", value: modalItem.impressions > 0 ? formatCurrency(modalItem.cpm) : "—" },
                      { label: "Frequência", value: modalItem.frequency > 0 ? modalItem.frequency.toFixed(1) : "—" },
                    ],
                  },
                  {
                    label: "Engajamento",
                    cols: [
                      { label: "Cliques", value: modalItem.clicks > 0 ? modalItem.clicks.toLocaleString("pt-BR") : "—" },
                      { label: "CTR", value: `${modalItem.ctr.toFixed(2)}%` },
                      { label: "CPC", value: modalItem.clicks > 0 ? formatCurrency(modalItem.cpc) : "—" },
                    ],
                  },
                  {
                    label: "Resultado",
                    cols: [
                      { label: convLabels.chartKey, value: modalItem.leads > 0 ? modalItem.leads.toLocaleString("pt-BR") : "—" },
                      { label: convLabels.crLabel, value: modalItem.leads > 0 ? `${modalItem.cr.toFixed(1)}%` : "—" },
                      { label: convLabels.metric, value: modalItem.leads > 0 ? formatCurrency(modalItem.cpl) : "—" },
                    ],
                  },
                ].map((section) => (
                  <div key={section.label}>
                    <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">{section.label}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {section.cols.map((m) => (
                        <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3 text-center">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{m.label}</p>
                          <p className="mt-1 text-sm font-bold tabular-nums text-[var(--foreground)]">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Métricas de vídeo */}
                {modalItem.mediaType === "video" && (modalItem.hookRate > 0 || modalItem.holdRate > 0) && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Performance de Vídeo</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Hook Rate",
                          desc: "Visualizações 3s / Impressões",
                          value: modalItem.hookRate > 0 ? `${modalItem.hookRate.toFixed(1)}%` : "—",
                          color: modalItem.hookRate >= 25 ? "text-green-500" : modalItem.hookRate >= 15 ? "text-amber-500" : "text-red-400",
                        },
                        {
                          label: "Hold Rate",
                          desc: "Conclusões 100% / Visualizações 3s",
                          value: modalItem.holdRate > 0 ? `${modalItem.holdRate.toFixed(1)}%` : "—",
                          color: modalItem.holdRate >= 20 ? "text-green-500" : modalItem.holdRate >= 10 ? "text-amber-500" : "text-red-400",
                        },
                      ].map((m) => (
                        <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3 text-center">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{m.label}</p>
                          <p className="text-[8px] text-[var(--muted-foreground)]/60">{m.desc}</p>
                          <p className={`mt-1 text-sm font-bold tabular-nums ${m.color}`}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {modalItem.primaryText && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Texto do anúncio</p>
                    <p className="text-sm leading-relaxed text-[var(--foreground)]">{modalItem.primaryText}</p>
                  </div>
                )}
                {modalItem.alerts.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Diagnóstico</p>
                    <div className="flex flex-wrap gap-1.5">
                      {modalItem.alerts.map((a) => (
                        <span key={a} className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-1.5 text-xs font-medium text-amber-400">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Pauta da Semana — Task Manager ─── */

type Tarefa = {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  dataFim: string | null;
  createdAt: string;
};

const PRIO_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ALTA:  { label: "Alta",  color: "text-[var(--primary)]",  dot: "bg-[var(--primary)]" },
  MEDIA: { label: "Média", color: "text-amber-400",          dot: "bg-amber-400" },
  BAIXA: { label: "Baixa", color: "text-[var(--muted-foreground)]", dot: "bg-[var(--muted-foreground)]" },
};

function formatDateBR(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isOverdue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}

function PautaDaSemana({ clienteId }: { clienteId: string }) {
  const [titulo, setTitulo] = React.useState("");
  const [prioridade, setPrioridade] = React.useState("MEDIA");
  const [dataFim, setDataFim] = React.useState("");
  const [showConcluidas, setShowConcluidas] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["pautas", clienteId],
    queryFn: () =>
      fetch(`/api/clientes/${clienteId}/pautas`).then((r) => (r.ok ? r.json() : [])),
  });

  const abertas = tarefas.filter((t) => t.status === "ABERTA");
  const concluidas = tarefas.filter((t) => t.status === "CONCLUIDA");

  const addMutation = useMutation({
    mutationFn: (body: { titulo: string; prioridade: string; dataFim?: string }) =>
      fetch(`/api/clientes/${clienteId}/pautas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pautas", clienteId] });
      setTitulo("");
      setPrioridade("MEDIA");
      setDataFim("");
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tarefa> }) =>
      fetch(`/api/clientes/${clienteId}/pautas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pautas", clienteId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/clientes/${clienteId}/pautas/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pautas", clienteId] }),
  });

  function handleAdd() {
    const t = titulo.trim();
    if (!t) return;
    addMutation.mutate({ titulo: t, prioridade, dataFim: dataFim || undefined });
  }

  function TarefaRow({ tarefa, done }: { tarefa: Tarefa; done: boolean }) {
    const prio = PRIO_CONFIG[tarefa.prioridade] ?? PRIO_CONFIG.MEDIA;
    const overdue = !done && isOverdue(tarefa.dataFim);
    return (
      <li className={`group flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${done ? "border-[var(--border)]/50 bg-transparent opacity-60" : "border-[var(--border)] bg-[var(--muted)]/20 hover:bg-[var(--muted)]/40"}`}>
        {/* Complete / undo button */}
        <button
          title={done ? "Reabrir tarefa" : "Concluir tarefa"}
          onClick={() => patchMutation.mutate({ id: tarefa.id, data: { status: done ? "ABERTA" : "CONCLUIDA" } })}
          className="mt-0.5 shrink-0 text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
        >
          {done ? <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" /> : <Circle className="h-4 w-4" />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <span className={`break-words leading-snug ${done ? "line-through text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}>
            {tarefa.titulo}
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {/* Priority */}
            <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${prio.color}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${prio.dot}`} />
              {prio.label}
            </span>
            {/* Due date */}
            {tarefa.dataFim && (
              <span className={`flex items-center gap-1 text-[10px] ${overdue ? "text-red-400 font-semibold" : "text-[var(--muted-foreground)]"}`}>
                <Clock className="h-3 w-3" />
                {overdue ? "Vencida · " : ""}{formatDateBR(tarefa.dataFim)}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          title="Apagar tarefa"
          onClick={() => deleteMutation.mutate(tarefa.id)}
          className="mt-0.5 shrink-0 text-[var(--muted-foreground)] opacity-0 transition hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </li>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-[var(--primary)]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
                Acompanhamento estratégico
              </p>
              <CardTitle className="mt-0">Pauta da Semana</CardTitle>
            </div>
          </div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
            {abertas.length} aberta{abertas.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Add form ── */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Descreva a tarefa ou pauta..."
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm transition-colors focus:border-[var(--primary)]/50 focus:outline-none"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Priority */}
            <div className="relative flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5 pl-2 pr-6 text-xs appearance-none focus:outline-none focus:border-[var(--primary)]/50 cursor-pointer"
              >
                <option value="ALTA">Alta prioridade</option>
                <option value="MEDIA">Média prioridade</option>
                <option value="BAIXA">Baixa prioridade</option>
              </select>
            </div>
            {/* Due date */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5 px-2 text-xs focus:outline-none focus:border-[var(--primary)]/50 cursor-pointer [color-scheme:dark]"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!titulo.trim() || addMutation.isPending}
              className="ml-auto rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
            >
              {addMutation.isPending ? "…" : "+ Adicionar"}
            </button>
          </div>
        </div>

        {/* ── Open tasks ── */}
        {abertas.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
            Nenhuma tarefa em aberto. Adicione uma acima.
          </p>
        ) : (
          <ul className="space-y-2">
            {abertas.map((t) => <TarefaRow key={t.id} tarefa={t} done={false} />)}
          </ul>
        )}

        {/* ── Completed tasks (collapsible) ── */}
        {concluidas.length > 0 && (
          <div>
            <button
              onClick={() => setShowConcluidas((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showConcluidas ? "" : "-rotate-90"}`} />
              {concluidas.length} concluída{concluidas.length !== 1 ? "s" : ""}
            </button>
            {showConcluidas && (
              <ul className="mt-2 space-y-2">
                {concluidas.map((t) => <TarefaRow key={t.id} tarefa={t} done={true} />)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
