"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MessageCircle, FileText, TrendingUp, AlertCircle, RefreshCw, Hash, Home } from "lucide-react";

export interface DateFilter {
  periodo: string | number;
  dataInicio?: string;
  dataFim?: string;
  label?: string;
}

interface ImoveisItem {
  id: string;
  nome: string;
  conversas: number;
  leads: number;
  total: number;
  spend: number;
  anuncios: number;
}

interface ImoveisData {
  imoveis: ImoveisItem[];
  semId: {
    conversas: number;
    leads: number;
    total: number;
    spend: number;
    anuncios: number;
  };
  totalAnuncios: number;
  dataInicio: string;
  dataFim: string;
}

async function fetchImoveis(clienteId: string, dateFilter: DateFilter): Promise<ImoveisData> {
  const params = new URLSearchParams({ periodo: String(dateFilter.periodo) });
  if (dateFilter.dataInicio) params.set("dataInicio", dateFilter.dataInicio);
  if (dateFilter.dataFim) params.set("dataFim", dateFilter.dataFim);
  const res = await fetch(`/api/clientes/${clienteId}/imoveis?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Erro ${res.status}`);
  }
  return res.json();
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-white/5 ${className ?? ""}`} />
  );
}

function StatBadge({ icon: Icon, label, value, accent }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 text-center ${
      accent
        ? "border-[var(--primary)]/30 bg-[var(--primary)]/10"
        : "border-[var(--border)] bg-[var(--card)]"
    }`}>
      <Icon className={`h-4 w-4 ${accent ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
      <span className={`text-xl font-extrabold tabular-nums ${accent ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </span>
    </div>
  );
}

interface ImoveisTableRowProps {
  rank: number;
  item: ImoveisItem;
  maxTotal: number;
}

function ImoveisTableRow({ rank, item, maxTotal }: ImoveisTableRowProps) {
  const pct = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
  const noResults = item.total === 0;

  return (
    <div className={`group relative overflow-hidden rounded-xl border transition-all hover:border-[var(--primary)]/40 ${
      noResults ? "border-[var(--border)]/50 opacity-50" : "border-[var(--border)] bg-[var(--card)]"
    }`}>
      {!noResults && (
        <div
          className="absolute inset-y-0 left-0 bg-[var(--primary)]/5 transition-all"
          style={{ width: `${pct}%` }}
        />
      )}
      <div className="relative flex items-center gap-3 px-4 py-3 sm:gap-4">
        <span className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${
          rank <= 3 ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
        }`}>
          {rank}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--primary)]/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--primary)]">
              #{item.id}
            </span>
            {item.anuncios > 0 && (
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {item.anuncios} anúncio{item.anuncios !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {item.nome && (
            <span className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">
              {item.nome}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs text-[var(--muted-foreground)]">Conversas</span>
            <span className="text-sm font-bold tabular-nums text-[var(--foreground)]">
              {item.conversas}
            </span>
          </div>
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs text-[var(--muted-foreground)]">Leads</span>
            <span className="text-sm font-bold tabular-nums text-[var(--foreground)]">
              {item.leads}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Total
            </span>
            <span className={`text-base font-extrabold tabular-nums ${
              noResults ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]"
            }`}>
              {item.total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ImoveisTableRowMobileProps {
  rank: number;
  item: ImoveisItem;
}

function SemIdRow({ item }: { item: ImoveisData["semId"] }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)]/50 bg-[var(--card)]/50">
      <div className="flex items-center gap-3 px-4 py-3 sm:gap-4">
        <span className="w-6 shrink-0 text-center text-sm font-bold text-[var(--muted-foreground)]">—</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-[var(--muted-foreground)]">
            Anúncios sem ID de imóvel
          </span>
          {item.anuncios > 0 && (
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {item.anuncios} anúncio{item.anuncios !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs text-[var(--muted-foreground)]">Conversas</span>
            <span className="text-sm font-bold tabular-nums text-[var(--muted-foreground)]">{item.conversas}</span>
          </div>
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-xs text-[var(--muted-foreground)]">Leads</span>
            <span className="text-sm font-bold tabular-nums text-[var(--muted-foreground)]">{item.leads}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Total</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--muted-foreground)]">{item.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImoveisPanel({
  clienteId,
  dateFilter,
}: {
  clienteId: string;
  dateFilter: DateFilter;
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["imoveis", clienteId, dateFilter.periodo, dateFilter.dataInicio, dateFilter.dataFim],
    queryFn: () => fetchImoveis(clienteId, dateFilter),
    staleTime: 5 * 60 * 1000,
  });

  const totalResultados = (data?.imoveis ?? []).reduce((s, i) => s + i.total, 0);
  const totalConversas = (data?.imoveis ?? []).reduce((s, i) => s + i.conversas, 0);
  const totalLeads = (data?.imoveis ?? []).reduce((s, i) => s + i.leads, 0);
  const imoveisComResultado = (data?.imoveis ?? []).filter((i) => i.total > 0).length;
  const maxTotal = (data?.imoveis ?? [])[0]?.total ?? 1;

  if (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <div>
          <p className="font-semibold text-[var(--foreground)]">Não foi possível carregar os dados</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{message}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/15">
            <Building2 className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Resultados por Imóvel
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Conversas e leads atribuídos por ID de imóvel nos anúncios Meta
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)] disabled:opacity-40"
          title="Atualizar dados"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary KPI row */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBadge icon={TrendingUp} label="Total Resultados" value={totalResultados} accent />
          <StatBadge icon={MessageCircle} label="Conversas" value={totalConversas} />
          <StatBadge icon={FileText} label="Leads Form" value={totalLeads} />
          <StatBadge icon={Home} label="Imóveis c/ resultado" value={imoveisComResultado} />
        </div>
      )}

      {/* Table header */}
      <div className="hidden grid-cols-[24px_1fr_80px_80px_72px] items-center gap-4 rounded-lg px-4 py-2 sm:grid">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">#</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Imóvel</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Conversas</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Leads</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Total</span>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !data || data.imoveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] py-16 text-center">
          <Hash className="h-8 w-8 text-[var(--muted-foreground)]" />
          <div>
            <p className="font-semibold text-[var(--foreground)]">Nenhum imóvel encontrado</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Não há anúncios com IDs de imóveis no período selecionado.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.imoveis.map((item, idx) => (
            <ImoveisTableRow
              key={item.id}
              rank={idx + 1}
              item={item}
              maxTotal={maxTotal}
            />
          ))}

          {(data.semId.conversas > 0 || data.semId.leads > 0 || data.semId.anuncios > 0) && (
            <>
              <div className="my-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border)]/40" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Sem ID atribuído
                </span>
                <div className="h-px flex-1 bg-[var(--border)]/40" />
              </div>
              <SemIdRow item={data.semId} />
            </>
          )}
        </div>
      )}

      {data && (
        <p className="text-center text-[10px] text-[var(--muted-foreground)]">
          {data.totalAnuncios} anúncio{data.totalAnuncios !== 1 ? "s" : ""} analisados no período •
          Anúncios com múltiplos IDs têm resultados somados em cada imóvel
        </p>
      )}
    </div>
  );
}
