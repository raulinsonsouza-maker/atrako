"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SegmentedControl } from "@/components/ui";
import { api, brl, brlMicros, dateBR, num, pct } from "@/components/relacionamento/format";
import { rate, useOverview } from "@/components/relacionamento/overview";
import type { RelPeriod } from "@/components/relacionamento/period";
import type { Flow } from "@/components/relacionamento/FlowsTab";
import { DeliveryList } from "@/components/relacionamento/DeliveriesTab";
import { ChannelIcon, RelEmpty, RelKpi, RelLoading, RelSection } from "@/components/relacionamento/ui";

type CampaignResult = {
  id: string;
  name: string;
  status: string;
  sentAt: string | null;
  channel: string;
  stats: { sent: number; opened: number; clicked: number; converted: number; cents: number; costMicros: number } | null;
};

/** Diferença de conversão tratado vs controle, em pontos percentuais. */
function lift(f: Flow) {
  const t = f.holdout.treated;
  const c = f.holdout.control;
  if (c.n < 30 || t.n < 30) return null;
  return { pp: (t.rate - c.rate) * 100, incremental: Math.round((t.rate - c.rate) * t.n) };
}

export function DesempenhoTab({
  workspaceId,
  period,
  sub,
  onSub,
}: {
  workspaceId: string;
  period: RelPeriod;
  sub?: string;
  onSub: (sub: string) => void;
}) {
  const view = sub === "envios" ? "envios" : "resumo";
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        className="self-start"
        aria-label="Visão de desempenho"
        value={view}
        onChange={(v) => onSub(v === "resumo" ? "" : v)}
        options={[
          { value: "resumo", label: "Resumo" },
          { value: "envios", label: "Histórico de envios" },
        ]}
      />
      {view === "envios" ? <DeliveryList workspaceId={workspaceId} period={period} /> : <Resumo workspaceId={workspaceId} period={period} />}
    </div>
  );
}

function Resumo({ workspaceId, period }: { workspaceId: string; period: RelPeriod }) {
  const overview = useOverview(workspaceId, period);
  const flows = useQuery({
    queryKey: ["rel-flows", workspaceId, period.qs],
    queryFn: () => api<{ flows: Flow[] }>(`/api/atrako/relacionamento/flows?workspaceId=${workspaceId}&${period.qs}`),
    placeholderData: (prev) => prev,
  });
  const campaigns = useQuery({
    queryKey: ["rel-campaigns", workspaceId],
    queryFn: () => api<{ campaigns: CampaignResult[] }>(`/api/atrako/relacionamento/campaigns?workspaceId=${workspaceId}`),
  });

  const data = overview.data;
  if (!data) return <RelLoading />;

  const e = data.email;
  const w = data.whatsapp;
  const share = rate(data.attributed.cents, data.storeRevenue.cents);
  const roi = w.costMicros ? data.attributed.cents / 100 / (w.costMicros / 1_000_000) : 0;
  const since = new Date(data.since).getTime();
  const until = new Date(data.until).getTime();
  const sentCampaigns = (campaigns.data?.campaigns ?? []).filter((c) => {
    if (!c.stats?.sent || !c.sentAt) return false;
    const t = new Date(c.sentAt).getTime();
    return t >= since && t <= until;
  });
  const flowRows = (flows.data?.flows ?? [])
    .map((f) => {
      const sent = f.steps.reduce((s, st) => s + st.stats.sent, 0);
      const clicked = f.steps.reduce((s, st) => s + st.stats.clicked, 0);
      return { f, sent, clicked };
    })
    .sort((a, b) => b.f.attributed.cents - a.f.attributed.cents || b.clicked - a.clicked);

  return (
    <>
      <div className="rel-kpi-grid">
        <RelKpi
          label="Receita atribuída"
          value={brl(data.attributed.cents)}
          detail={`${num(data.attributed.orders)} pedidos`}
          info="Comprou depois de clicar na mensagem ou usou o cupom dela."
        />
        <RelKpi
          label="Receita influenciada"
          value={brl(data.influenced.cents)}
          detail={`${num(data.influenced.orders)} pedidos`}
          info="Recebeu a mensagem e comprou dentro da janela, sem clicar."
        />
        <RelKpi label="Peso na receita" value={data.storeRevenue.cents ? pct(share * 100, 100) : "—"} detail={`de ${brl(data.storeRevenue.cents)}`} />
        <RelKpi
          label="Custo WhatsApp"
          value={brlMicros(w.costMicros)}
          detail={roi ? `Retorno ${roi.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}×` : `${num(w.sent)} mensagens`}
          info="E-mail não tem custo por envio. Retorno = receita atribuída ÷ custo do WhatsApp."
        />
        <RelKpi label="E-mails enviados" value={num(e.sent)} detail={e.sent ? `${pct(e.delivered, e.sent)} entregues` : undefined} />
        <RelKpi
          label="Abertura"
          value={pct(e.opened, e.delivered || e.sent)}
          info="O Apple Mail abre e-mails sozinho e infla esta taxa. Use cliques para comparar."
        />
        <RelKpi label="Cliques" value={pct(e.clicked, e.delivered || e.sent)} detail={e.clicked ? `${num(e.clicked)} e-mails` : undefined} />
        <RelKpi label="WhatsApp lidos" value={pct(w.opened, w.delivered || w.sent)} detail={w.clicked ? `${num(w.clicked)} cliques` : undefined} />
      </div>

      <RelSection
        title="Por fluxo"
        info="Efeito real: compare quem recebeu com o grupo de controle (que não recebe nada). Ligue o grupo de controle em cada fluxo (5–20%). Precisa de 30 pessoas em cada lado."
      >
        {!flows.data ? (
          <RelLoading compact />
        ) : flowRows.length ? (
          <div className="overflow-x-auto">
            <table className="rel-table type-caption">
              <thead>
                <tr>
                  <th>Fluxo</th>
                  <th>Entraram</th>
                  <th>Envios</th>
                  <th>Cliques</th>
                  <th>Atribuída</th>
                  <th>Influenciada</th>
                  <th>Efeito real</th>
                </tr>
              </thead>
              <tbody>
                {flowRows.map(({ f, sent, clicked }) => {
                  const l = lift(f);
                  return (
                    <tr key={f.id}>
                      <td className="text-[var(--ink)]">{f.name}</td>
                      <td className="tabular-nums">{num(f.entered)}</td>
                      <td className="tabular-nums">{num(sent)}</td>
                      <td className="tabular-nums">{pct(clicked, sent)}</td>
                      <td className="tabular-nums">
                        {brl(f.attributed.cents)}
                        <span className="type-micro-legal block text-[var(--ink-muted-48)]">{num(f.attributed.orders)} pedidos</span>
                      </td>
                      <td className="tabular-nums">{brl(f.influenced.cents)}</td>
                      <td>
                        {!f.holdoutPercent ? (
                          <span className="type-fine-print text-[var(--ink-muted-48)]">—</span>
                        ) : l ? (
                          <span className="type-caption tabular-nums text-[var(--ink)]" title={`${pct(f.holdout.treated.converted, f.holdout.treated.n)} com mensagens vs ${pct(f.holdout.control.converted, f.holdout.control.n)} sem`}>
                            {l.pp >= 0 ? "+" : ""}
                            {l.pp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.
                            <span className="type-micro-legal block text-[var(--ink-muted-48)]">~{num(Math.max(0, l.incremental))} compras a mais</span>
                          </span>
                        ) : (
                          <span className="type-fine-print text-[var(--ink-muted-48)]">Coletando ({num(f.holdout.control.n)}/30)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <RelEmpty text="Sem fluxos ainda." />
        )}
      </RelSection>

      <RelSection title="Campanhas enviadas">
        {sentCampaigns.length ? (
          <div className="overflow-x-auto">
            <table className="rel-table type-caption">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Envio</th>
                  <th>Envios</th>
                  <th>Abertura</th>
                  <th>Cliques</th>
                  <th>Vendas</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {sentCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <ChannelIcon channel={c.channel} />
                        <Link href={`/relacionamento/campanhas/${c.id}`} className="text-[var(--primary)]">
                          {c.name}
                        </Link>
                      </span>
                    </td>
                    <td className="tabular-nums">{dateBR(c.sentAt)}</td>
                    <td className="tabular-nums">{num(c.stats!.sent)}</td>
                    <td className="tabular-nums">{pct(c.stats!.opened, c.stats!.sent)}</td>
                    <td className="tabular-nums">{pct(c.stats!.clicked, c.stats!.sent)}</td>
                    <td className="tabular-nums">
                      {brl(c.stats!.cents)}
                      <span className="type-micro-legal block text-[var(--ink-muted-48)]">{num(c.stats!.converted)} pedidos</span>
                    </td>
                    <td className="tabular-nums">{brlMicros(c.stats!.costMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RelEmpty text="Nenhuma campanha enviada no período." />
        )}
      </RelSection>

      <div className="rel-grid-2">
        <RelSection title="Assuntos campeões" info="Assuntos com 20 envios ou mais, ordenados por abertura.">
          {data.subjects.length ? (
            <ul className="rel-list">
              {data.subjects.map((s) => (
                <li key={s.subject} className="rel-list-row">
                  <span className="min-w-0 flex-1 truncate type-caption text-[var(--ink)]">{s.subject}</span>
                  <span className="shrink-0 type-fine-print tabular-nums text-[var(--ink-muted-48)]">
                    {pct(s.openRate * 100, 100)} · {pct(s.clickRate * 100, 100)} clique
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <RelEmpty text="Aparece com 20+ envios por assunto." />
          )}
        </RelSection>
        <RelSection title="Links mais clicados">
          {data.links.length ? (
            <ul className="rel-list">
              {data.links.map((l) => (
                <li key={l.link} className="rel-list-row">
                  <span className="min-w-0 flex-1 truncate type-caption text-[var(--ink-muted-80)]">{l.link.replace(/^https?:\/\//, "")}</span>
                  <span className="shrink-0 type-fine-print tabular-nums text-[var(--ink-muted-48)]">{num(l.clicks)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <RelEmpty text="Nenhum clique no período." />
          )}
        </RelSection>
      </div>
    </>
  );
}
