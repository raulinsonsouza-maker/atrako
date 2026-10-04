"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { OptionChip } from "@/components/ui";
import { api, brl, brlMicros, dateBR, num, pct } from "@/components/relacionamento/format";
import type { Flow } from "@/components/relacionamento/FlowsTab";

type CampaignResult = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
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

export function ResultsTab({ workspaceId }: { workspaceId: string }) {
  const [days, setDays] = useState(30);
  const flows = useQuery({
    queryKey: ["rel-flows-results", workspaceId, days],
    queryFn: () => api<{ flows: Flow[] }>(`/api/atrako/relacionamento/flows?workspaceId=${workspaceId}&days=${days}`),
  });
  const campaigns = useQuery({
    queryKey: ["rel-campaigns", workspaceId],
    queryFn: () => api<{ campaigns: CampaignResult[] }>(`/api/atrako/relacionamento/campaigns?workspaceId=${workspaceId}`),
  });

  if (flows.isLoading || !flows.data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const rows = flows.data.flows.map((f) => {
    const sent = f.steps.reduce((s, st) => s + st.stats.sent, 0);
    const clicked = f.steps.reduce((s, st) => s + st.stats.clicked, 0);
    const cost = f.steps.reduce((s, st) => s + st.stats.costMicros, 0);
    return { f, sent, clicked, cost };
  });
  const totals = rows.reduce(
    (a, r) => ({
      attributed: a.attributed + r.f.attributed.cents,
      influenced: a.influenced + r.f.influenced.cents,
      cost: a.cost + r.cost,
    }),
    { attributed: 0, influenced: 0, cost: 0 },
  );
  const sentCampaigns = (campaigns.data?.campaigns ?? []).filter((c) => c.stats && c.stats.sent > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {[30, 90, 365].map((d) => (
          <OptionChip key={d} className="px-3 py-1.5" selected={days === d} onClick={() => setDays(d)}>
            {d === 365 ? "12 meses" : `${d} dias`}
          </OptionChip>
        ))}
      </div>

      <div className="rel-kpi-grid">
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Receita atribuída</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brl(totals.attributed)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Comprou depois de clicar ou usou o cupom do passo</span>
        </div>
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Receita influenciada</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brl(totals.influenced)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Recebeu e comprou dentro da janela, sem clique</span>
        </div>
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Custo WhatsApp</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brlMicros(totals.cost)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            {totals.cost ? `Retorno ${(totals.attributed / 100 / (totals.cost / 1_000_000)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}×` : "E-mail não tem custo por envio"}
          </span>
        </div>
      </div>

      <section className="rel-card space-y-2">
        <h2 className="type-body-strong text-[var(--ink)]">Por fluxo</h2>
        <table className="rel-table type-caption">
          <thead>
            <tr>
              <th>Fluxo</th>
              <th>Entraram</th>
              <th>Envios</th>
              <th>Cliques</th>
              <th>Atribuída</th>
              <th>Influenciada</th>
              <th>Efeito real (controle)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, sent, clicked }) => {
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
                      <span className="type-fine-print text-[var(--ink-muted-48)]">Sem grupo de controle</span>
                    ) : l ? (
                      <span className="type-caption tabular-nums text-[var(--ink)]">
                        {l.pp >= 0 ? "+" : ""}
                        {l.pp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.
                        <span className="type-micro-legal block text-[var(--ink-muted-48)]">
                          {pct(f.holdout.treated.converted, f.holdout.treated.n)} vs {pct(f.holdout.control.converted, f.holdout.control.n)} · ~{num(Math.max(0, l.incremental))} compras a mais
                        </span>
                      </span>
                    ) : (
                      <span className="type-fine-print text-[var(--ink-muted-48)]">
                        Coletando ({num(f.holdout.control.n)} no controle, precisa de 30)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          O grupo de controle (ligue em Fluxos, 5–20%) não recebe mensagens. A diferença de compra entre quem recebeu e quem não recebeu é o efeito real — o resto
          compraria de qualquer jeito.
        </p>
      </section>

      <section className="rel-card space-y-2">
        <h2 className="type-body-strong text-[var(--ink)]">Campanhas enviadas</h2>
        {sentCampaigns.length ? (
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
                    <Link href={`/relacionamento/campanhas/${c.id}`} className="text-[var(--primary)]">
                      {c.name}
                    </Link>
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
        ) : (
          <p className="type-caption text-[var(--ink-muted-48)]">Nenhuma campanha enviada ainda.</p>
        )}
      </section>
    </div>
  );
}
