"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, ChevronsUpDown, BarChart3 } from "lucide-react";

type DateFilter = { periodo: string; dataInicio?: string; dataFim?: string };

function buildParams(filter: DateFilter) {
  const p = new URLSearchParams();
  p.set("periodo", filter.periodo);
  if (filter.dataInicio) p.set("dataInicio", filter.dataInicio);
  if (filter.dataFim) p.set("dataFim", filter.dataFim);
  return p.toString();
}

function fmt(v: number, d = 0) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtBrl(v: number) { return "R$\u00a0" + fmt(v, 2); }
function fmtPct(v: number) { return fmt(v, 2) + "%"; }

interface Campanha {
  nome: string; campaignId: string | null; campaignStatus: string | null; campaignType: string | null;
  investimento: number; impressoes: number; cliques: number; conversoes: number; leads: number;
  ctr: number | null; cpc: number | null; custoConversao: number | null; cpl: number | null;
  statusOrder?: number;
}

type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, dir }: { col: string; sortKey: string; dir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return dir === "desc" ? <ChevronDown className="w-3 h-3 text-[var(--primary)]" /> : <ChevronUp className="w-3 h-3 text-[var(--primary)]" />;
}

function useSortable<T>(data: T[], defaultKey: keyof T) {
  const [key, setKey] = React.useState<keyof T>(defaultKey);
  const [dir, setDir] = React.useState<SortDir>("desc");
  const sorted = React.useMemo(() => [...data].sort((a, b) => {
    const av = a[key] as number | null ?? (dir === "desc" ? -Infinity : Infinity);
    const bv = b[key] as number | null ?? (dir === "desc" ? -Infinity : Infinity);
    return dir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
  }), [data, key, dir]);
  function toggle(k: string) {
    if (k === (key as string)) setDir(d => d === "desc" ? "asc" : "desc");
    else { setKey(k as keyof T); setDir("desc"); }
  }
  return { sorted, key: key as string, dir, toggle };
}

function Th({ label, col, sortKey, dir, onSort, right = true }: {
  label: string; col: string; sortKey: string; dir: SortDir; onSort: (k: string) => void; right?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] cursor-pointer select-none hover:text-[var(--foreground)] transition-colors ${right ? "text-right" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${right ? "justify-end" : ""}`}>
        {label}<SortIcon col={col} sortKey={sortKey} dir={dir} />
      </span>
    </th>
  );
}

const Td = ({ v, muted = false, highlight = false }: { v: string; muted?: boolean; highlight?: boolean }) => (
  <td className={`px-3 py-3 text-right text-sm font-semibold tabular-nums ${muted ? "text-[var(--muted-foreground)]" : highlight ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{v}</td>
);

const dash = "—";
const n = (v: number | null, fn: (x: number) => string) => v != null && v > 0 ? fn(v) : dash;

function statusBadge(status: string | null) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "ACTIVE") return { label: "Ativa", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" };
  if (s === "PAUSED") return { label: "Pausada", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400" };
  if (s === "COMPLETED") return { label: "Concluída", color: "bg-sky-500/10 text-sky-400 border-sky-500/20", dot: "bg-sky-400" };
  if (s === "ARCHIVED" || s === "CANCELED") return { label: "Arquivada", color: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-400" };
  if (s === "DRAFT") return { label: "Rascunho", color: "bg-[var(--muted)]/40 text-[var(--muted-foreground)] border-[var(--border)]", dot: "bg-[var(--muted-foreground)]" };
  return null;
}

function typeBadge(campaignType?: string | null) {
  const t = (campaignType ?? "").toUpperCase();
  if (t === "SPONSORED_UPDATES") return { label: "Conteúdo", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" };
  if (t === "TEXT_AD") return { label: "Texto", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" };
  if (t === "SPONSORED_INMAILS") return { label: "Mensagem", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" };
  if (t === "DYNAMIC") return { label: "Dinâmico", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  return { label: "LinkedIn", color: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20" };
}

interface Props { clienteId: string; filter: DateFilter; }

export function LinkedInCampanhasPanel({ clienteId, filter }: Props) {
  const params = buildParams(filter);

  const { data, isLoading } = useQuery<{ campanhas: Campanha[] }>({
    queryKey: ["linkedin-campanhas", clienteId, params],
    queryFn: async () => {
      const r = await fetch(`/api/clientes/${clienteId}/campanhas-linkedin?${params}`);
      if (!r.ok) throw new Error("Falha ao carregar campanhas LinkedIn");
      return r.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const statusOrderMap: Record<string, number> = { ACTIVE: 1, PAUSED: 2, COMPLETED: 3, DRAFT: 4, ARCHIVED: 5 };
  const campanhas = (data?.campanhas ?? []).map(c => ({
    ...c,
    statusOrder: statusOrderMap[(c.campaignStatus ?? "").toUpperCase()] ?? 9,
  }));
  const { sorted, key, dir, toggle } = useSortable(campanhas, "investimento");
  const hasLeads = campanhas.some(c => c.leads > 0);
  const hasConv = campanhas.some(c => c.conversoes > 0);

  const totais = campanhas.reduce(
    (acc, c) => ({
      investimento: acc.investimento + c.investimento,
      impressoes:   acc.impressoes   + c.impressoes,
      cliques:      acc.cliques      + c.cliques,
      conversoes:   acc.conversoes   + c.conversoes,
      leads:        acc.leads        + c.leads,
    }),
    { investimento: 0, impressoes: 0, cliques: 0, conversoes: 0, leads: 0 }
  );
  const ctrTotal = totais.impressoes > 0 ? (totais.cliques / totais.impressoes) * 100 : null;
  const cpcTotal = totais.cliques > 0    ? totais.investimento / totais.cliques : null;
  const cplTotal = totais.leads > 0      ? totais.investimento / totais.leads : null;
  const cpaTotal = totais.conversoes > 0 ? totais.investimento / totais.conversoes : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">LinkedIn Ads</p>
          <p className="text-sm font-extrabold text-[var(--foreground)] uppercase tracking-wider">Campanhas · Análise por período</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-[var(--muted-foreground)]">Carregando campanhas…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <BarChart3 className="w-8 h-8 text-[var(--muted-foreground)] opacity-30" />
          <p className="text-sm text-[var(--muted-foreground)]">Nenhuma campanha LinkedIn com dados no período.</p>
          <p className="text-xs text-[var(--muted-foreground)] opacity-70">Os dados aparecem após o próximo sync.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[640px]">
            <thead className="bg-white/[0.02]">
              <tr>
                <Th label="Campanha" col="nome" sortKey={key} dir={dir} onSort={toggle} right={false} />
                <Th label="Status" col="statusOrder" sortKey={key} dir={dir} onSort={toggle} right={false} />
                <Th label="Investido" col="investimento" sortKey={key} dir={dir} onSort={toggle} />
                <Th label="Impressões" col="impressoes" sortKey={key} dir={dir} onSort={toggle} />
                <Th label="Cliques" col="cliques" sortKey={key} dir={dir} onSort={toggle} />
                <Th label="CTR" col="ctr" sortKey={key} dir={dir} onSort={toggle} />
                <Th label="CPC" col="cpc" sortKey={key} dir={dir} onSort={toggle} />
                {hasLeads && <>
                  <Th label="Leads" col="leads" sortKey={key} dir={dir} onSort={toggle} />
                  <Th label="CPL" col="cpl" sortKey={key} dir={dir} onSort={toggle} />
                </>}
                {hasConv && <>
                  <Th label="Conversões" col="conversoes" sortKey={key} dir={dir} onSort={toggle} />
                  <Th label="CPA médio" col="custoConversao" sortKey={key} dir={dir} onSort={toggle} />
                </>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const isTop = i === 0;
                const badge = typeBadge(c.campaignType);
                return (
                  <tr
                    key={c.nome}
                    className={`border-t border-[var(--border)] ${isTop ? "bg-[var(--primary)]/[0.05]" : "bg-white/[0.02]"}`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isTop && (
                          <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--primary)]">#1</span>
                        )}
                        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border whitespace-nowrap ${badge.color}`}>{badge.label}</span>
                        <p className="text-sm font-semibold text-[var(--foreground)] truncate" title={c.nome}>{c.nome}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {(() => { const sb = statusBadge(c.campaignStatus); return sb ? (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap ${sb.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sb.dot}`} />
                          {sb.label}
                        </span>
                      ) : <span className="text-xs text-[var(--muted-foreground)]">—</span>; })()}
                    </td>
                    <Td v={fmtBrl(c.investimento)} highlight />
                    <Td v={fmt(c.impressoes)} muted />
                    <Td v={fmt(c.cliques)} />
                    <Td v={n(c.ctr, fmtPct)} muted />
                    <Td v={n(c.cpc, fmtBrl)} />
                    {hasLeads && <>
                      <Td v={fmt(c.leads)} />
                      <Td v={n(c.cpl, fmtBrl)} />
                    </>}
                    {hasConv && <>
                      <Td v={fmt(c.conversoes, 1)} />
                      <Td v={n(c.custoConversao, fmtBrl)} />
                    </>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--primary)]/30 bg-[var(--primary)]/[0.06]">
                <td className="px-3 py-3" colSpan={2}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">Total · {campanhas.length} campanhas</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-extrabold text-[var(--foreground)]">{fmtBrl(totais.investimento)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-bold text-[var(--muted-foreground)]">{fmt(totais.impressoes)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-bold text-[var(--foreground)]">{fmt(totais.cliques)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-bold text-[var(--muted-foreground)]">{ctrTotal != null ? fmtPct(ctrTotal) : dash}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-bold text-[var(--foreground)]">{cpcTotal != null ? fmtBrl(cpcTotal) : dash}</span>
                </td>
                {hasLeads && <>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-bold text-[var(--foreground)]">{fmt(totais.leads)}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-bold text-[var(--foreground)]">{cplTotal != null ? fmtBrl(cplTotal) : dash}</span>
                  </td>
                </>}
                {hasConv && <>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-bold text-[var(--foreground)]">{fmt(totais.conversoes, 1)}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-bold text-[var(--foreground)]">{cpaTotal != null ? fmtBrl(cpaTotal) : dash}</span>
                  </td>
                </>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
