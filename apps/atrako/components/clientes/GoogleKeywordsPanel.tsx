"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricGrid, MetricTile } from "@/components/ui";
import { AlertTriangle, Search, BarChart3 } from "lucide-react";

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
  revisar:  { label: "Revisar",  dot: "bg-blue-400",  badge: "bg-blue-500/10   text-primary   border-blue-500/20"   },
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
        <p className="type-caption-strong text-[var(--foreground)]">Palavras-chave indisponíveis</p>
        <p className="max-w-sm type-fine-print text-[var(--muted-foreground)]">{data.error}</p>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
        <Search className="h-8 w-8 text-[var(--muted-foreground)]" />
        <p className="type-caption-strong text-[var(--foreground)]">Nenhuma palavra-chave encontrada</p>
        <p className="type-fine-print text-[var(--muted-foreground)]">Não há dados de keywords para o período selecionado.</p>
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
          <p className="type-micro-legal uppercase text-[var(--primary)]">Google Ads</p>
          <h2 className="type-tagline text-[var(--foreground)]">Análise de Palavras-chave</h2>
          <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
            {keywords.length} termo{keywords.length !== 1 ? "s" : ""} com impressões
            {data.dateFrom ? ` · ${data.dateFrom} → ${data.dateTo}` : ""}
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <MetricGrid>
        {([
          { label: "Impressões", value: fmt(totals.impressions) },
          { label: "Cliques", value: fmt(totals.clicks) },
          { label: "CTR Médio", value: `${fmt(totals.ctr, 2)}%` },
          { label: "Investimento", value: formatCurrency(totals.cost) },
          { label: "Conversões", value: fmt(totals.conversions, 1) },
          { label: "CPL Médio", value: totals.cpl > 0 ? formatCurrency(totals.cpl) : "—" },
        ]).map((kpi) => (
          <MetricTile key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </MetricGrid>

      {/* ── Tabela — card flutuante ── */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 px-6 pb-4 pt-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="type-caption-strong uppercase text-[var(--foreground)]">
                  Detalhamento de palavras-chave
                </h3>
                <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                  {sorted.length} termo{sorted.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 type-caption-strong uppercase text-[var(--foreground)]">
              Ordenar: {cols.find((c) => c.key === sortBy)?.label} {sortDir === "desc" ? "↓" : "↑"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-4 pt-3 sm:px-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate [border-spacing:0_6px]">
              <thead>
                <tr>
                  <th className="w-[190px] px-4 pb-1 text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
                    Palavra-chave / Tipo
                  </th>
                  <th className="px-3 pb-1 text-left type-micro-legal uppercase text-[var(--muted-foreground)]">
                    Campanha
                  </th>
                  {cols.map(({ key, label }) => {
                    const active = sortBy === key;
                    return (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className={`cursor-pointer select-none px-4 pb-1 text-right type-micro-legal uppercase transition-colors
                          ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                      >
                        {label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                      </th>
                    );
                  })}
                  <th className="px-4 pb-1 text-right type-micro-legal uppercase text-[var(--muted-foreground)]">
                    Decisão
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((kw, i) => {
                  const cfg = DECISION_CONFIG[kw.decision];
                  return (
                    <tr key={`${kw.text}-${kw.matchType}-${i}`} className="group">
                      <td className="rounded-l-2xl bg-pearl px-4 py-3.5 transition-colors group-hover:bg-parchment">
                        <p className="type-caption-strong uppercase text-[var(--foreground)]">{kw.text}</p>
                        <p className="mt-0.5 type-micro-legal text-[var(--muted-foreground)]">Corresp. {kw.matchType}</p>
                      </td>
                      <td className="max-w-[150px] bg-pearl px-3 py-3.5 transition-colors group-hover:bg-parchment">
                        <p className="truncate type-fine-print text-[var(--muted-foreground)]">{kw.campaignName}</p>
                      </td>
                      <td className="bg-pearl px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-parchment">
                        <span className="type-caption-strong text-[var(--foreground)]">{fmt(kw.impressions)}</span>
                      </td>
                      <td className="bg-pearl px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-parchment">
                        <span className="type-caption-strong text-[var(--foreground)]">{fmt(kw.clicks)}</span>
                      </td>
                      <td className="bg-pearl px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-parchment">
                        <span className="type-caption-strong text-[var(--foreground)]">{fmt(kw.ctr, 2)}%</span>
                      </td>
                      <td className="bg-pearl px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-parchment">
                        <span className="type-caption-strong text-[var(--foreground)]">{formatCurrency(kw.cost)}</span>
                      </td>
                      <td className="bg-pearl px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-parchment">
                        <span className={`type-caption-strong ${kw.conversions > 0 ?"text-[var(--primary)]" :"text-[var(--muted-foreground)]"}`}>
                          {fmt(kw.conversions, 1)}
                        </span>
                      </td>
                      <td className="bg-pearl px-4 py-3.5 text-right tabular-nums transition-colors group-hover:bg-parchment">
                        <span className={`type-caption-strong ${kw.cpl > 0 ?"text-positive" :"text-[var(--muted-foreground)]"}`}>
                          {kw.cpl > 0 ? formatCurrency(kw.cpl) : "—"}
                        </span>
                      </td>
                      <td className="rounded-r-2xl bg-pearl px-4 py-3.5 text-right transition-colors group-hover:bg-parchment">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 type-micro-legal uppercase ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals */}
                <tr>
                  <td className="rounded-l-2xl bg-parchment px-4 py-3.5">
                    <p className="type-caption-strong uppercase text-[var(--foreground)]">Total</p>
                  </td>
                  <td className="bg-parchment px-3 py-3.5" />
                  <td className="bg-parchment px-4 py-3.5 text-right tabular-nums">
                    <span className="type-caption-strong text-[var(--foreground)]">{fmt(totals.impressions)}</span>
                  </td>
                  <td className="bg-parchment px-4 py-3.5 text-right tabular-nums">
                    <span className="type-caption-strong text-[var(--foreground)]">{fmt(totals.clicks)}</span>
                  </td>
                  <td className="bg-parchment px-4 py-3.5 text-right tabular-nums">
                    <span className="type-caption-strong text-[var(--foreground)]">{fmt(totals.ctr, 2)}%</span>
                  </td>
                  <td className="bg-parchment px-4 py-3.5 text-right tabular-nums">
                    <span className="type-caption-strong text-[var(--foreground)]">{formatCurrency(totals.cost)}</span>
                  </td>
                  <td className="bg-parchment px-4 py-3.5 text-right tabular-nums">
                    <span className="type-caption-strong text-[var(--primary)]">{fmt(totals.conversions, 1)}</span>
                  </td>
                  <td className="bg-parchment px-4 py-3.5 text-right tabular-nums">
                    <span className="type-caption-strong text-positive">{totals.cpl > 0 ? formatCurrency(totals.cpl) : "—"}</span>
                  </td>
                  <td className="rounded-r-2xl bg-parchment px-4 py-3.5" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
