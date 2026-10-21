"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MetricTile } from "@/components/ui";
import type { LeadQuality, QualityBucket } from "@/lib/qualification/quality";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function BarCard({
  title,
  subtitle,
  buckets,
  total,
  limit,
}: {
  title: string;
  subtitle?: string;
  buckets: QualityBucket[];
  total: number;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const ranked = limit ? [...buckets].filter((b) => b.count > 0).sort((a, b) => b.count - a.count) : buckets;
  const shown = limit && !expanded ? ranked.slice(0, limit) : ranked;
  const hidden = ranked.length - shown.length;
  return (
    <div className="rel-card p-5">
      <p className="type-caption-strong text-[var(--ink)]">{title}</p>
      {subtitle ? <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">{subtitle}</p> : null}
      {total === 0 ? (
        <p className="mt-4 type-fine-print text-[var(--ink-muted-48)]">Sem respostas no período</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((b) => (
            <li key={b.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate type-caption text-[var(--ink)]">{b.label}</span>
                <span className="shrink-0 type-caption-strong tabular-nums text-[var(--ink)]">
                  {fmt(b.count)}
                  <span className="ml-1.5 type-fine-print text-[var(--ink-muted-48)]">{pct(b.count, total)}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--canvas-parchment)]">
                <div
                  className="h-full rounded-[var(--radius-pill)] bg-[var(--primary)] transition-[width]"
                  style={{ width: `${Math.round((b.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > 0 && (hidden > 0 || expanded) ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 type-fine-print text-[var(--primary)] active:scale-95"
        >
          {expanded ? "Mostrar menos" : `Ver todos (+${hidden})`}
        </button>
      ) : null}
    </div>
  );
}

export function LeadQualityPanel({
  workspaceId,
  query,
  profileOnly = false,
}: {
  workspaceId: string;
  query: string;
  /** Só o perfil (respostas, estado, cidade): indicadores e origens ficam nos outros blocos do Início. */
  profileOnly?: boolean;
}) {
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ["lead-quality", workspaceId, query],
    queryFn: async () => {
      const res = await fetch(`/api/atrako/crm/qualification?workspaceId=${encodeURIComponent(workspaceId)}&${query}`);
      if (!res.ok) throw new Error("fail");
      return (await res.json()) as LeadQuality;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  if (isError) {
    return (
      <div className="rel-card p-5 type-caption text-[var(--ink-muted-48)]">
        Não foi possível carregar a qualificação dos leads.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rel-card p-5 type-caption text-[var(--ink-muted-48)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando a qualificação…
      </div>
    );
  }

  const { totals, priority, fields, states, cities, origins, answerChannels } = data;
  const sum = (list: QualityBucket[]) => list.reduce((acc, b) => acc + b.count, 0);

  if (profileOnly) {
    const answeredFields = fields.filter((f) => f.answered > 0);
    if (!answeredFields.length && !states.length && !cities.length) {
      return <div className="rel-card p-5 type-fine-print text-[var(--ink-muted-48)]">Sem respostas no período</div>;
    }
    return (
      <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
        {answeredFields.map((field) => (
          <BarCard
            key={field.key}
            title={field.label}
            buckets={field.buckets}
            total={field.answered}
            limit={5}
          />
        ))}
        {states.length ? <BarCard title="Estado" buckets={states} total={sum(states)} limit={5} /> : null}
        {cities.length ? <BarCard title="Cidade" buckets={cities} total={sum(cities)} limit={5} /> : null}
      </div>
    );
  }

  return (
    <section className={`space-y-4 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      <div>
        <p className="type-body-strong text-[var(--ink)]">Qualidade dos leads</p>
        <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">
          Respostas da landing page, do formulário passo a passo e do WhatsApp para os leads que entraram no período
        </p>
      </div>

      <div className="rel-kpi-grid">
        <MetricTile
          label="Responderam"
          value={`${pct(totals.withAnswers, totals.leads)}%`}
          detail={`${fmt(totals.withAnswers)} de ${fmt(totals.leads)} leads`}
        />
        <MetricTile
          label="Preenchimento médio"
          value={`${totals.avgFilled}%`}
          detail={`${fmt(totals.complete)} com todas as perguntas`}
        />
        <MetricTile
          label="Quentes"
          value={fmt(priority.A)}
          detail={`${pct(priority.A, totals.classified)}% dos classificados`}
          tone={priority.A > 0 ? "positive" : undefined}
        />
        <MetricTile
          label="Classificados"
          value={fmt(totals.classified)}
          detail={`${fmt(priority.B)} interessados · ${fmt(priority.C)} nutrição · ${fmt(priority.none)} sem dados`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <BarCard
            key={field.key}
            title={field.label}
            subtitle={`${fmt(field.answered)} ${field.answered === 1 ? "resposta" : "respostas"}`}
            buckets={field.buckets}
            total={field.answered}
          />
        ))}
        <BarCard title="Estado" subtitle="De onde vêm os leads" buckets={states} total={sum(states)} />
        <BarCard title="Cidade" subtitle="Cidades com mais leads" buckets={cities} total={sum(cities)} />
        <BarCard title="Origem" subtitle="Campanha (UTM) ou formulário de entrada" buckets={origins} total={sum(origins)} />
        <BarCard
          title="Onde responderam"
          subtitle="Canal de cada resposta coletada"
          buckets={answerChannels}
          total={sum(answerChannels)}
        />
      </div>
    </section>
  );
}
