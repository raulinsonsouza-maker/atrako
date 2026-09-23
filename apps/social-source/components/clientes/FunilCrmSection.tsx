"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

interface EtapaFunil {
  etapa: string;
  count: number;
  valor: number;
  fechados: number;
  ganhos: number;
  pctTotal: number;
}

interface FunilData {
  configured: boolean;
  tipo?: string;
  ultimoSyncAt?: string | null;
  totalLeads: number;
  totalValor: number;
  totalFechados: number;
  totalGanhos: number;
  etapas: EtapaFunil[];
}

// ── Modelo Construtora / Incorporadora ───────────────────────────────────────
type MacroGrupo = "Leads" | "Atendimento" | "Visitas" | "Reservas" | "Vendas" | "Perdidos";
const MACRO_ORDER: MacroGrupo[] = ["Leads", "Atendimento", "Visitas", "Reservas", "Vendas", "Perdidos"];

const MACRO_COLORS: Record<MacroGrupo, string> = {
  Leads:       "#6b7280",
  Atendimento: "#3b82f6",
  Visitas:     "#f59e0b",
  Reservas:    "#a855f7",
  Vendas:      "#10b981",
  Perdidos:    "#ef4444",
};

function getMacroGrupo(etapa: string): MacroGrupo {
  const e = etapa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (
    e.includes("perdido") || e.includes("cancelado") || e.includes("descartado") ||
    e.includes("desistiu") || e.includes("desistencia") || e.includes("sem interesse") ||
    e.includes("inativo") || e.includes("invalido") || e.includes("duplicado")
  ) return "Perdidos";
  if (e.includes("venda") || e.includes("contrato") || e.includes("assinado")) return "Vendas";
  if (e.includes("reserva")) return "Reservas";
  if (e.includes("visita") || e.includes("reagendar")) return "Visitas";
  if (
    e.includes("atendimento") || e.includes("simulacao") ||
    e.includes("proposta") || e.includes("qualificacao") || e.includes("negociac")
  ) return "Atendimento";
  return "Leads";
}

// ── Modelo Agência de Marketing ───────────────────────────────────────────────
type MacroGrupoAgencia = "Prospecção" | "Conexão" | "Qualificação" | "Oportunidade" | "Fechamentos" | "Perdidos";
const MACRO_ORDER_AGENCIA: MacroGrupoAgencia[] = ["Prospecção", "Conexão", "Qualificação", "Oportunidade", "Fechamentos", "Perdidos"];

const MACRO_COLORS_AGENCIA: Record<MacroGrupoAgencia, string> = {
  Prospecção:  "#6b7280",
  Conexão:     "#3b82f6",
  Qualificação:"#f59e0b",
  Oportunidade:"#a855f7",
  Fechamentos: "#10b981",
  Perdidos:    "#ef4444",
};

function getMacroGrupoAgencia(etapa: string): MacroGrupoAgencia {
  const e = etapa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (
    e.includes("descartado") || e.includes("perdido") || e.includes("cancelado") ||
    e.includes("sem interesse") || e.includes("invalido") || e.includes("duplicado") ||
    e.includes("inativo")
  ) return "Perdidos";
  if (e.includes("vendido") || e.includes("venda") || e.includes("contrato") || e.includes("assinado") || e.includes("cliente")) return "Fechamentos";
  if (
    e.includes("reuniao") || e.includes("proposta") || e.includes("oportunidade") ||
    e.includes("opps") || e.includes("negociac")
  ) return "Oportunidade";
  if (
    e.includes("agendado") || e.includes("agendamento") || e.includes("qualificac") ||
    e.includes("pre-qualif") || e.includes("sql")
  ) return "Qualificação";
  if (
    e.includes("tentativa") || e.includes("conectado") || e.includes("ativado") ||
    e.includes("conexao")
  ) return "Conexão";
  return "Prospecção";
}

function fmtValor(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

type LeadFilter = { type: "canal" | "estado" | "conversao" | "etapa" | "funil" | "metaCampaign" | "metaAdset" | "metaAd" | "utmCampaign"; value: string; label: string } | null;

export function FunilCrmSection({
  clienteId,
  dateRange,
  leadFilter,
  onFilter,
  perfilPanel,
}: {
  clienteId: string;
  dateRange: { from: string; to: string };
  leadFilter?: LeadFilter;
  onFilter?: (f: LeadFilter) => void;
  perfilPanel?: string | null;
}) {
  const isAgencia = perfilPanel === "agencia";
  const filterQs = leadFilter
    ? `&filterType=${encodeURIComponent(leadFilter.type)}&filterValue=${encodeURIComponent(leadFilter.value)}`
    : "";
  const paidOnlyQs = isAgencia ? "&paidOnly=1" : "";

  const { data, isLoading } = useQuery<FunilData>({
    queryKey: ["crm-funil", clienteId, dateRange.from, dateRange.to, leadFilter?.type, leadFilter?.value, isAgencia],
    queryFn: () =>
      fetch(
        `/api/clientes/${clienteId}/crm/funil?from=${dateRange.from}&to=${dateRange.to}${filterQs}${paidOnlyQs}`
      ).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
        <CardContent className="flex h-24 items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.configured) return null;

  const etapas = data.etapas ?? [];
  const totalLeads = data.totalLeads;

  const grouped = isAgencia
    ? MACRO_ORDER_AGENCIA.map((grupo) => {
        const grupoEtapas = etapas.filter((e) => getMacroGrupoAgencia(e.etapa) === grupo);
        const count = grupoEtapas.reduce((s, e) => s + e.count, 0);
        const valor = grupoEtapas.reduce((s, e) => s + e.valor, 0);
        return { grupo, etapas: grupoEtapas, count, valor };
      }).filter((g) => g.etapas.length > 0)
    : MACRO_ORDER.map((grupo) => {
        const grupoEtapas = etapas.filter((e) => getMacroGrupo(e.etapa) === grupo);
        const count = grupoEtapas.reduce((s, e) => s + e.count, 0);
        const valor = grupoEtapas.reduce((s, e) => s + e.valor, 0);
        return { grupo, etapas: grupoEtapas, count, valor };
      }).filter((g) => g.etapas.length > 0);

  const macroColors: Record<string, string> = isAgencia ? MACRO_COLORS_AGENCIA : MACRO_COLORS;

  const taxaFechamento = totalLeads > 0
    ? ((data.totalGanhos / totalLeads) * 100).toFixed(1)
    : "0.0";

  // Donut ring
  const r = 44;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = grouped.map((g) => {
    const pct = totalLeads > 0 ? (g.count / totalLeads) * 100 : 0;
    const dash = (pct / 100) * circumference;
    const slice = { grupo: g.grupo, count: g.count, pct, dash, offset };
    offset += dash;
    return slice;
  });

  return (
    <Card className="overflow-hidden rounded-2xl border-[var(--border)]">
      <CardContent className="space-y-4 pt-6">

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Leads no período", value: totalLeads.toLocaleString("pt-BR"), color: "var(--foreground)" },
            { label: "Fechamentos", value: data.totalGanhos.toLocaleString("pt-BR"), color: "#10b981" },
            { label: "Taxa de fechamento", value: `${taxaFechamento}%`, color: "var(--primary)" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3 text-center"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                {kpi.label}
              </p>
              <p
                className="mt-1 text-lg font-extrabold tabular-nums"
                style={{ color: kpi.color }}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Donut ring + legend */}
        {grouped.length > 0 && (
          <div className="flex items-center gap-5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 px-4 py-4">
            {/* Ring */}
            <div className="relative shrink-0" style={{ width: 112, height: 112 }}>
              <svg width={112} height={112}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={12}
                />
                {slices.map((s) => (
                  <circle
                    key={s.grupo}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={macroColors[s.grupo]}
                    strokeWidth={12}
                    strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                    strokeDashoffset={-s.offset + circumference * 0.25}
                    strokeLinecap="butt"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-extrabold tabular-nums text-[var(--foreground)]">{totalLeads}</p>
                <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">leads</p>
              </div>
            </div>

            {/* Legend bars */}
            <div className="flex-1 space-y-2.5">
              {slices.map((s) => (
                <div key={s.grupo} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: macroColors[s.grupo] }}
                      />
                      <span className="text-[11px] font-semibold text-[var(--foreground)]">{s.grupo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] font-bold tabular-nums"
                        style={{ color: macroColors[s.grupo] }}
                      >
                        {s.count.toLocaleString("pt-BR")}
                      </span>
                      <span className="w-8 text-right text-[10px] tabular-nums text-[var(--muted-foreground)]">
                        {s.pct < 1 ? s.pct.toFixed(1) : Math.round(s.pct)}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-1 w-full overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.pct}%`,
                        background: macroColors[s.grupo],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed stages grouped by macro */}
        {grouped.length > 0 && (
          <div className="space-y-4">
            {grouped.map((grupo) => {
              const color = macroColors[grupo.grupo];
              const pctGrupo = totalLeads > 0 ? (grupo.count / totalLeads) * 100 : 0;
              const maxInGroup = Math.max(...grupo.etapas.map((e) => e.count), 1);
              return (
                <div key={grupo.grupo} className="space-y-1.5">
                  {/* Group header */}
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color }}
                    >
                      {grupo.grupo}
                    </p>
                    <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
                      {grupo.count.toLocaleString("pt-BR")} {grupo.count === 1 ? "lead" : "leads"}
                      {" · "}
                      {pctGrupo < 1 ? pctGrupo.toFixed(1) : Math.round(pctGrupo)}%
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>

                  {/* Stage rows */}
                  <div className="space-y-1">
                    {grupo.etapas.map((e) => {
                      const pctInGroup = (e.count / maxInGroup) * 100;
                      const pctTotal = totalLeads > 0 ? (e.count / totalLeads) * 100 : 0;
                      const isActive = leadFilter?.type === "etapa" && leadFilter.value === e.etapa;
                      const clickable = !!onFilter;
                      const toggle = clickable
                        ? () => onFilter!(isActive ? null : { type: "etapa", value: e.etapa, label: `Etapa: ${e.etapa}` })
                        : undefined;
                      return (
                        <div
                          key={e.etapa}
                          onClick={toggle}
                          onKeyDown={clickable ? (ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault();
                              toggle!();
                            }
                          } : undefined}
                          role={clickable ? "button" : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          aria-pressed={clickable ? isActive : undefined}
                          className={`group relative overflow-hidden rounded-lg border bg-[var(--card)] px-3 py-2 transition-all ${
                            clickable ? "cursor-pointer hover:border-[color-mix(in_srgb,var(--primary)_30%,var(--border))]" : ""
                          } ${isActive ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/40" : "border-[var(--border)]"}`}
                        >
                          {/* Gradient fill bar */}
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0 transition-all"
                            style={{
                              width: `${pctInGroup}%`,
                              background: `linear-gradient(90deg, ${color}22, transparent)`,
                              borderLeft: `2px solid ${color}55`,
                            }}
                          />
                          <div className="relative flex items-center gap-3">
                            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--foreground)]">
                              {e.etapa}
                            </p>
                            {e.valor > 0 && (
                              <span className="hidden shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)] sm:inline">
                                {fmtValor(e.valor)}
                              </span>
                            )}
                            {/* Mini progress bar */}
                            <div
                              className="hidden h-1 shrink-0 overflow-hidden rounded-full sm:block"
                              style={{ width: 64, background: "rgba(255,255,255,0.06)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pctInGroup}%`,
                                  background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                }}
                              />
                            </div>
                            <span className="shrink-0 w-8 text-right text-[11px] tabular-nums text-[var(--muted-foreground)]">
                              {pctTotal < 1 ? pctTotal.toFixed(1) : Math.round(pctTotal)}%
                            </span>
                            <span
                              className="w-12 shrink-0 text-right text-sm font-bold tabular-nums"
                              style={{ color }}
                            >
                              {e.count.toLocaleString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
