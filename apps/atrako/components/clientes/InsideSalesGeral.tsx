"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MetricTile } from "@/components/ui";
import type { InsideSalesOverview } from "@/lib/qualification/overview";
import { buttonClass } from "@/components/ui/button";
import { useCrmLinks } from "@/components/crm/CrmLinksContext";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function InsideSalesGeral({
  workspaceId,
  query,
}: {
  workspaceId: string;
  /** Mesmos params do consolidado (periodo, dataInicio, dataFim). */
  query: string;
}) {
  const links = useCrmLinks();
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ["inside-sales-overview", workspaceId, query],
    queryFn: async () => {
      const res = await fetch(`/api/atrako/crm/overview?workspaceId=${encodeURIComponent(workspaceId)}&${query}`);
      if (!res.ok) throw new Error("fail");
      return (await res.json()) as InsideSalesOverview;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  if (isError) {
    return (
      <div className="rel-card p-5 type-caption text-[var(--ink-muted-48)]">
        Não foi possível carregar o painel de leads.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rel-card p-5 type-caption text-[var(--ink-muted-48)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o funil…
      </div>
    );
  }

  const { kpis, stages, attention, midia } = data;
  const stageMax = Math.max(1, ...stages.map((s) => s.count));
  const cpl =
    midia.leadsMidia > 0 && midia.investimento > 0
      ? midia.investimento / midia.leadsMidia
      : null;

  return (
    <section className={`space-y-4 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      <div className="rel-kpi-grid">
        <MetricTile label="Novos no período" value={fmt(kpis.newLeads)} detail={`${fmt(kpis.openLeads)} em aberto`} />
        <MetricTile
          label="Quentes"
          value={fmt(kpis.priorityA)}
          detail={`${fmt(kpis.priorityB)} interessados · ${fmt(kpis.priorityC)} nutrição`}
          tone={kpis.priorityA > 0 ? "positive" : undefined}
        />
        <MetricTile
          label="Aguardando WhatsApp"
          value={fmt(kpis.awaitingWhatsApp)}
          detail={
            kpis.inConversation > 0 ? `${fmt(kpis.inConversation)} em conversa` : "Resposta do form"
          }
        />
        <MetricTile
          label="Agendar conversa"
          value={fmt(kpis.scheduleMeeting)}
          detail={
            kpis.inCadence > 0
              ? `${fmt(kpis.inCadence)} na cadência`
              : kpis.wonInPeriod > 0
                ? `${fmt(kpis.wonInPeriod)} ganhos no período`
                : "Prioridade A/B prontos"
          }
          tone={kpis.scheduleMeeting > 0 ? "negative" : undefined}
        />
        {midia.investimento > 0 ? (
          <>
            <MetricTile label="Investimento" value={brl(midia.investimento)} detail="Mídia no período" />
            <MetricTile
              label="CPL mídia"
              value={cpl != null ? brl(cpl) : "—"}
              detail={`${fmt(midia.leadsMidia)} leads pelos anúncios`}
            />
          </>
        ) : null}
      </div>

      <div className="rel-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="type-caption-strong text-[var(--ink)]">Funil agora</p>
            <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">
              Leads abertos por etapa
            </p>
          </div>
          <Link href={links.leadsHref} className={buttonClass({ variant: "ghost", size: "toolbar" })}>
            Abrir Leads
          </Link>
        </div>
        {stages.every((s) => s.count === 0) ? (
          <p className="mt-4 type-fine-print text-[var(--ink-muted-48)]">Nenhum lead em aberto</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {stages.map((s) => (
              <li key={s.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="type-caption text-[var(--ink)]">{s.name}</span>
                  <span className="type-caption-strong tabular-nums text-[var(--ink)]">{fmt(s.count)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--canvas-parchment)]">
                  <div
                    className="h-full rounded-[var(--radius-pill)] transition-[width]"
                    style={{
                      width: `${Math.round((s.count / stageMax) * 100)}%`,
                      background: s.color || "var(--primary)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rel-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="type-caption-strong text-[var(--ink)]">Onde agir</p>
            <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">
              Prioridade e próximo passo
            </p>
          </div>
        </div>
        {!attention.length ? (
          <p className="mt-4 type-fine-print text-[var(--ink-muted-48)]">
            Nada urgente — acompanhe novos formulários e o WhatsApp.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--divider-soft)]">
            {attention.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="type-caption-strong text-[var(--ink)]">{row.name}</p>
                  <p className="mt-0.5 type-fine-print text-[var(--ink-muted-80)]">{row.nextAction}</p>
                  <p className="mt-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                    {[row.priorityLabel, row.stageName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Link href={links.leadHref(row.id)} className="shrink-0 type-fine-print text-[var(--primary)] active:scale-95">
                  Ver no funil
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
