"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { OptionChip } from "@/components/ui";
import { api, brl, brlMicros, dateBR, daysUntil, num, pct, timeAgo } from "@/components/relacionamento/format";

type Kpi = { sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number; failed: number; costMicros: number };
type Overview = {
  days: number;
  email: Kpi;
  whatsapp: Kpi;
  attributed: { orders: number; cents: number };
  influenced: { orders: number; cents: number };
  storeRevenue: { orders: number; cents: number };
  daily: Array<{ day: string; channel: string; sent: number; opened: number; clicked: number; converted: number; cents: number }>;
  ranking: Array<{ flowId: string; name: string; status: string | null; sent: number; opened: number; clicked: number; converted: number; cents: number }>;
  subjects: Array<{ subject: string; sent: number; openRate: number; clickRate: number }>;
  links: Array<{ link: string; clicks: number }>;
  health: {
    resend: { connected: boolean; domain?: string | null; domainStatus?: string | null; webhook?: boolean; lastWebhookAt?: string | null; warmupDailyCap?: number | null };
    whatsapp: { connected: boolean; quality?: string | null; messagingLimit?: string | null; marketingMessagesStatus?: string | null };
    jobs: Array<{ job: string; lastAt: string | null; ok: boolean | null; stale: boolean; recentFailures: number }>;
  };
  upcoming: Array<{ key: string; label: string; date: string; leadDays: number; hint: string | null; campaign: { id: string; status: string } | null }>;
  birthdays: { withDate: number; total: number; thisMonth: number };
  lifecycles: Array<{ lifecycle: string; label: string; count: number }>;
};

const JOB_LABEL: Record<string, string> = {
  "flows.steps": "Envio dos fluxos (5 min)",
  "flows.hourly": "Sincronização (1 h)",
  "flows.profiles": "Perfis e recompra (diário)",
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rel-kpi">
      <span className="type-fine-print text-[var(--ink-muted-48)]">{label}</span>
      <span className="type-tagline tabular-nums text-[var(--ink)]">{value}</span>
      {hint ? <span className="type-micro-legal text-[var(--ink-muted-48)]">{hint}</span> : null}
    </div>
  );
}

export function OverviewTab({ workspaceId, onGo }: { workspaceId: string; onGo: (tab: "fluxos" | "campanhas" | "envios" | "tema") => void }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["rel-overview", workspaceId, days],
    queryFn: () => api<Overview>(`/api/atrako/relacionamento/overview?workspaceId=${workspaceId}&days=${days}`),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const e = data.email;
  const w = data.whatsapp;
  const byDay = new Map<string, { sent: number; converted: number }>();
  for (const d of data.daily) {
    const cur = byDay.get(d.day) ?? { sent: 0, converted: 0 };
    cur.sent += d.sent;
    cur.converted += d.converted;
    byDay.set(d.day, cur);
  }
  const series = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...series.map(([, v]) => v.sent));
  const h = data.health;
  const setupPending = !h.resend.connected || h.resend.domainStatus !== "verified" || !h.whatsapp.connected;
  const share = data.storeRevenue.cents ? data.attributed.cents / data.storeRevenue.cents : 0;

  return (
    <div className="flex flex-col gap-4">
      {setupPending ? (
        <section className="rel-card space-y-2">
          <h2 className="type-body-strong text-[var(--ink)]">Para os fluxos rodarem</h2>
          <ul className="space-y-1">
            <li className="type-caption text-[var(--ink-muted-80)]">
              {h.resend.connected ? "✓" : "○"} Conectar o Resend (e-mail da loja) em{" "}
              <Link href="/config/conexoes" className="text-[var(--primary)]">Config → Conexões</Link>
            </li>
            <li className="type-caption text-[var(--ink-muted-80)]">
              {h.resend.domainStatus === "verified" ? "✓" : "○"} Verificar o domínio de envio (DNS)
            </li>
            <li className="type-caption text-[var(--ink-muted-80)]">
              {h.whatsapp.connected ? "✓" : "○"} Conectar o WhatsApp oficial (opcional, para os passos de WhatsApp)
            </li>
            <li className="type-caption text-[var(--ink-muted-80)]">
              ○ Revisar o{" "}
              <button type="button" className="text-[var(--primary)]" onClick={() => onGo("tema")}>tema do e-mail</button> e ativar os{" "}
              <button type="button" className="text-[var(--primary)]" onClick={() => onGo("fluxos")}>fluxos</button>
            </li>
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <OptionChip key={d} selected={days === d} onClick={() => setDays(d)}>
            {d} dias
          </OptionChip>
        ))}
      </div>

      <div className="rel-kpi-grid">
        <Kpi label="Receita atribuída" value={brl(data.attributed.cents)} hint={`${num(data.attributed.orders)} pedidos · clique ou cupom`} />
        <Kpi label="Receita influenciada" value={brl(data.influenced.cents)} hint={`${num(data.influenced.orders)} pedidos · recebeu e comprou`} />
        <Kpi
          label="Peso na receita da loja"
          value={data.storeRevenue.cents ? `${(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
          hint={`Loja: ${brl(data.storeRevenue.cents)} no período`}
        />
        <Kpi label="Custo WhatsApp" value={brlMicros(w.costMicros)} hint={`${num(w.sent)} mensagens`} />
        <Kpi label="E-mails enviados" value={num(e.sent)} hint={`Entrega ${pct(e.delivered, e.sent)}`} />
        <Kpi label="Abertura" value={pct(e.opened, e.delivered || e.sent)} hint="Apple Mail infla aberturas — veja cliques" />
        <Kpi label="Cliques" value={pct(e.clicked, e.delivered || e.sent)} hint={`${num(e.clicked)} e-mails clicados`} />
        <Kpi label="WhatsApp lidos" value={pct(w.opened, w.delivered || w.sent)} hint={`${num(w.clicked)} cliques no botão`} />
      </div>

      <section className="rel-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="type-body-strong text-[var(--ink)]">Envios por dia</h2>
          <span className="type-fine-print text-[var(--ink-muted-48)]">barra escura = dias com compra</span>
        </div>
        {series.length ? (
          <div className="rel-bars" role="img" aria-label="Envios por dia">
            {series.map(([day, v]) => (
              <div
                key={day}
                className="rel-bar"
                data-tone={v.converted ? undefined : "muted"}
                style={{ height: `${Math.max(3, (v.sent / max) * 100)}%` }}
                title={`${new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR")}: ${v.sent} enviados, ${v.converted} compras`}
              />
            ))}
          </div>
        ) : (
          <p className="type-caption text-[var(--ink-muted-48)]">Nenhum envio no período.</p>
        )}
      </section>

      <div className="rel-grid-2">
        <section className="rel-card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="type-body-strong text-[var(--ink)]">Fluxos que mais vendem</h2>
            <button type="button" className="type-fine-print text-[var(--primary)]" onClick={() => onGo("fluxos")}>
              Ver fluxos
            </button>
          </div>
          {data.ranking.length ? (
            <table className="rel-table type-caption">
              <thead>
                <tr>
                  <th>Fluxo</th>
                  <th>Envios</th>
                  <th>Cliques</th>
                  <th>Vendas</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.slice(0, 8).map((r) => (
                  <tr key={r.flowId}>
                    <td>{r.name}</td>
                    <td className="tabular-nums">{num(r.sent)}</td>
                    <td className="tabular-nums">{pct(r.clicked, r.sent)}</td>
                    <td className="tabular-nums">{brl(r.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="type-caption text-[var(--ink-muted-48)]">Sem envios de fluxo no período.</p>
          )}
        </section>

        <section className="rel-card space-y-2">
          <h2 className="type-body-strong text-[var(--ink)]">Saúde do envio</h2>
          <ul className="space-y-2">
            <li className="flex items-center justify-between gap-2">
              <span className="type-caption text-[var(--ink)]">E-mail {h.resend.domain ? `(${h.resend.domain})` : ""}</span>
              <span className="rel-badge type-micro-legal" data-tone={h.resend.connected && h.resend.domainStatus === "verified" ? "ok" : "bad"}>
                {!h.resend.connected ? "Não conectado" : h.resend.domainStatus === "verified" ? "Domínio verificado" : `Domínio ${h.resend.domainStatus ?? "pendente"}`}
              </span>
            </li>
            {h.resend.connected ? (
              <li className="flex items-center justify-between gap-2">
                <span className="type-caption text-[var(--ink)]">Eventos (webhook)</span>
                <span className="rel-badge type-micro-legal" data-tone={h.resend.webhook ? "ok" : "bad"}>
                  {h.resend.webhook ? (h.resend.lastWebhookAt ? `último ${timeAgo(h.resend.lastWebhookAt)}` : "configurado") : "não configurado"}
                </span>
              </li>
            ) : null}
            {h.resend.warmupDailyCap ? (
              <li className="type-fine-print text-[var(--ink-muted-48)]">
                Aquecimento do domínio: até {num(h.resend.warmupDailyCap)} e-mails de campanha por dia.
              </li>
            ) : null}
            <li className="flex items-center justify-between gap-2">
              <span className="type-caption text-[var(--ink)]">Bounce / spam ({data.days} dias)</span>
              <span className="rel-badge type-micro-legal" data-tone={e.sent && (e.bounced / e.sent > 0.04 || e.complained / e.sent > 0.001) ? "bad" : "ok"}>
                {pct(e.bounced, e.sent)} / {pct(e.complained, e.sent)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="type-caption text-[var(--ink)]">WhatsApp</span>
              <span className="rel-badge type-micro-legal" data-tone={!h.whatsapp.connected ? undefined : h.whatsapp.quality === "RED" ? "bad" : h.whatsapp.quality === "YELLOW" ? "warn" : "ok"}>
                {!h.whatsapp.connected
                  ? "Não conectado"
                  : `Qualidade ${h.whatsapp.quality ?? "—"} · limite ${h.whatsapp.messagingLimit ?? "—"}`}
              </span>
            </li>
            {h.jobs.map((j) => (
              <li key={j.job} className="flex items-center justify-between gap-2">
                <span className="type-caption text-[var(--ink)]">{JOB_LABEL[j.job] ?? j.job}</span>
                <span className="rel-badge type-micro-legal" data-tone={j.stale || j.ok === false ? "bad" : "ok"}>
                  {j.lastAt ? (j.stale ? `parado desde ${timeAgo(j.lastAt)}` : `ok ${timeAgo(j.lastAt)}`) : "nunca rodou"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rel-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="type-body-strong text-[var(--ink)]">Próximas datas</h2>
          <button type="button" className="type-fine-print text-[var(--primary)]" onClick={() => onGo("campanhas")}>
            Calendário de campanhas
          </button>
        </div>
        <div className="rel-strip">
          {data.upcoming.map((d) => {
            const left = daysUntil(d.date);
            return (
              <Link
                key={d.key}
                href={d.campaign ? `/relacionamento/campanhas/${d.campaign.id}` : "/relacionamento?tab=campanhas"}
                className="rel-date-chip"
                data-soon={left <= d.leadDays}
              >
                <span className="type-caption-strong text-[var(--ink)]">{d.label}</span>
                <span className="type-fine-print text-[var(--ink-muted-48)]">
                  {dateBR(d.date)} · {left <= 0 ? "hoje" : `faltam ${left} dias`}
                </span>
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  {d.campaign ? `Campanha: ${d.campaign.status.toLowerCase()}` : left <= d.leadDays ? "Sem campanha ainda" : `Campanha criada ${d.leadDays} dias antes`}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="rel-grid-2">
        <section className="rel-card space-y-2">
          <h2 className="type-body-strong text-[var(--ink)]">Assuntos com mais abertura</h2>
          {data.subjects.length ? (
            <ul className="space-y-1.5">
              {data.subjects.map((s) => (
                <li key={s.subject} className="flex items-baseline justify-between gap-3">
                  <span className="type-caption min-w-0 truncate text-[var(--ink)]">{s.subject}</span>
                  <span className="type-fine-print shrink-0 tabular-nums text-[var(--ink-muted-48)]">
                    {pct(s.openRate * 100, 100)} abertura · {pct(s.clickRate * 100, 100)} clique
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-caption text-[var(--ink-muted-48)]">Aparece com 20+ envios por assunto.</p>
          )}
          {data.links.length ? (
            <>
              <h3 className="type-caption-strong pt-2 text-[var(--ink)]">Links mais clicados</h3>
              <ul className="space-y-1">
                {data.links.map((l) => (
                  <li key={l.link} className="flex items-baseline justify-between gap-3">
                    <span className="type-fine-print min-w-0 truncate text-[var(--ink-muted-80)]">{l.link}</span>
                    <span className="type-fine-print shrink-0 tabular-nums text-[var(--ink-muted-48)]">{num(l.clicks)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="rel-card space-y-2">
          <h2 className="type-body-strong text-[var(--ink)]">Base por etapa</h2>
          {data.lifecycles.length ? (
            <ul className="space-y-1.5">
              {data.lifecycles
                .sort((a, b) => b.count - a.count)
                .map((l) => (
                  <li key={l.lifecycle} className="flex items-baseline justify-between gap-3">
                    <span className="type-caption text-[var(--ink)]">{l.label}</span>
                    <span className="type-caption tabular-nums text-[var(--ink-muted-80)]">{num(l.count)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="type-caption text-[var(--ink-muted-48)]">Perfis são calculados à noite a partir dos pedidos.</p>
          )}
          <p className="type-fine-print pt-2 text-[var(--ink-muted-48)]">
            Aniversários conhecidos: {num(data.birthdays.withDate)} de {num(data.birthdays.total)} contatos ({pct(data.birthdays.withDate, data.birthdays.total)})
            {data.birthdays.thisMonth ? ` · ${num(data.birthdays.thisMonth)} fazem aniversário este mês` : ""}. Colete no formulário (campo Aniversário) ou importe em Públicos.
          </p>
        </section>
      </div>

      <button type="button" className="self-start type-fine-print text-[var(--primary)]" onClick={() => onGo("envios")}>
        Ver todos os envios
      </button>
    </div>
  );
}
