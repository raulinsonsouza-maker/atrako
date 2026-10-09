"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SegmentedControl } from "@/components/ui";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { bucketYmd, rotuloEixo, rotuloTooltip } from "@/lib/chart-bucket";
import { formatCompactNumber, mobileTickInterval } from "@/lib/chart-mobile";
import { api, brl, brlMicros, dateBR, num, pct } from "@/components/relacionamento/format";
import { rate, useOverview, type Overview } from "@/components/relacionamento/overview";
import { relPeriod, type RelPeriod } from "@/components/relacionamento/period";
import type { Flow } from "@/components/relacionamento/FlowsTab";
import { DeliveryList } from "@/components/relacionamento/DeliveriesTab";
import { BaseCards } from "@/components/relacionamento/ContatosTab";
import { ChannelIcon, RelEmpty, RelKpi, RelLoading, RelSection } from "@/components/relacionamento/ui";

type CampaignResult = {
  id: string;
  name: string;
  status: string;
  sentAt: string | null;
  channel: string;
  stats: { sent: number; opened: number; clicked: number; converted: number; cents: number; costMicros: number } | null;
};

const chartTooltip = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "none",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

/** Diferença de conversão tratado vs controle, em pontos percentuais. */
function lift(f: Flow) {
  const t = f.holdout.treated;
  const c = f.holdout.control;
  if (c.n < 30 || t.n < 30) return null;
  return { pp: (t.rate - c.rate) * 100, incremental: Math.round((t.rate - c.rate) * t.n) };
}

/** Resultados de e-mail e WhatsApp (análise do Relacionamento) dentro da Central de clientes. */
export function RelacionamentoPanel({ clienteId, dataInicio, dataFim, label }: { clienteId: string; dataInicio: string; dataFim: string; label: string }) {
  const period = useMemo(() => relPeriod(dataInicio, dataFim, label), [dataInicio, dataFim, label]);
  const [view, setView] = useState<"resumo" | "envios">("resumo");
  const { setWorkspaceId } = useActiveWorkspace();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Visão do relacionamento"
          value={view}
          onChange={setView}
          options={[
            { value: "resumo", label: "Resumo" },
            { value: "envios", label: "Histórico de envios" },
          ]}
        />
        <Link href="/relacionamento" className="type-caption text-[var(--primary)]" onClick={() => setWorkspaceId(clienteId)}>
          Abrir Relacionamento
        </Link>
      </div>
      {view === "envios" ? <DeliveryList workspaceId={clienteId} period={period} /> : <Resumo workspaceId={clienteId} period={period} />}
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
  if (overview.isError) return <RelEmpty text="Sem acesso aos dados de relacionamento desta conta." />;
  if (!data) return <RelLoading />;

  const e = data.email;
  const w = data.whatsapp;
  const p = data.previous;
  const share = rate(data.attributed.cents, data.storeRevenue.cents);
  const prevShare = rate(p.attributedCents, p.storeCents);
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
    .filter((r) => r.sent || r.f.entered || r.f.attributed.cents)
    .sort((a, b) => b.f.attributed.cents - a.f.attributed.cents || b.clicked - a.clicked);

  return (
    <>
      <div className="rel-kpi-grid">
        <RelKpi
          label="Receita atribuída"
          value={brl(data.attributed.cents)}
          detail={`${num(data.attributed.orders)} pedidos`}
          delta={{ current: data.attributed.cents, previous: p.attributedCents }}
          info="Comprou depois de clicar na mensagem ou usou o cupom dela."
        />
        <RelKpi
          label="Receita influenciada"
          value={brl(data.influenced.cents)}
          detail={`${num(data.influenced.orders)} pedidos`}
          info="Recebeu a mensagem e comprou dentro da janela, sem clicar."
        />
        <RelKpi
          label="Peso na receita"
          value={data.storeRevenue.cents ? pct(share * 100, 100) : "—"}
          detail={`de ${brl(data.storeRevenue.cents)}`}
          delta={{ current: share, previous: prevShare }}
        />
        <RelKpi
          label="Custo WhatsApp"
          value={brlMicros(w.costMicros)}
          detail={roi ? `Retorno ${roi.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}×` : `${num(w.sent)} mensagens`}
          info="E-mail não tem custo por envio. Retorno = receita atribuída ÷ custo do WhatsApp."
        />
        <RelKpi
          label="E-mails enviados"
          value={num(e.sent)}
          detail={e.sent ? `${pct(e.delivered, e.sent)} entregues` : undefined}
          delta={{ current: e.sent, previous: p.emailSent }}
        />
        <RelKpi
          label="Abertura"
          value={pct(e.opened, e.delivered || e.sent)}
          info="O Apple Mail abre e-mails sozinho e infla esta taxa. Use cliques para comparar."
        />
        <RelKpi
          label="Cliques"
          value={pct(e.clicked, e.delivered || e.sent)}
          detail={e.clicked ? `${num(e.clicked)} e-mails` : undefined}
          info="Clique é o sinal mais confiável."
        />
        <RelKpi label="WhatsApp lidos" value={pct(w.opened, w.delivered || w.sent)} detail={w.clicked ? `${num(w.clicked)} cliques` : undefined} />
      </div>

      <DailyChart data={data} />

      <RelSection
        title="Por fluxo"
        info="Efeito real: compara quem recebeu com o grupo de controle (que não recebe nada). Precisa de 30 pessoas em cada lado."
      >
        {!flows.data ? (
          <RelLoading compact />
        ) : flowRows.length ? (
          <div className="overflow-x-auto">
            <table className="rel-table table-sticky-first type-caption">
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
                          <span className="type-caption tabular-nums text-[var(--ink)]">
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
          <RelEmpty text="Nenhum fluxo enviou mensagens no período." />
        )}
      </RelSection>

      <RelSection title="Campanhas enviadas">
        {sentCampaigns.length ? (
          <div className="overflow-x-auto">
            <table className="rel-table table-sticky-first type-caption">
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

      <BaseCards data={data} />

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

function DailyChart({ data }: { data: Overview }) {
  const isMobile = useIsMobile();
  const rows = useMemo(() => {
    const byDay = new Map<string, { sent: number; converted: number; cents: number }>();
    for (const d of data.daily) {
      const cur = byDay.get(d.day) ?? { sent: 0, converted: 0, cents: 0 };
      cur.sent += d.sent;
      cur.converted += d.converted;
      cur.cents += d.cents;
      byDay.set(d.day, cur);
    }
    const agrupamento = data.days > 180 ? "mes" : data.days > 120 ? "semana" : "dia";
    const step = (agrupamento === "semana" ? 7 : 1) * 86_400_000;
    const buckets = new Map<string, { envios: number; receita: number; compras: number }>();
    const end = new Date(data.until).getTime();
    for (let t = new Date(data.since).getTime(); t <= end; t += step) {
      let sent = 0;
      let converted = 0;
      let cents = 0;
      const span = agrupamento === "semana" ? 7 : 1;
      for (let i = 0; i < span; i++) {
        const v = byDay.get(new Date(t + i * 86_400_000).toISOString().slice(0, 10));
        if (v) {
          sent += v.sent;
          converted += v.converted;
          cents += v.cents;
        }
      }
      const day = new Date(t).toISOString().slice(0, 10);
      const key = bucketYmd(day, agrupamento);
      const row = buckets.get(key) ?? { envios: 0, receita: 0, compras: 0 };
      row.envios += sent;
      row.receita += cents / 100;
      row.compras += converted;
      buckets.set(key, row);
    }
    const years = new Set([...buckets.keys()].map((key) => key.slice(0, 4)));
    const multiYear = years.size > 1;
    return [...buckets.entries()].map(([key, row]) => ({
      periodo: rotuloEixo(key, agrupamento, multiYear),
      rotulo: rotuloTooltip(key, agrupamento),
      ...row,
    }));
  }, [data]);

  const total = rows.reduce((s, r) => s + r.envios, 0);
  const tickEvery = isMobile ? mobileTickInterval(rows.length) : rows.length > 16 ? Math.ceil(rows.length / 16) - 1 : 0;

  return (
    <RelSection
      title={data.days > 180 ? "Envios e receita por mês" : data.days > 120 ? "Envios e receita por semana" : "Envios e receita por dia"}
      info="Barras: mensagens enviadas. Linha: receita atribuída às mensagens."
      action={<span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{num(total)} envios</span>}
    >
      {total ? (
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows}>
              <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
              <XAxis dataKey="periodo" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={tickEvery} />
              <YAxis
                yAxisId="envios"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 36 : 48}
                tickFormatter={(v: number) => formatCompactNumber(v)}
              />
              <YAxis yAxisId="receita" orientation="right" hide />
              <Tooltip
                cursor={{ fill: "var(--divider-soft)" }}
                labelFormatter={(_label: string, payload: ReadonlyArray<{ payload?: { rotulo?: string } }>) =>
                  payload[0]?.payload?.rotulo ?? _label
                }
                formatter={(value: number, name: string, item: { payload?: { compras?: number } }) =>
                  name === "Receita" ? [`${brl(Math.round(Number(value) * 100))} · ${item.payload?.compras ?? 0} compras`, name] : [num(Number(value)), name]
                }
                {...chartTooltip}
              />
              <Bar yAxisId="envios" dataKey="envios" name="Envios" fill="var(--primary)" fillOpacity={0.18} radius={[4, 4, 0, 0]} />
              <Line yAxisId="receita" type="monotone" dataKey="receita" name="Receita" stroke="var(--primary)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Nenhum envio no período.</p>
      )}
    </RelSection>
  );
}
