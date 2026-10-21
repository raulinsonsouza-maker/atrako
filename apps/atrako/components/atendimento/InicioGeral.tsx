"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MetricTile } from "@/components/ui";
import { buttonClass } from "@/components/ui/button";
import { useCrmLinks } from "@/components/crm/CrmLinksContext";
import { Delta, pctChange } from "@/components/atendimento/Delta";
import { LeadQualityPanel } from "@/components/atendimento/LeadQualityPanel";
import type { Inicio } from "@/lib/atendimento/inicio";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function SectionHead({ step, title, subtitle, action }: { step: number; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="type-micro-legal text-[var(--ink-muted-48)]">{step}</p>
        <p className="type-body-strong text-[var(--ink)]">{title}</p>
        <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: string; tone?: "alert" }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] bg-[var(--canvas-parchment)] px-4 py-3">
      <p className={`type-tagline tabular-nums ${tone === "alert" ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}>{value}</p>
      <p className="truncate type-fine-print text-[var(--ink-muted-48)]">{label}</p>
    </div>
  );
}

function AgoraBlock({ data }: { data: Inicio }) {
  const links = useCrmLinks();
  const { now } = data;
  return (
    <section className="space-y-4">
      <SectionHead
        step={1}
        title="O que fazer agora"
        subtitle="Leads abertos que pedem ação da equipe, independente do período"
        action={
          <Link href={links.leadsHref} className={buttonClass({ variant: "ghost", size: "toolbar" })}>
            Abrir Leads
          </Link>
        }
      />
      <div className="rel-card space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Counter label="Agendar conversa" value={fmt(now.scheduleMeeting)} tone={now.scheduleMeeting > 0 ? "alert" : undefined} />
          <Counter label="Aguardando WhatsApp" value={fmt(now.awaitingWhatsApp)} />
          <Counter label="Em conversa ou cadência" value={fmt(now.inConversation + now.inCadence)} />
          <Counter
            label={now.pendingLinks.count ? `A receber em ${fmt(now.pendingLinks.count)} ${now.pendingLinks.count === 1 ? "link" : "links"}` : "Links de pagamento"}
            value={now.pendingLinks.count ? brl(now.pendingLinks.amount) : "—"}
          />
        </div>
        {!now.attention.length ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">Nada urgente. Acompanhe novos formulários e o WhatsApp.</p>
        ) : (
          <ul className="divide-y divide-[var(--divider-soft)]">
            {now.attention.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="type-caption-strong text-[var(--ink)]">{row.name}</p>
                  <p className="mt-0.5 type-fine-print text-[var(--ink-muted-80)]">{row.nextAction}</p>
                  <p className="mt-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                    {[row.priorityLabel, row.stageName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Link href={links.leadHref(row.id)} className="shrink-0 type-fine-print text-[var(--primary)] active:scale-95">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PeriodoBlock({ data, periodLabel }: { data: Inicio; periodLabel: string }) {
  const { current: c, previous: p } = data;
  return (
    <section className="space-y-4">
      <SectionHead step={2} title="Como foi o período" subtitle={`${periodLabel}, comparado ao mesmo número de dias antes`} />
      <p className="type-body text-[var(--ink)]">{data.summary}</p>
      <div className="rel-kpi-grid">
        <MetricTile label="Leads novos" value={fmt(c.leads)} delta={<Delta value={pctChange(c.leads, p.leads)} />} />
        <MetricTile
          label="Qualificados"
          value={fmt(c.qualified)}
          tone={c.hot > 0 ? "positive" : undefined}
          delta={<Delta value={pctChange(c.qualified, p.qualified)} />}
          detail={c.leads ? `${pct(c.qualified, c.leads)}% dos leads · ${fmt(c.hot)} quentes` : undefined}
        />
        <MetricTile
          label="Vendas"
          value={fmt(c.won)}
          tone={c.won > 0 ? "positive" : undefined}
          delta={<Delta value={pctChange(c.won, p.won)} />}
          detail={c.revenue ? `${brl(c.revenue)} recebidos` : "Nenhum valor recebido"}
        />
        <MetricTile
          label="Investimento"
          value={c.spend ? brl(c.spend) : "—"}
          delta={<Delta value={pctChange(c.spend, p.spend)} invert />}
          detail={
            c.spend
              ? [c.cpl != null ? `${brl(c.cpl)} por lead` : null, c.costPerSale != null ? `${brl(c.costPerSale)} por venda` : null]
                  .filter(Boolean)
                  .join(" · ")
              : "Sem investimento em anúncios"
          }
        />
      </div>
    </section>
  );
}

function JornadaBlock({ data }: { data: Inicio }) {
  const links = useCrmLinks();
  const entered = data.funnel[0]?.count ?? 0;
  const openStages = data.now.stages.filter((s) => s.count > 0);
  return (
    <section className="space-y-4">
      <SectionHead step={3} title="Onde os leads travam" subtitle="Até onde chegaram os leads que entraram no período" />
      <div className="rel-card p-5">
        {!entered ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhum lead entrou no período</p>
        ) : (
          <ol className="space-y-3">
            {data.funnel.map((step, i) => (
              <li key={step.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate type-caption text-[var(--ink)]">{step.label}</span>
                  <span className="shrink-0 type-caption-strong tabular-nums text-[var(--ink)]">
                    {fmt(step.count)}
                    {i > 0 && step.rate != null ? (
                      <span className="ml-1.5 type-fine-print text-[var(--ink-muted-48)]">{step.rate}% avançaram</span>
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
            ))}
          </ol>
        )}
        {data.drop ? (
          <p className="mt-4 type-caption text-[var(--ink-muted-80)]">
            Maior perda: {fmt(data.drop.lost)} {data.drop.lost === 1 ? "lead parou" : "leads pararam"} entre “{data.drop.from}” e “{data.drop.to}”.
          </p>
        ) : null}
        {openStages.length ? (
          <div className="mt-4 border-t border-[var(--divider-soft)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="type-fine-print text-[var(--ink-muted-48)]">Abertos agora por etapa do funil</p>
              <Link href={links.leadsHref} className="type-fine-print text-[var(--primary)]">
                Ver no funil
              </Link>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {openStages.map((s) => (
                <li key={s.id} className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--canvas-parchment)] px-3 py-1.5 type-fine-print text-[var(--ink)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color || "var(--primary)" }} />
                  {s.name}
                  <span className="tabular-nums text-[var(--ink-muted-48)]">{fmt(s.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OrigemBlock({ data }: { data: Inicio }) {
  const anySpend = data.origins.some((o) => o.spend != null);
  return (
    <section className="space-y-4">
      <SectionHead
        step={4}
        title="De onde vem o resultado"
        subtitle="Campanha ou origem de cada lead do período, com qualidade, vendas e custo"
      />
      <div className="rel-card overflow-x-auto p-5">
        {!data.origins.length ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">Sem leads no período</p>
        ) : (
          <table className="w-full min-w-[520px] text-left">
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
        )}
      </div>
    </section>
  );
}

export function InicioGeral({
  workspaceId,
  query,
  periodLabel,
}: {
  workspaceId: string;
  query: string;
  periodLabel: string;
}) {
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
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o painel…
      </div>
    );
  }

  return (
    <div className={`space-y-10 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      <AgoraBlock data={data} />
      <PeriodoBlock data={data} periodLabel={periodLabel} />
      <JornadaBlock data={data} />
      <OrigemBlock data={data} />
      <section className="space-y-4">
        <SectionHead step={5} title="Quem são os leads" subtitle="Respostas da qualificação dos leads que entraram no período" />
        <LeadQualityPanel workspaceId={workspaceId} query={query} profileOnly />
      </section>
    </div>
  );
}
