"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ArrowLeft, BarChart3, Play, Target, Eye, ChevronUp, ChevronDown, ChevronsUpDown, Info } from "lucide-react";
import { AdsetDetailModal } from "@/components/clientes/AdsetDetailModal";
import { upgradeFbCdnImageUrl } from "@/lib/utils";

type DateFilter = {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
};

function buildParams(filter: DateFilter, extra: Record<string, string>) {
  const p = new URLSearchParams();
  p.set("periodo", filter.periodo);
  if (filter.dataInicio) p.set("dataInicio", filter.dataInicio);
  if (filter.dataFim) p.set("dataFim", filter.dataFim);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

function fmt(v: number, decimals = 0) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtBrl(v: number) {
  return "R$\u00a0" + fmt(v, 2);
}
function fmtPct(v: number) {
  return fmt(v, 2) + "%";
}
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

type ResultType = "vendas" | "leads" | "conversas" | "visitas" | "alcance";

interface Campanha {
  nome: string;
  status: "ATIVA" | "PAUSADA" | null;
  diasAtivos: number;
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  purchases: number;
  faturamento: number;
  conversas?: number;
  profileVisits?: number;
  resultType?: ResultType;
  resultados?: number | null;
  custoResultado?: number | null;
  cpl: number | null;
  cpa: number | null;
  ticketMedio: number | null;
  roas: number | null;
  ctr: number | null;
}

interface Conjunto {
  adsetId: string;
  adsetName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  faturamento: number;
  conversas: number;
  adCount: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  cpa: number | null;
  custoConversa: number | null;
  ticketMedio: number | null;
  roas: number | null;
}

interface Criativo {
  adId: string;
  adName: string;
  mediaType: string;
  imageUrl: string | null;
  videoId: string | null;
  videoSourceUrl: string | null;
  videoPictureUrl: string | null;
  videoEmbedHtml: string | null;
  body: string | null;
  title: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  faturamento: number;
  conversas: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  cpa: number | null;
  custoConversa: number | null;
  ticketMedio: number | null;
  roas: number | null;
  daysActive: number;
  effectiveStatus: string | null;
}

const rowBg = (isTop: boolean) => isTop ? "bg-[var(--primary)]/[0.07]" : "bg-white/[0.03]";

// ── Campaign type detection ─────────────────────────────────────────────────
type CampType = "vendas" | "leads" | "conversas" | "visitas" | "alcance" | "rmkt" | "eventos" | "outro";

function detectCampType(nome: string, leads: number, purchases: number, c?: Campanha): CampType {
  if (c?.resultType && c.resultType !== "alcance") return c.resultType as CampType;
  if (purchases > 0) return "vendas";
  if (leads > 0) return "leads";
  if ((c?.conversas ?? 0) > 0) return "conversas";
  if ((c?.profileVisits ?? 0) > 0) return "visitas";
  const n = nome.toLowerCase();
  if (/\[venda\]|\bvenda\b|cat[aá]logo|catalog|convers[aã]o|conversion|purchase/.test(n)) return "vendas";
  if (/engajamento|engagement|alcance|reach|awareness|reconhecimento/.test(n)) return "alcance";
  if (/rmkt|retargeting|remarketing|reengaj/.test(n)) return "rmkt";
  if (/evento|events?\b/.test(n)) return "eventos";
  if (/mensagem|message|whatsapp|lead/.test(n)) return "conversas";
  return "outro";
}

const CAMP_TYPE_META: Record<CampType, { label: string; color: string }> = {
  vendas:    { label: "Vendas",          color: "bg-emerald-500/20 text-emerald-400" },
  leads:     { label: "Leads",           color: "bg-[var(--primary)]/20 text-[var(--primary)]" },
  conversas: { label: "Conversas",       color: "bg-sky-500/20 text-sky-300" },
  visitas:   { label: "Visitas ao Perfil", color: "bg-violet-500/20 text-violet-300" },
  alcance:   { label: "Alcance",         color: "bg-white/[0.08] text-white/40" },
  rmkt:      { label: "Remarketing",     color: "bg-violet-500/20 text-violet-400" },
  eventos:   { label: "Eventos",         color: "bg-sky-500/20 text-sky-400" },
  outro:     { label: "Outro",           color: "bg-white/[0.06] text-white/30" },
};
const thClass = "px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.20em] text-[var(--muted-foreground)]";

type SortCol = "nome" | "status" | "diasAtivos" | "investimento" | "impressoes" | "cliques" | "ctr" | "resultados" | "mql" | "custoResultado" | "leads" | "cpl" | "purchases" | "cpa" | "faturamento" | "ticketMedio" | "roas" | "investFaturado";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: SortDir }) {
  if (col !== sortCol) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1 inline-block" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-[var(--primary)] ml-1 inline-block" />
    : <ChevronDown className="w-3 h-3 text-[var(--primary)] ml-1 inline-block" />;
}

function SortTh({ col, label, align = "right", sortCol, sortDir, onSort }: {
  col: string; label: string; align?: "left" | "right";
  sortCol: string; sortDir: SortDir; onSort: (col: string) => void;
}) {
  const active = col === sortCol;
  return (
    <th
      className={`px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.20em] cursor-pointer select-none whitespace-nowrap text-${align} transition-colors ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );
}

function sortCampanhas(arr: Campanha[], col: SortCol, dir: SortDir): Campanha[] {
  return [...arr].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (col === "nome") { va = a.nome; vb = b.nome; }
    else if (col === "status") {
      const rank = (s: string | null) => s === "ATIVA" ? 0 : s === "PAUSADA" ? 1 : 2;
      va = rank(a.status); vb = rank(b.status);
    }
    else if (col === "diasAtivos") { va = a.diasAtivos; vb = b.diasAtivos; }
    else if (col === "cpl") { va = a.cpl ?? Infinity; vb = b.cpl ?? Infinity; }
    else if (col === "cpa") { va = a.cpa ?? Infinity; vb = b.cpa ?? Infinity; }
    else if (col === "roas") { va = a.roas ?? -Infinity; vb = b.roas ?? -Infinity; }
    else if (col === "ctr") { va = a.ctr ?? -Infinity; vb = b.ctr ?? -Infinity; }
    else if (col === "investFaturado") {
      // % Investimento / Faturamento — menor é melhor; sem faturamento vai pro fim
      va = (a.faturamento ?? 0) > 0 ? a.investimento / a.faturamento : Infinity;
      vb = (b.faturamento ?? 0) > 0 ? b.investimento / b.faturamento : Infinity;
    }
    else if (col === "ticketMedio") { va = a.ticketMedio ?? -Infinity; vb = b.ticketMedio ?? -Infinity; }
    else if (col === "resultados") { va = a.resultados ?? -Infinity; vb = b.resultados ?? -Infinity; }
    else if (col === "custoResultado") { va = a.custoResultado ?? Infinity; vb = b.custoResultado ?? Infinity; }
    else if (col === "mql") { return 0; /* sort de MQL é feito fora (precisa do Map) */ }
    else { va = a[col] as number; vb = b[col] as number; }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function CampanhasTable({ campanhas, onSelect, mqlByCampaignName }: { campanhas: Campanha[]; onSelect: (nome: string) => void; mqlByCampaignName?: Map<string, number> }) {
  const [sortCol, setSortCol] = React.useState<SortCol>("investimento");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  function handleSort(col: string) {
    const c = col as SortCol;
    if (c === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else {
      setSortCol(c);
      const defaultAsc: SortCol[] = ["nome", "cpl", "cpa"];
      setSortDir(defaultAsc.includes(c) ? "asc" : "desc");
    }
  }

  // MQL só faz sentido para campanhas de geração de leads
  const isLeadCamp = (c: Campanha) => detectCampType(c.nome, c.leads, c.purchases, c) === "leads";
  const cappedMql = (c: Campanha) => {
    if (!mqlByCampaignName || !isLeadCamp(c)) return 0;
    const raw = mqlByCampaignName.get(c.nome) ?? 0;
    return c.leads > 0 ? Math.min(raw, c.leads) : 0;
  };

  let sorted = sortCampanhas(campanhas, sortCol, sortDir);
  if (sortCol === "mql" && mqlByCampaignName) {
    sorted = [...campanhas].sort((a, b) => {
      const va = cappedMql(a);
      const vb = cappedMql(b);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }

  const hasResultados = campanhas.some(c => (c.resultados ?? 0) > 0);
  const hasSales = campanhas.some(c => c.purchases > 0 || c.faturamento > 0 || detectCampType(c.nome, c.leads, c.purchases, c) === "vendas");
  const hasLeadCamps = campanhas.some(isLeadCamp);
  const showMqlCol = !!mqlByCampaignName && hasLeadCamps;

  // Label for the Resultado column — pick the predominant result type.
  // "visitas" (visitas ao perfil) é métrica de engajamento e infla muito (uma campanha
  // pode somar dezenas de milhares), então não compete pelo rótulo dominante da coluna.
  // Campanhas de visitas continuam mostrando o sublabel "vis." em sua célula individual.
  const resultTypesCounts = campanhas.reduce<Record<string, number>>((acc, c) => {
    const rt = c.resultType ?? "alcance";
    if (rt === "visitas") return acc;
    acc[rt] = (acc[rt] ?? 0) + (c.resultados ?? 0);
    return acc;
  }, {});
  const dominantResultType = (Object.entries(resultTypesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "leads") as ResultType;
  const resultadoLabel = dominantResultType === "conversas" ? "Conversas" : dominantResultType === "visitas" ? "Visitas" : dominantResultType === "leads" ? "Leads" : dominantResultType === "vendas" ? "Vendas" : "Resultado";
  const custoResultadoLabel = dominantResultType === "conversas" ? "Custo/Conversa" : dominantResultType === "visitas" ? "Custo/Visita" : dominantResultType === "leads" ? "CPL" : dominantResultType === "vendas" ? "CPA" : "Custo/Result.";

  const totals = {
    investimento: sum(campanhas.map(c => c.investimento)),
    impressoes: sum(campanhas.map(c => c.impressoes)),
    cliques: sum(campanhas.map(c => c.cliques)),
    resultados: sum(campanhas.map(c => c.resultados ?? 0)),
    purchases: sum(campanhas.map(c => c.purchases)),
    faturamento: sum(campanhas.map(c => c.faturamento)),
    mql: mqlByCampaignName ? sum(campanhas.map(cappedMql)) : 0,
  };
  const totalCustoResultado = totals.resultados > 0 ? totals.investimento / totals.resultados : null;
  const totalRoas = totals.investimento > 0 && totals.faturamento > 0 ? totals.faturamento / totals.investimento : null;

  const st = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate [border-spacing:0_6px]" style={{ minWidth: hasSales ? 1200 : hasResultados ? 920 : 760 }}>
        <thead>
          <tr>
            <SortTh col="nome" label="Campanha" align="left" {...st} />
            <SortTh col="status" label="Status" align="left" {...st} />
            <SortTh col="diasAtivos" label="Dias" {...st} />
            <SortTh col="investimento" label="Investido" {...st} />
            <SortTh col="impressoes" label="Impressões" {...st} />
            <SortTh col="cliques" label="Cliques" {...st} />
            {hasResultados && <SortTh col="resultados" label={resultadoLabel} {...st} />}
            {showMqlCol && (
              <th
                className={`px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.20em] text-right whitespace-nowrap cursor-pointer select-none transition-colors ${sortCol === "mql" ? "text-emerald-300" : "text-emerald-400 hover:text-emerald-300"}`}
                onClick={() => handleSort("mql")}
                title="Leads qualificados (MQL) — somente para campanhas de geração de leads"
              >
                MQL
                <SortIcon col="mql" sortCol={sortCol} sortDir={sortDir} />
              </th>
            )}
            {hasResultados && <SortTh col="custoResultado" label={custoResultadoLabel} {...st} />}
            {hasSales && <SortTh col="faturamento" label="Faturado" {...st} />}
            {hasSales && <SortTh col="ticketMedio" label="Ticket Médio" {...st} />}
            {hasSales && <SortTh col="roas" label="ROAS" {...st} />}
            {hasSales && <SortTh col="investFaturado" label="I/F" {...st} />}
            <th className="w-8" />
          </tr>
        </thead>

        <tbody>
          {sorted.map((c, i) => {
            const isTop = i === 0;
            const bg = rowBg(isTop);
            const ctype = detectCampType(c.nome, c.leads, c.purchases, c);
            const { label: typeLabel, color: typeColor } = CAMP_TYPE_META[ctype];
            const isNonConversion = ctype === "alcance" || ctype === "eventos";
            const hasResult = (c.resultados ?? 0) > 0;

            return (
              <tr
                key={c.nome}
                className={`group cursor-pointer ${isNonConversion ? "opacity-75 hover:opacity-100 transition-opacity" : ""}`}
                onClick={() => onSelect(c.nome)}
              >
                {/* Campanha name + type badge */}
                <td className={`rounded-l-2xl px-4 py-4 ${bg}`}>
                  <div className="flex items-start gap-2.5">
                    {/* Rank badge */}
                    {isTop ? (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--primary)] mt-0.5">
                        #1
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-white/20 tabular-nums shrink-0 w-5 text-right mt-0.5">
                        #{i + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold leading-snug text-[var(--foreground)] line-clamp-2 max-w-[360px]">
                        {c.nome}
                      </p>
                      {ctype !== "outro" && (
                        <span className={`mt-1 inline-block text-[9px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full ${typeColor}`}>
                          {typeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className={`px-4 py-4 ${bg}`}>
                  {c.status === "ATIVA" ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                      Ativa
                    </span>
                  ) : c.status === "PAUSADA" ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                      Pausada
                    </span>
                  ) : (
                    <span className="text-[11px] text-white/20">—</span>
                  )}
                </td>

                {/* Dias ativos */}
                <td className={`px-4 py-4 text-right tabular-nums ${bg}`}>
                  <span className="text-[13px] font-semibold text-[var(--foreground)]">
                    {c.diasAtivos > 0 ? c.diasAtivos : "—"}
                  </span>
                  {c.diasAtivos > 0 && (
                    <span className="block text-[10px] text-[var(--muted-foreground)] leading-none mt-0.5">
                      {c.diasAtivos === 1 ? "dia" : "dias"}
                    </span>
                  )}
                </td>

                {/* Investido */}
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                  {fmtBrl(c.investimento)}
                </td>

                {/* Impressões */}
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                  {fmt(c.impressoes)}
                </td>

                {/* Cliques */}
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                  {fmt(c.cliques)}
                </td>

                {/* Resultado unificado (conversas / visitas / leads / vendas) */}
                {hasResultados && (
                  <td className={`px-4 py-4 text-right tabular-nums ${bg}`}>
                    {isNonConversion || !hasResult ? (
                      <span className="text-[13px] text-white/20">—</span>
                    ) : (
                      <div>
                        <span className={`text-[14px] font-bold ${isTop ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                          {fmt(c.resultados ?? 0)}
                        </span>
                        {c.resultType && c.resultType !== dominantResultType && (
                          <span className="block text-[9px] text-[var(--muted-foreground)] mt-0.5 leading-none uppercase tracking-wide">
                            {c.resultType === "conversas" ? "conv." : c.resultType === "visitas" ? "vis." : c.resultType === "leads" ? "leads" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                )}

                {/* MQL por campanha — apenas para campanhas de geração de leads */}
                {showMqlCol && (() => {
                  const isLead = isLeadCamp(c);
                  const mql = cappedMql(c);
                  return (
                    <td className={`px-4 py-4 text-right tabular-nums ${bg}`}>
                      {!isLead ? (
                        <span className="text-[13px] text-white/15" title="MQL aplica-se apenas a campanhas de geração de leads">—</span>
                      ) : mql > 0 ? (
                        <span className="text-[14px] font-bold text-emerald-400">{fmt(mql)}</span>
                      ) : (
                        <span className="text-[13px] text-white/20">0</span>
                      )}
                    </td>
                  );
                })()}

                {/* Custo por resultado */}
                {hasResultados && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {isNonConversion || !hasResult ? (
                      <span className="text-white/20">—</span>
                    ) : (
                      c.custoResultado !== null && c.custoResultado !== undefined ? fmtBrl(c.custoResultado) : "—"
                    )}
                  </td>
                )}

                {/* Faturado (apenas para vendas) */}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums ${bg}`}>
                    {isNonConversion ? (
                      <span className="text-[13px] text-white/20">—</span>
                    ) : (
                      <span className={`text-[13px] font-bold ${isTop && c.faturamento > 0 ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                        {c.faturamento > 0 ? fmtBrl(c.faturamento) : "—"}
                      </span>
                    )}
                  </td>
                )}

                {/* Ticket Médio */}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {isNonConversion ? <span className="text-white/20">—</span> : (c.ticketMedio !== null ? fmtBrl(c.ticketMedio) : "—")}
                  </td>
                )}

                {/* ROAS */}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {isNonConversion ? <span className="text-white/20">—</span> : (c.roas !== null ? fmt(c.roas, 2) + "x" : "—")}
                  </td>
                )}

                {/* I/F — Investimento / Faturamento (meta: abaixo de 10%) */}
                {hasSales && (() => {
                  const ratio = (c.faturamento ?? 0) > 0 ? (c.investimento / c.faturamento) * 100 : null;
                  const color =
                    ratio == null
                      ? "text-white/20"
                      : ratio <= 10
                        ? "text-emerald-400 font-semibold"
                        : ratio <= 15
                          ? "text-amber-400 font-semibold"
                          : "text-red-400 font-semibold";
                  return (
                    <td className={`px-4 py-4 text-right tabular-nums text-[13px] ${color} ${bg}`} title="Investimento ÷ Faturamento (meta: abaixo de 10%)">
                      {isNonConversion || ratio == null ? <span className="text-white/20">—</span> : `${fmt(ratio, 2)}%`}
                    </td>
                  );
                })()}

                {/* Chevron */}
                <td className={`rounded-r-2xl px-3 py-4 ${bg}`}>
                  <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-[var(--primary)] transition-colors ml-auto" />
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Totals row */}
        <tfoot>
          <tr>
            <td className="rounded-l-2xl bg-white/[0.06] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">Total</p>
            </td>
            <td className="bg-white/[0.06] px-4 py-3" />
            <td className="bg-white/[0.06] px-4 py-3" />
            <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-semibold text-[var(--foreground)]">
              {fmtBrl(totals.investimento)}
            </td>
            <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-semibold text-[var(--foreground)]">
              {fmt(totals.impressoes)}
            </td>
            <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-semibold text-[var(--foreground)]">
              {fmt(totals.cliques)}
            </td>
            {hasResultados && (
              <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[15px] font-black text-[var(--primary)]">
                {fmt(totals.resultados)}
              </td>
            )}
            {showMqlCol && (
              <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[15px] font-black text-emerald-400">
                {fmt(totals.mql)}
              </td>
            )}
            {hasResultados && (
              <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-semibold text-[var(--foreground)]">
                {totalCustoResultado !== null ? fmtBrl(totalCustoResultado) : "—"}
              </td>
            )}
            {hasSales && (
              <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-bold text-[var(--primary)]">
                {totals.faturamento > 0 ? fmtBrl(totals.faturamento) : "—"}
              </td>
            )}
            {hasSales && (
              <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-semibold text-[var(--foreground)]">
                {totals.purchases > 0 && totals.faturamento > 0 ? fmtBrl(totals.faturamento / totals.purchases) : "—"}
              </td>
            )}
            {hasSales && (
              <td className="bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-semibold text-[var(--foreground)]">
                {totalRoas !== null ? fmt(totalRoas, 2) + "x" : "—"}
              </td>
            )}
            {hasSales && (() => {
              const ratio = totals.faturamento > 0 ? (totals.investimento / totals.faturamento) * 100 : null;
              const color =
                ratio == null
                  ? "text-white/40"
                  : ratio <= 10
                    ? "text-emerald-400"
                    : ratio <= 15
                      ? "text-amber-400"
                      : "text-red-400";
              return (
                <td className={`bg-white/[0.06] px-4 py-3 text-right tabular-nums text-[13px] font-bold ${color}`} title="Investimento ÷ Faturamento (meta: abaixo de 10%)">
                  {ratio == null ? "—" : `${fmt(ratio, 2)}%`}
                </td>
              );
            })()}
            <td className="rounded-r-2xl bg-white/[0.06] px-3 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

type ConjuntoSortCol = "adsetName" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "leads" | "cpl" | "purchases" | "cpa" | "faturamento" | "ticketMedio" | "roas" | "adCount" | "conversas" | "custoConversa";

function sortConjuntos(arr: Conjunto[], col: ConjuntoSortCol, dir: SortDir): Conjunto[] {
  return [...arr].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (col === "adsetName") { va = a.adsetName; vb = b.adsetName; }
    else if (col === "ctr") { va = a.ctr ?? -Infinity; vb = b.ctr ?? -Infinity; }
    else if (col === "cpc") { va = a.cpc ?? Infinity; vb = b.cpc ?? Infinity; }
    else if (col === "cpl") { va = a.cpl ?? Infinity; vb = b.cpl ?? Infinity; }
    else if (col === "cpa") { va = a.cpa ?? Infinity; vb = b.cpa ?? Infinity; }
    else if (col === "roas") { va = a.roas ?? -Infinity; vb = b.roas ?? -Infinity; }
    else if (col === "ticketMedio") { va = a.ticketMedio ?? -Infinity; vb = b.ticketMedio ?? -Infinity; }
    else if (col === "custoConversa") { va = a.custoConversa ?? Infinity; vb = b.custoConversa ?? Infinity; }
    else { va = a[col] as number; vb = b[col] as number; }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function ConjuntosTable({ conjuntos, onSelect, parentCampType, mqlByAdsetId, clienteId, dateFilter }: { conjuntos: Conjunto[]; onSelect: (id: string) => void; parentCampType?: CampType | null; mqlByAdsetId?: Map<string, number>; clienteId: string; dateFilter?: DateFilter }) {
  const [sortCol, setSortCol] = React.useState<ConjuntoSortCol>("spend");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailAdset, setDetailAdset] = React.useState<{ id: string; name: string } | null>(null);

  function handleSort(col: string) {
    const c = col as ConjuntoSortCol;
    if (c === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(c); setSortDir(["adsetName", "cpl", "cpa", "cpc", "custoConversa"].includes(c) ? "asc" : "desc"); }
  }

  const hasLeads = conjuntos.some(c => c.leads > 0) || parentCampType === "leads";
  const hasSales = conjuntos.some(c => c.purchases > 0 || c.faturamento > 0) || parentCampType === "vendas";
  const hasConversas = conjuntos.some(c => (c.conversas ?? 0) > 0) || parentCampType === "conversas";
  const minW = hasSales ? 1120 : (hasLeads && mqlByAdsetId) ? 980 : hasLeads ? 860 : hasConversas ? 900 : 720;
  const sorted = sortConjuntos(conjuntos, sortCol, sortDir);
  const st = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate [border-spacing:0_6px]" style={{ minWidth: minW }}>
        <thead>
          <tr>
            <SortTh col="adsetName" label="Conjunto de Anúncios" align="left" {...st} />
            <SortTh col="spend" label="Investido" {...st} />
            <SortTh col="impressions" label="Impressões" {...st} />
            <SortTh col="clicks" label="Cliques" {...st} />
            <SortTh col="ctr" label="CTR" {...st} />
            <SortTh col="cpc" label="CPC" {...st} />
            {hasLeads && <SortTh col="leads" label="Leads" {...st} />}
            {mqlByAdsetId && hasLeads && (
              <th className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.20em] text-right whitespace-nowrap text-emerald-400">
                MQL
              </th>
            )}
            {hasLeads && <SortTh col="cpl" label="CPL" {...st} />}
            {hasConversas && <SortTh col="conversas" label="Conversas" {...st} />}
            {hasConversas && <SortTh col="custoConversa" label="Custo/Conv" {...st} />}
            {hasSales && <SortTh col="purchases" label="Vendas" {...st} />}
            {hasSales && <SortTh col="cpa" label="CPA" {...st} />}
            {hasSales && <SortTh col="faturamento" label="Faturado" {...st} />}
            {hasSales && <SortTh col="ticketMedio" label="Ticket" {...st} />}
            {hasSales && <SortTh col="roas" label="ROAS" {...st} />}
            <SortTh col="adCount" label="Anúncios" {...st} />
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => {
            const isTop = i === 0;
            const bg = rowBg(isTop);
            return (
              <tr key={c.adsetId} className="group cursor-pointer" onClick={() => onSelect(c.adsetId)}>
                <td className={`rounded-l-2xl px-4 py-4 ${bg}`}>
                  <div className="flex items-center gap-2.5">
                    {isTop ? (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--primary)]">#1</span>
                    ) : (
                      <span className="text-[11px] font-bold text-white/20 tabular-nums shrink-0 w-5 text-right">#{i + 1}</span>
                    )}
                    <p className="text-[12px] font-semibold leading-snug text-[var(--foreground)] line-clamp-2 max-w-[360px]">{c.adsetName}</p>
                  </div>
                </td>
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>{fmtBrl(c.spend)}</td>
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>{fmt(c.impressions)}</td>
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>{fmt(c.clicks)}</td>
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] ${c.ctr !== null && c.ctr >= 1 ? "text-emerald-400 font-semibold" : "text-[var(--muted-foreground)]"} ${bg}`}>
                  {c.ctr !== null ? fmtPct(c.ctr) : "—"}
                </td>
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>{c.cpc !== null ? fmtBrl(c.cpc) : "—"}</td>
                {hasLeads && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] ${isTop && c.leads > 0 ? "text-[var(--primary)] font-bold text-[15px]" : "text-[var(--muted-foreground)]"} ${bg}`}>
                    {c.leads > 0 ? fmt(c.leads) : "—"}
                  </td>
                )}
                {mqlByAdsetId && hasLeads && (() => {
                  const rawMql = mqlByAdsetId.get(c.adsetId) ?? 0;
                  const mql = c.leads > 0 ? Math.min(rawMql, c.leads) : 0;
                  return (
                    <td className={`px-4 py-4 text-right tabular-nums ${bg}`}>
                      {mql > 0
                        ? <span className="text-[14px] font-bold text-emerald-400">{fmt(mql)}</span>
                        : <span className="text-[13px] text-white/20">—</span>}
                    </td>
                  );
                })()}
                {hasLeads && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {c.cpl !== null ? fmtBrl(c.cpl) : "—"}
                  </td>
                )}
                {hasConversas && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] ${isTop && (c.conversas ?? 0) > 0 ? "text-[var(--primary)] font-bold text-[15px]" : (c.conversas ?? 0) > 0 ? "text-sky-300 font-semibold" : "text-white/30"} ${bg}`}>
                    {(c.conversas ?? 0) > 0 ? fmt(c.conversas) : "—"}
                  </td>
                )}
                {hasConversas && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {c.custoConversa !== null ? fmtBrl(c.custoConversa) : "—"}
                  </td>
                )}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] ${isTop && c.purchases > 0 ? "text-[var(--primary)] font-bold text-[15px]" : c.purchases > 0 ? "text-[var(--foreground)]" : "text-white/30"} ${bg}`}>
                    {c.purchases > 0 ? fmt(c.purchases) : "—"}
                  </td>
                )}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {c.cpa !== null ? fmtBrl(c.cpa) : "—"}
                  </td>
                )}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {c.faturamento > 0 ? fmtBrl(c.faturamento) : "—"}
                  </td>
                )}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>
                    {c.ticketMedio !== null ? fmtBrl(c.ticketMedio) : "—"}
                  </td>
                )}
                {hasSales && (
                  <td className={`px-4 py-4 text-right tabular-nums text-[13px] font-semibold ${c.roas !== null && c.roas >= 1 ? "text-emerald-400" : "text-[var(--muted-foreground)]"} ${bg}`}>
                    {c.roas !== null ? fmt(c.roas, 2) + "x" : "—"}
                  </td>
                )}
                <td className={`px-4 py-4 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] ${bg}`}>{c.adCount}</td>
                <td className={`rounded-r-2xl px-2 py-4 ${bg}`}>
                  <div className="flex items-center gap-0.5 justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailAdset({ id: c.adsetId, name: c.adsetName }); }}
                      title="Ver detalhes do conjunto (público, orçamento, período)"
                      className="p-1.5 rounded-lg text-white/20 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-[var(--primary)] transition-colors" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {detailAdset && (
        <AdsetDetailModal
          adsetId={detailAdset.id}
          adsetName={detailAdset.name}
          clienteId={clienteId}
          onClose={() => setDetailAdset(null)}
          dateFrom={dateFilter?.dataInicio}
          dateTo={dateFilter?.dataFim}
        />
      )}
    </div>
  );
}

function VideoModal({ c, onClose }: { c: Criativo; onClose: () => void }) {
  const [iframeBody, setIframeBody] = React.useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = React.useState(false);
  const [iframeFailed, setIframeFailed] = React.useState(false);
  const [metaPreview, setMetaPreview] = React.useState<{ src: string; w: number; h: number } | null>(null);

  const thumb = c.videoPictureUrl ?? c.imageUrl;
  const thumbUpgraded = thumb ? upgradeFbCdnImageUrl(thumb) : null;

  const needsMetaPreview = !c.videoSourceUrl && !c.videoEmbedHtml;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    if (!needsMetaPreview) return;
    setIframeLoading(true);
    fetch(`/api/meta/preview?adId=${encodeURIComponent(c.adId)}&adFormat=MOBILE_FEED_STANDARD`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: { body?: string }) => {
        if (data?.body) setIframeBody(data.body);
        else setIframeFailed(true);
      })
      .catch(() => setIframeFailed(true))
      .finally(() => setIframeLoading(false));
  }, [needsMetaPreview, c.adId]);

  React.useEffect(() => {
    if (!iframeBody) return;
    try {
      const doc = new DOMParser().parseFromString(iframeBody, "text/html");
      const iframe = doc.querySelector("iframe");
      const src = iframe?.getAttribute("src") ?? "";
      const w = parseInt(iframe?.getAttribute("width") ?? "0", 10) || 320;
      const h = parseInt(iframe?.getAttribute("height") ?? "0", 10) || 560;
      if (src) setMetaPreview({ src, w, h });
    } catch { /* ignore */ }
  }, [iframeBody]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[var(--card)] border border-white/[0.08] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <Play className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
          <p className="text-sm font-semibold text-[var(--foreground)] flex-1 min-w-0 truncate">{c.adName}</p>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 p-1"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Video body */}
        <div className="flex items-center justify-center bg-black min-h-[300px]">
          {c.videoSourceUrl ? (
            <video
              src={c.videoSourceUrl}
              poster={thumbUpgraded ?? undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="w-full max-h-[70vh] object-contain"
            />
          ) : c.videoEmbedHtml ? (
            <div
              className="w-full aspect-video"
              dangerouslySetInnerHTML={{ __html: c.videoEmbedHtml }}
            />
          ) : iframeLoading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-[var(--muted-foreground)]">
              <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Carregando prévia do Meta…</p>
            </div>
          ) : metaPreview ? (
            (() => {
              const scale = 320 / metaPreview.w;
              const displayH = Math.round(metaPreview.h * scale);
              return (
                <div style={{ width: 320, height: displayH, overflow: "hidden", position: "relative" }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: metaPreview.w, height: metaPreview.h }}>
                    <iframe
                      title="Prévia do anúncio"
                      src={metaPreview.src}
                      scrolling="no"
                      style={{ border: "none", display: "block", width: metaPreview.w, height: metaPreview.h }}
                    />
                  </div>
                </div>
              );
            })()
          ) : iframeFailed ? (
            <div className="flex flex-col items-center gap-3 py-12 text-[var(--muted-foreground)]">
              {thumbUpgraded
                ? <img src={thumbUpgraded} alt={c.adName} className="w-full max-h-[50vh] object-contain" />
                : <Play className="w-12 h-12 opacity-20" />
              }
              <p className="text-xs mt-2 opacity-60">Prévia não disponível</p>
            </div>
          ) : thumbUpgraded ? (
            <img src={thumbUpgraded} alt={c.adName} className="w-full max-h-[70vh] object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-[var(--muted-foreground)]">
              <Play className="w-12 h-12 opacity-20" />
              <p className="text-xs">Nenhuma prévia disponível</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type CriativoSortCol = "adName" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm" | "leads" | "cpl" | "purchases" | "cpa" | "faturamento" | "ticketMedio" | "roas" | "daysActive" | "conversas" | "custoConversa";

function sortCriativos(arr: Criativo[], col: CriativoSortCol, dir: SortDir): Criativo[] {
  return [...arr].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (col === "adName") { va = a.adName; vb = b.adName; }
    else if (col === "ctr") { va = a.ctr ?? -Infinity; vb = b.ctr ?? -Infinity; }
    else if (col === "cpc") { va = a.cpc ?? Infinity; vb = b.cpc ?? Infinity; }
    else if (col === "cpm") { va = a.cpm ?? Infinity; vb = b.cpm ?? Infinity; }
    else if (col === "cpl") { va = a.cpl ?? Infinity; vb = b.cpl ?? Infinity; }
    else if (col === "cpa") { va = a.cpa ?? Infinity; vb = b.cpa ?? Infinity; }
    else if (col === "roas") { va = a.roas ?? -Infinity; vb = b.roas ?? -Infinity; }
    else if (col === "ticketMedio") { va = a.ticketMedio ?? -Infinity; vb = b.ticketMedio ?? -Infinity; }
    else if (col === "custoConversa") { va = a.custoConversa ?? Infinity; vb = b.custoConversa ?? Infinity; }
    else { va = a[col] as number; vb = b[col] as number; }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function CriativosTable({ criativos, parentCampType, mqlByAdId }: { criativos: Criativo[]; parentCampType?: CampType | null; mqlByAdId?: Map<string, number> }) {
  const [modalCriativo, setModalCriativo] = React.useState<Criativo | null>(null);
  const [sortCol, setSortCol] = React.useState<CriativoSortCol>("spend");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  function handleSort(col: string) {
    const c = col as CriativoSortCol;
    if (c === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(c); setSortDir(["adName", "cpl", "cpa", "cpc", "cpm", "custoConversa"].includes(c) ? "asc" : "desc"); }
  }

  const hasLeads = criativos.some(c => c.leads > 0) || parentCampType === "leads";
  const hasSales = criativos.some(c => c.purchases > 0 || c.faturamento > 0) || parentCampType === "vendas";
  const hasConversas = criativos.some(c => (c.conversas ?? 0) > 0) || parentCampType === "conversas";
  const minW = hasSales ? 1080 : hasLeads ? 820 : hasConversas ? 900 : 680;
  const sorted = sortCriativos(criativos, sortCol, sortDir);
  const st = { sortCol, sortDir, onSort: handleSort };

  return (
    <>
      {modalCriativo && <VideoModal c={modalCriativo} onClose={() => setModalCriativo(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full border-separate [border-spacing:0_6px]" style={{ minWidth: minW }}>
          <thead>
            <tr>
              <SortTh col="adName" label="Criativo" align="left" {...st} />
              <SortTh col="spend" label="Invest." {...st} />
              <SortTh col="impressions" label="Impr." {...st} />
              <SortTh col="clicks" label="Cliques" {...st} />
              <SortTh col="ctr" label="CTR" {...st} />
              <SortTh col="cpc" label="CPC" {...st} />
              <SortTh col="cpm" label="CPM" {...st} />
              {hasLeads && <SortTh col="leads" label="Leads" {...st} />}
              {mqlByAdId && hasLeads && (
                <th className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.20em] text-right whitespace-nowrap text-emerald-400">
                  MQL
                </th>
              )}
              {hasLeads && <SortTh col="cpl" label="CPL" {...st} />}
              {hasConversas && <SortTh col="conversas" label="Conversas" {...st} />}
              {hasConversas && <SortTh col="custoConversa" label="Custo/Conv" {...st} />}
              {hasSales && <SortTh col="purchases" label="Vendas" {...st} />}
              {hasSales && <SortTh col="cpa" label="CPA" {...st} />}
              {hasSales && <SortTh col="faturamento" label="Faturado" {...st} />}
              {hasSales && <SortTh col="ticketMedio" label="Ticket" {...st} />}
              {hasSales && <SortTh col="roas" label="ROAS" {...st} />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const isTop = i === 0;
              const isVideo = c.mediaType === "VIDEO";
              const isActive = c.effectiveStatus === "ACTIVE";
              const bg = rowBg(isTop);
              const thumb = c.videoPictureUrl ?? c.imageUrl;
              const thumbUpgraded = thumb ? upgradeFbCdnImageUrl(thumb) : null;
              const hasAdCopy = c.title || c.body;

              return (
                <tr
                  key={c.adId}
                  className="group cursor-pointer"
                  onClick={() => setModalCriativo(c)}
                >
                  {/* Thumbnail + name + ad copy */}
                  <td className={`rounded-l-2xl px-4 py-3 ${bg}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Thumbnail — taller if has ad copy */}
                      <div className={`${hasAdCopy ? "w-14 h-14" : "w-11 h-11"} rounded-xl overflow-hidden flex-shrink-0 bg-black/40 relative mt-0.5`}>
                        {thumbUpgraded ? (
                          <img
                            src={thumbUpgraded}
                            alt={c.adName}
                            className="w-full h-full object-cover group-hover:brightness-90 transition-[filter]"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {isVideo
                              ? <Play className="w-4 h-4 text-white/30" />
                              : <Eye className="w-4 h-4 text-white/30" />}
                          </div>
                        )}
                        {/* Play overlay for videos */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>

                      {/* Text block */}
                      <div className="min-w-0 flex-1">
                        {/* Ad name */}
                        <p className="text-[13px] font-semibold text-[var(--foreground)] leading-snug line-clamp-1">{c.adName}</p>

                        {/* Ad copy: headline + body */}
                        {hasAdCopy && (
                          <div className="mt-1 space-y-0.5">
                            {c.title && (
                              <p className="text-[11px] text-[var(--foreground)]/60 font-medium line-clamp-1 leading-snug">{c.title}</p>
                            )}
                            {c.body && (
                              <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 leading-relaxed">{c.body}</p>
                            )}
                          </div>
                        )}

                        {/* Meta row: type · status · days · click hint */}
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {isVideo
                            ? <><Play className="w-2.5 h-2.5 flex-shrink-0" /> Vídeo</>
                            : <><Eye className="w-2.5 h-2.5 flex-shrink-0" /> Imagem</>
                          }
                          <span className="opacity-30">·</span>
                          <span className={isActive ? "text-emerald-400" : "text-amber-400/80"}>
                            {isActive ? "Ativo" : (c.effectiveStatus ?? "—")}
                          </span>
                          {c.daysActive > 1 && (
                            <>
                              <span className="opacity-30">·</span>
                              <span>{c.daysActive} dias</span>
                            </>
                          )}
                          <span className="opacity-30">·</span>
                          <span className="group-hover:text-[var(--primary)] transition-colors">Ver criativo</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                    {fmtBrl(c.spend)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                    {fmt(c.impressions)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                    {fmt(c.clicks)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-[13px] whitespace-nowrap ${bg} ${c.ctr !== null && c.ctr >= 1 ? "text-emerald-400" : "text-[var(--muted-foreground)]"}`}>
                    {c.ctr !== null ? fmtPct(c.ctr) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                    {c.cpc !== null ? fmtBrl(c.cpc) : "—"}
                  </td>
                  <td className={`${!hasLeads && !hasSales && !hasConversas ? "rounded-r-2xl" : ""} px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                    {c.cpm !== null ? fmtBrl(c.cpm) : "—"}
                  </td>
                  {hasLeads && (
                    <td className={`px-4 py-3 text-right tabular-nums text-[13px] whitespace-nowrap ${isTop && c.leads > 0 ? "text-[var(--primary)] font-bold text-[15px]" : "text-[var(--muted-foreground)]"} ${bg}`}>
                      {c.leads > 0 ? fmt(c.leads) : "—"}
                    </td>
                  )}
                  {mqlByAdId && hasLeads && (() => {
                    const rawMql = mqlByAdId.get(c.adId) ?? 0;
                    const mql = c.leads > 0 ? Math.min(rawMql, c.leads) : 0;
                    return (
                      <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${bg}`}>
                        {mql > 0
                          ? <span className="text-[14px] font-bold text-emerald-400">{fmt(mql)}</span>
                          : <span className="text-[13px] text-white/20">—</span>}
                      </td>
                    );
                  })()}
                  {hasLeads && (
                    <td className={`${!hasSales && !hasConversas ? "rounded-r-2xl" : ""} px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                      {c.cpl !== null ? fmtBrl(c.cpl) : "—"}
                    </td>
                  )}
                  {hasConversas && (
                    <td className={`px-4 py-3 text-right tabular-nums text-[13px] whitespace-nowrap ${isTop && (c.conversas ?? 0) > 0 ? "text-[var(--primary)] font-bold text-[15px]" : (c.conversas ?? 0) > 0 ? "text-sky-300 font-semibold" : "text-white/30"} ${bg}`}>
                      {(c.conversas ?? 0) > 0 ? fmt(c.conversas) : "—"}
                    </td>
                  )}
                  {hasConversas && (
                    <td className={`${!hasSales ? "rounded-r-2xl" : ""} px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                      {c.custoConversa !== null ? fmtBrl(c.custoConversa) : "—"}
                    </td>
                  )}
                  {hasSales && (
                    <td className={`px-4 py-3 text-right tabular-nums text-[13px] whitespace-nowrap ${isTop && c.purchases > 0 ? "text-[var(--primary)] font-bold text-[15px]" : c.purchases > 0 ? "text-[var(--foreground)]" : "text-white/30"} ${bg}`}>
                      {c.purchases > 0 ? fmt(c.purchases) : "—"}
                    </td>
                  )}
                  {hasSales && (
                    <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                      {c.cpa !== null ? fmtBrl(c.cpa) : "—"}
                    </td>
                  )}
                  {hasSales && (
                    <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                      {c.faturamento > 0 ? fmtBrl(c.faturamento) : "—"}
                    </td>
                  )}
                  {hasSales && (
                    <td className={`px-4 py-3 text-right tabular-nums text-[13px] text-[var(--muted-foreground)] whitespace-nowrap ${bg}`}>
                      {c.ticketMedio !== null ? fmtBrl(c.ticketMedio) : "—"}
                    </td>
                  )}
                  {hasSales && (
                    <td className={`rounded-r-2xl px-4 py-3 text-right tabular-nums text-[13px] font-semibold whitespace-nowrap ${c.roas !== null && c.roas >= 1 ? "text-emerald-400" : "text-[var(--muted-foreground)]"} ${bg}`}>
                      {c.roas !== null ? fmt(c.roas, 2) + "x" : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CriativoCard({ c }: { c: Criativo }) {
  const [showModal, setShowModal] = React.useState(false);
  const thumb = c.videoPictureUrl ?? c.imageUrl;
  const thumbUpgraded = thumb ? upgradeFbCdnImageUrl(thumb) : null;
  const isVideo = c.mediaType === "VIDEO";
  const isActive = c.effectiveStatus === "ACTIVE";

  return (
    <>
      {showModal && <VideoModal c={c} onClose={() => setShowModal(false)} />}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden flex flex-col">
        {/* Thumbnail / Preview */}
        <div
          className={`relative aspect-[4/3] bg-black/30 overflow-hidden flex-shrink-0 ${isVideo ? "cursor-pointer group" : ""}`}
          onClick={() => isVideo && setShowModal(true)}
        >
          {thumbUpgraded ? (
            <img src={thumbUpgraded} alt={c.adName} className={`w-full h-full object-cover ${isVideo ? "group-hover:brightness-75 transition-[filter]" : ""}`} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--muted-foreground)]">
              <Play className="w-10 h-10 opacity-30" />
            </div>
          )}

          {/* Play overlay for videos */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-14 h-14 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-lg">
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex gap-1.5">
            {isVideo && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                className="text-[10px] font-bold bg-black/80 text-white px-2 py-1 rounded-full flex items-center gap-1 hover:bg-[var(--primary)] transition-colors"
              >
                <Play className="w-2.5 h-2.5" /> Assistir
              </button>
            )}
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isActive ? "bg-emerald-500/25 text-emerald-400" : "bg-white/10 text-[var(--muted-foreground)]"}`}>
              {isActive ? "Ativo" : (c.effectiveStatus ?? "—")}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 flex-1 flex flex-col gap-3">
          <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">{c.adName}</p>
          {(c.title || c.body) && (
            <div className="text-xs text-[var(--muted-foreground)] space-y-1">
              {c.title && <p className="font-medium text-[var(--foreground)]/70 line-clamp-1">{c.title}</p>}
              {c.body && <p className="line-clamp-2 leading-relaxed">{c.body}</p>}
            </div>
          )}
          <div className="mt-auto pt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/[0.06]">
            {[
              { label: "Investido", value: fmtBrl(c.spend) },
              { label: "Impressões", value: fmt(c.impressions) },
              { label: "Cliques", value: fmt(c.clicks) },
              ...(c.ctr !== null ? [{ label: "CTR", value: fmtPct(c.ctr) }] : []),
              ...(c.cpc !== null ? [{ label: "CPC", value: fmtBrl(c.cpc) }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</span>
                <span className="text-sm font-bold tabular-nums text-[var(--foreground)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

interface Props {
  clienteId: string;
  dateFilter: DateFilter;
  canal?: string;
  mqlByCampaignName?: Map<string, number>;
  mqlByAdsetId?: Map<string, number>;
  mqlByAdId?: Map<string, number>;
}

export function CampanhasPanel({ clienteId, dateFilter, canal = "geral", mqlByCampaignName, mqlByAdsetId, mqlByAdId }: Props) {
  const [selectedCampanha, setSelectedCampanha] = React.useState<string | null>(null);
  const [selectedConjunto, setSelectedConjunto] = React.useState<string | null>(null);
  const selectedCampanhaObjRef = React.useRef<Campanha | null>(null);

  const nivel = selectedConjunto ? "criativos" : selectedCampanha ? "conjuntos" : "campanhas";

  const params = buildParams(dateFilter, {
    canal,
    nivel,
    ...(selectedCampanha ? { campanha: selectedCampanha } : {}),
    ...(selectedConjunto ? { conjunto: selectedConjunto } : {}),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["campanhas", clienteId, nivel, selectedCampanha, selectedConjunto, dateFilter],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/campanhas?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar campanhas");
      return res.json();
    },
  });

  function goBack() {
    if (selectedConjunto) setSelectedConjunto(null);
    else { setSelectedCampanha(null); selectedCampanhaObjRef.current = null; }
  }

  function handleSelectCampanha(nome: string) {
    const obj = (data?.campanhas as Campanha[] ?? []).find(c => c.nome === nome);
    if (obj) selectedCampanhaObjRef.current = obj;
    setSelectedCampanha(nome);
  }

  const campanhas: Campanha[] = data?.campanhas ?? [];
  const conjuntos: Conjunto[] = data?.conjuntos ?? [];
  const criativos: Criativo[] = data?.criativos ?? [];
  const isRoot = nivel === "campanhas";

  const parentCampType: CampType | null = selectedCampanhaObjRef.current
    ? detectCampType(selectedCampanhaObjRef.current.nome, selectedCampanhaObjRef.current.leads, selectedCampanhaObjRef.current.purchases, selectedCampanhaObjRef.current)
    : null;

  const countLabel =
    nivel === "campanhas" && campanhas.length > 0
      ? `${campanhas.length} campanha${campanhas.length !== 1 ? "s" : ""}`
      : nivel === "conjuntos" && conjuntos.length > 0
      ? `${conjuntos.length} conjunto${conjuntos.length !== 1 ? "s" : ""}`
      : nivel === "criativos" && criativos.length > 0
      ? `${criativos.length} criativo${criativos.length !== 1 ? "s" : ""}`
      : null;

  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,21,26,0.98),rgba(12,12,16,1))] shadow-[0_24px_80px_rgba(0,0,0,0.38)] overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-5 sm:px-8 border-b border-white/[0.05] flex items-center gap-4">
        {!isRoot && (
          <button onClick={goBack} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {!isRoot && (
            <nav className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mb-1 flex-wrap">
              <button onClick={() => { setSelectedCampanha(null); setSelectedConjunto(null); }} className="hover:text-[var(--foreground)] hover:underline transition-colors">
                Campanhas
              </button>
              {selectedCampanha && (
                <>
                  <ChevronRight className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />
                  <button onClick={() => setSelectedConjunto(null)} className={`truncate max-w-[220px] hover:text-[var(--foreground)] transition-colors ${nivel === "conjuntos" ? "text-[var(--foreground)] font-semibold" : "hover:underline"}`}>
                    {selectedCampanha}
                  </button>
                </>
              )}
              {selectedConjunto && (
                <>
                  <ChevronRight className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />
                  <span className="text-[var(--foreground)] font-semibold truncate max-w-[220px]">
                    {conjuntos.find(c => c.adsetId === selectedConjunto)?.adsetName ?? "Conjunto"}
                  </span>
                </>
              )}
            </nav>
          )}

          <h3 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] sm:text-2xl flex items-center gap-2.5">
            {isRoot && <BarChart3 className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />}
            {nivel === "conjuntos" && <Target className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />}
            {nivel === "criativos" && <Eye className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />}
            {isRoot ? (
              <>Campanhas</>
            ) : nivel === "conjuntos" ? (
              <>Conjuntos de <span className="bg-[linear-gradient(90deg,var(--accent),var(--primary))] bg-clip-text text-transparent">Anúncios</span></>
            ) : (
              <>Criativos</>
            )}
          </h3>
          {isRoot && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Clique em uma campanha para ver conjuntos e criativos.
            </p>
          )}
        </div>

        {countLabel && !isLoading && (
          <span className="rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground)] flex-shrink-0">
            {countLabel}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-[var(--muted-foreground)] text-sm gap-2.5">
          <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          Carregando…
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-[var(--muted-foreground)] text-sm">
          Erro ao carregar dados. Tente novamente.
        </div>
      )}

      {!isLoading && !isError && nivel === "campanhas" && (
        campanhas.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted-foreground)] text-sm">
            <BarChart3 className="w-9 h-9 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma campanha encontrada no período.</p>
            <p className="text-xs mt-1.5 opacity-60">Os dados aparecem após o próximo sync.</p>
          </div>
        ) : (
          <div className="px-3 pb-5 pt-4 sm:px-5 sm:pb-6">
            <CampanhasTable campanhas={campanhas} onSelect={handleSelectCampanha} mqlByCampaignName={mqlByCampaignName} />
          </div>
        )
      )}

      {!isLoading && !isError && nivel === "conjuntos" && (
        conjuntos.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted-foreground)] text-sm">
            <Target className="w-9 h-9 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhum conjunto encontrado para esta campanha.</p>
            <p className="text-xs mt-1.5 opacity-60">Os conjuntos aparecem após o próximo sync de criativos.</p>
          </div>
        ) : (
          <div className="px-3 pb-5 pt-4 sm:px-5 sm:pb-6">
            <ConjuntosTable conjuntos={conjuntos} onSelect={setSelectedConjunto} parentCampType={parentCampType} mqlByAdsetId={mqlByAdsetId} clienteId={clienteId} dateFilter={dateFilter} />
          </div>
        )
      )}

      {!isLoading && !isError && nivel === "criativos" && (
        criativos.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted-foreground)] text-sm">
            <Eye className="w-9 h-9 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhum criativo encontrado para este conjunto.</p>
            <p className="text-xs mt-1.5 opacity-60">Os criativos aparecem após o próximo sync.</p>
          </div>
        ) : (
          <div className="px-3 pb-5 pt-4 sm:px-5 sm:pb-6">
            <CriativosTable criativos={criativos} parentCampType={parentCampType} mqlByAdId={mqlByAdId} />
          </div>
        )
      )}
    </div>
  );
}
