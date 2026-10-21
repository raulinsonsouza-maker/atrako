"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MetricTile } from "@/components/ui";
import { useCrmLinks } from "@/components/crm/CrmLinksContext";
import { Delta, pctChange } from "@/components/atendimento/Delta";
import { LeadQualityPanel } from "@/components/atendimento/LeadQualityPanel";
import type { Inicio } from "@/lib/atendimento/inicio";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function CardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="type-caption-strong text-[var(--ink)]">{title}</h2>
      {action}
    </div>
  );
}

function Numeros({ data }: { data: Inicio }) {
  const { current: c, previous: p } = data;
  return (
    <div className="rel-kpi-grid">
      <MetricTile label="Leads novos" value={fmt(c.leads)} delta={<Delta value={pctChange(c.leads, p.leads)} />} />
      <MetricTile
        label="Qualificados"
        value={fmt(c.qualified)}
        delta={<Delta value={pctChange(c.qualified, p.qualified)} />}
        detail={c.leads ? `${pct(c.qualified, c.leads)}% · ${fmt(c.hot)} quentes` : undefined}
      />
      <MetricTile
        label="Vendas"
        value={fmt(c.won)}
        tone={c.won > 0 ? "positive" : undefined}
        delta={<Delta value={pctChange(c.won, p.won)} />}
        detail={c.revenue ? brl(c.revenue) : undefined}
      />
      <MetricTile
        label="Investimento"
        value={c.spend ? brl(c.spend) : "—"}
        delta={c.spend ? <Delta value={pctChange(c.spend, p.spend)} invert /> : undefined}
        detail={c.cpl != null ? `${brl(c.cpl)} por lead` : undefined}
      />
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`type-body-strong tabular-nums ${alert ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}>{value}</p>
      <p className="truncate type-micro-legal text-[var(--ink-muted-48)]">{label}</p>
    </div>
  );
}

function Atencao({ data }: { data: Inicio }) {
  const links = useCrmLinks();
  const { now } = data;
  return (
    <section className="rel-card flex flex-col gap-4 p-5">
      <CardHead
        title="Precisa de atenção"
        action={
          <Link href={links.leadsHref} className="type-fine-print text-[var(--primary)]">
            Ver leads
          </Link>
        }
      />
      <div className="grid grid-cols-4 gap-3 rounded-[var(--radius-md)] bg-[var(--canvas-parchment)] px-4 py-3">
        <Stat label="Agendar" value={fmt(now.scheduleMeeting)} alert={now.scheduleMeeting > 0} />
        <Stat label="Sem resposta" value={fmt(now.awaitingWhatsApp)} />
        <Stat label="Em conversa" value={fmt(now.inConversation + now.inCadence)} />
        <Stat label="A receber" value={now.pendingLinks.count ? brl(now.pendingLinks.amount) : "—"} />
      </div>
      {now.attention.length ? (
        <ul className="divide-y divide-[var(--divider-soft)]">
          {now.attention.slice(0, 6).map((row) => (
            <li key={row.id}>
              <Link href={links.leadHref(row.id)} className="flex items-center justify-between gap-3 py-2.5 active:scale-[0.99]">
                <span className="min-w-0">
                  <span className="block truncate type-caption-strong text-[var(--ink)]">{row.name}</span>
                  <span className="block truncate type-fine-print text-[var(--ink-muted-48)]">{row.nextAction}</span>
                </span>
                {row.priorityLabel ? (
                  <span className="shrink-0 rounded-[var(--radius-xs)] bg-[var(--surface-chip-translucent)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-80)]">
                    {row.priorityLabel}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Tudo em dia</p>
      )}
    </section>
  );
}

function Funil({ data }: { data: Inicio }) {
  const entered = data.funnel[0]?.count ?? 0;
  return (
    <section className="rel-card flex flex-col gap-4 p-5">
      <CardHead title="Funil do período" />
      {!entered ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Nenhum lead no período</p>
      ) : (
        <ol className="space-y-3">
          {data.funnel.map((step, i) => {
            const isDrop = data.drop?.to === step.label;
            return (
              <li key={step.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate type-caption text-[var(--ink)]">{step.label}</span>
                  <span className="shrink-0 type-caption-strong tabular-nums text-[var(--ink)]">
                    {fmt(step.count)}
                    {i > 0 && step.rate != null ? (
                      <span className={`ml-1.5 type-fine-print ${isDrop ? "text-[var(--danger)]" : "text-[var(--ink-muted-48)]"}`}>
                        {step.rate}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--canvas-parchment)]">
                  <div
                    className="h-full rounded-[var(--radius-pill)] bg-[var(--primary)] transition-[width]"
                    style={{ width: `${Math.max(step.count ? 2 : 0, pct(step.count, entered))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Origens({ data }: { data: Inicio }) {
  const anySpend = data.origins.some((o) => o.spend != null);
  if (!data.origins.length) return null;
  return (
    <section className="rel-card overflow-x-auto p-5">
      <CardHead title="Origem dos leads" />
      <table className="mt-3 w-full min-w-[480px] text-left">
        <thead>
          <tr className="type-micro-legal text-[var(--ink-muted-48)]">
            <th className="pb-2 font-normal">Origem</th>
            <th className="pb-2 text-right font-normal">Leads</th>
            <th className="pb-2 text-right font-normal">Qualificados</th>
            <th className="pb-2 text-right font-normal">Vendas</th>
            {anySpend ? <th className="pb-2 text-right font-normal">Investido</th> : null}
            {anySpend ? <th className="pb-2 text-right font-normal">Por lead</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--divider-soft)]">
          {data.origins.map((o) => (
            <tr key={o.key} className="type-caption text-[var(--ink)]">
              <td className="max-w-[220px] truncate py-2.5 pr-3">{o.label}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(o.leads)}</td>
              <td className="py-2.5 text-right tabular-nums">
                {fmt(o.qualified)}
                {o.leads ? <span className="ml-1 type-fine-print text-[var(--ink-muted-48)]">{pct(o.qualified, o.leads)}%</span> : null}
              </td>
              <td className="py-2.5 text-right tabular-nums">{fmt(o.won)}</td>
              {anySpend ? <td className="py-2.5 text-right tabular-nums">{o.spend != null ? brl(o.spend) : "—"}</td> : null}
              {anySpend ? <td className="py-2.5 text-right tabular-nums">{o.cpl != null ? brl(o.cpl) : "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function InicioGeral({ workspaceId, query }: { workspaceId: string; query: string }) {
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ["atendimento-inicio", workspaceId, query],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/atendimento/inicio?workspaceId=${encodeURIComponent(workspaceId)}&${query}`);
      if (!r.ok) throw new Error("fail");
      return (await r.json()) as Inicio;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  if (isError) {
    return <div className="rel-card p-5 type-caption text-[var(--ink-muted-48)]">Não foi possível carregar o painel.</div>;
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rel-card p-5 type-caption text-[var(--ink-muted-48)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      <Numeros data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Atencao data={data} />
        <Funil data={data} />
      </div>
      <Origens data={data} />
      <LeadQualityPanel workspaceId={workspaceId} query={query} profileOnly />
    </div>
  );
}
