"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertTriangle, Search, TrendingUp, MousePointerClick, Eye, Wallet, Percent, BarChart3 } from "lucide-react";

export interface KeywordAnalysis {
  text: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpl: number;
  ctr: number;
  avgCpc: number;
  decision: "escalar" | "otimizar" | "pausar" | "revisar" | "neutro";
}

export interface GoogleKeywordsResponse {
  keywords: KeywordAnalysis[];
  totals: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    cpl: number;
    ctr: number;
  };
  dateFrom: string;
  dateTo: string;
  error?: string;
}

interface Props {
  data: GoogleKeywordsResponse;
  formatCurrency: (v: number) => string;
  isLoading?: boolean;
}

const DECISION_CONFIG = {
  escalar:  { label: "Escalar",  dot: "bg-green-500", badge: "bg-green-500/10  text-green-500  border-green-500/20"  },
  otimizar: { label: "Otimizar", dot: "bg-amber-500", badge: "bg-amber-500/10  text-amber-500  border-amber-500/20"  },
  pausar:   { label: "Pausar",   dot: "bg-red-500",   badge: "bg-red-500/10    text-red-500    border-red-500/20"    },
  revisar:  { label: "Revisar",  dot: "bg-blue-400",  badge: "bg-blue-500/10   text-blue-400   border-blue-500/20"   },
  neutro:   { label: "Neutro",   dot: "bg-[var(--muted-foreground)]", badge: "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]" },
};

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function GoogleKeywordsPanel({ data, formatCurrency, isLoading }: Props) {
  const [sortBy, setSortBy] = React.useState<"impressions" | "clicks" | "cost" | "conversions" | "cpl" | "ctr">("conversions");
  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc");

  const { keywords, totals } = data;

  const sorted = React.useMemo(() => {
    return [...keywords].sort((a, b) => {
      const diff = (a[sortBy] as number) - (b[sortBy] as number);
      return sortDir === "desc" ? -diff : diff;
    });
  }, [keywords, sortBy, sortDir]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--card)]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--card)]" />
      </div>
    );
  }

  /* ── Error / empty ── */
  if (data.error && keywords.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-[var(--muted-foreground)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">Palavras-chave indisponíveis</p>
        <p className="max-w-sm text-xs text-[var(--muted-foreground)]">{data.error}</p>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
        <Search className="h-8 w-8 text-[var(--muted-foreground)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">Nenhuma palavra-chave encontrada</p>
        <p className="text-xs text-[var(--muted-foreground)]">Não há dados de keywords para o período selecionado.</p>
      </div>
    );
  }

  const cols: { key: typeof sortBy; label: string }[] = [
    { key: "impressions", label: "Impr."       },
    { key: "clicks",      label: "Cliques"     },
    { key: "ctr",         label: "CTR"         },
    { key: "cost",        label: "Custo"       },
    { key: "conversions", label: "Conv."       },
    { key: "cpl",         label: "Custo/Conv." },
  ];

  return (
    <div className="space-y-6">

      {/* ── Section header ── */}
      <div className="flex items-start gap-3">
        <div className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Google Ads</p>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">Análise de Palavras-chave</h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {keywords.length} termo{keywords.length !== 1 ? "s" : ""} com impressões
            {data.dateFrom ? ` · ${data.dateFrom} → ${data.dateTo}` : ""}
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([
          { label: "Impressões",   value: fmt(totals.impressions),                           icon: Eye,               accent: false },
          { label: "Cliques",      value: fmt(totals.clicks),                                icon: MousePointerClick, accent: false },
          { label: "CTR Médio",    value: `${fmt(totals.ctr, 2)}%`,                          icon: Percent,           accent: false },
          { label: "Investimento", value: formatCurrency(totals.cost),                       icon: Wallet,            accent: false },
          { label: "Conversões",   value: fmt(totals.conversions, 1),                        icon: TrendingUp,        accent: true  },
          { label: "CPL Médio",    value: totals.cpl > 0 ? formatCurrency(totals.cpl) : "—", icon: TrendingUp,        accent: true  },
        ] as const).map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className="group relative overflow-hidden rounded-2xl border-[var(--border)] transition-all hover:border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.05]" />
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] leading-tight">{label}</p>
              </div>
              <p className={`text-lg font-extrabold tabular-nums leading-none truncate ${accent ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabela — card flutuante ── */}
      <Card className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <CardHeader className="border-b border-[var(--border)]/60 px-6 pb-4 pt-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--accent),var(--primary))] text-white">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--foreground)]">
                  Detalhamento de palavras-chave
                </h3>
                <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                  {sorted.length} termo{sorted.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground)]">
              Ordenar: {cols.find((c) => c.key === sortBy)?.label} {sortDir === "desc" ? "↓" : "↑"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-4 pt-3 sm:px-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate [border-spacing:0_6px]">
              <thead>
                <tr>
                  <th className="w-[190px] px-4 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                    Palavra-chave / Tipo
                  </th>
                  <th className="px-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                    Campanha
                  </th>
                  {cols.map(({ key, label }) => {
                    const active = sortBy === key;
                    return (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className={`cursor-pointer select-none px-4 pb-1 text-right text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors
                          ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                      >
                        {label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                      </th>
                    );
                  })}
                  <th className="px-4 pb-1 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                    Decisão
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((kw, i) => {
                  const cfg = DECISION_CONFIG[kw.decision];
                  return (
                    <tr key={`${kw.text}-${kw.matchType}-${i}`} className="group">
                      <td className="rounded-l-2xl bg-white/[0.03] px-4 py-3.5 transition-colors group-hover:bg-white/[0.05]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">{kw.text}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">Corresp. {kw.matchType}</p>
                      </td>
                      <td className="max-w-[150px] bg-white/[0.03] px-3 py-3.5 transition-colors group-hover:bg-white/[0.05]">
                        <p className="truncate text-xs text-[var(--muted-foreground)]">{kw.campaignName}</p>
                      </td>
                      <td className="bg-white/[0.03] px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-white/[0.05]">
                        <span className="text-sm font-semibold text-[var(--foreground)]">{fmt(kw.impressions)}</span>
                      </td>
                      <td className="bg-white/[0.03] px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-white/[0.05]">
                        <span className="text-sm font-semibold text-[var(--foreground)]">{fmt(kw.clicks)}</span>
                      </td>
                      <td className="bg-white/[0.03] px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-white/[0.05]">
                        <span className="text-sm font-semibold text-[var(--foreground)]">{fmt(kw.ctr, 2)}%</span>
                      </td>
                      <td className="bg-white/[0.03] px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-white/[0.05]">
                        <span className="text-sm font-semibold text-[var(--foreground)]">{formatCurrency(kw.cost)}</span>
                      </td>
                      <td className="bg-white/[0.03] px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-white/[0.05]">
                        <span className={`text-sm font-bold ${kw.conversions > 0 ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
                          {fmt(kw.conversions, 1)}
                        </span>
                      </td>
                      <td className="bg-white/[0.03] px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-white/[0.05]">
                        <span className={`text-sm font-semibold ${kw.cpl > 0 ? "text-green-400" : "text-[var(--muted-foreground)]"}`}>
                          {kw.cpl > 0 ? formatCurrency(kw.cpl) : "—"}
                        </span>
                      </td>
                      <td className="rounded-r-2xl bg-white/[0.03] px-4 py-3.5 text-right transition-colors group-hover:bg-white/[0.05]">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals */}
                <tr>
                  <td className="rounded-l-2xl bg-white/[0.06] px-4 py-3.5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--foreground)]">Total</p>
                  </td>
                  <td className="bg-white/[0.06] px-3 py-3.5" />
                  <td className="bg-white/[0.06] px-4 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-black text-[var(--foreground)]">{fmt(totals.impressions)}</span>
                  </td>
                  <td className="bg-white/[0.06] px-4 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-black text-[var(--foreground)]">{fmt(totals.clicks)}</span>
                  </td>
                  <td className="bg-white/[0.06] px-4 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-black text-[var(--foreground)]">{fmt(totals.ctr, 2)}%</span>
                  </td>
                  <td className="bg-white/[0.06] px-4 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-black text-[var(--foreground)]">{formatCurrency(totals.cost)}</span>
                  </td>
                  <td className="bg-white/[0.06] px-4 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-black text-[var(--primary)]">{fmt(totals.conversions, 1)}</span>
                  </td>
                  <td className="bg-white/[0.06] px-4 py-3.5 text-right tabular-nums">
                    <span className="text-sm font-black text-green-400">{totals.cpl > 0 ? formatCurrency(totals.cpl) : "—"}</span>
                  </td>
                  <td className="rounded-r-2xl bg-white/[0.06] px-4 py-3.5" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
