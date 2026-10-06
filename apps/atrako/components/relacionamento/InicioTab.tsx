"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { brl, dateBR, daysUntil, num, pct, timeAgo } from "@/components/relacionamento/format";
import { relHref, type RelNav, type RelTab } from "@/components/relacionamento/nav";
import { CAMPAIGN_STATUS, WA_QUALITY, deliverabilityBad, rate, useOverview, type Overview } from "@/components/relacionamento/overview";
import type { RelPeriod } from "@/components/relacionamento/period";
import { RelKpi, RelLoading, RelSection, RelStatusRow, ToneIcon, type Tone } from "@/components/relacionamento/ui";
import { statusTone } from "@/components/relacionamento/CampaignsTab";

const JOB_LABEL: Record<string, string> = {
  "flows.steps": "Envio dos fluxos",
  "flows.hourly": "Sincronização",
  "flows.profiles": "Perfis e recompra",
};

export function InicioTab({ workspaceId, period, onGo }: { workspaceId: string; period: RelPeriod; onGo: RelNav }) {
  const { data, isLoading } = useOverview(workspaceId, period);
  if (isLoading || !data) return <RelLoading />;

  const e = data.email;
  const p = data.previous;
  const share = rate(data.attributed.cents, data.storeRevenue.cents);
  const prevShare = rate(p.attributedCents, p.storeCents);
  const clickRate = rate(e.clicked, e.delivered || e.sent);
  const prevClickRate = rate(p.emailClicked, p.emailDelivered || p.emailSent);

  return (
    <div className="flex flex-col gap-4">
      <ChannelsCard data={data} />
      <AttentionCard items={data.attention} onGo={onGo} />

      <div className="rel-kpi-grid">
        <RelKpi
          label="Receita atribuída"
          value={brl(data.attributed.cents)}
          detail={`${num(data.attributed.orders)} pedidos`}
          delta={{ current: data.attributed.cents, previous: p.attributedCents }}
          info="Compras feitas depois de clicar numa mensagem ou usando o cupom dela."
        />
        <RelKpi
          label="Peso na receita"
          value={data.storeRevenue.cents ? pct(share * 100, 100) : "—"}
          detail={`de ${brl(data.storeRevenue.cents)}`}
          delta={{ current: share, previous: prevShare }}
          info="Quanto da receita da loja no período veio das mensagens."
        />
        <RelKpi
          label="E-mails enviados"
          value={num(e.sent)}
          detail={e.sent ? `${pct(e.delivered, e.sent)} entregues` : undefined}
          delta={{ current: e.sent, previous: p.emailSent }}
        />
        <RelKpi
          label="Cliques"
          value={pct(e.clicked, e.delivered || e.sent)}
          detail={e.clicked ? `${num(e.clicked)} e-mails` : undefined}
          delta={{ current: clickRate, previous: prevClickRate }}
          info="Clique é o sinal mais confiável — o Apple Mail infla as aberturas."
        />
      </div>

      <DailyChart data={data} />
      <UpcomingDates data={data} onGo={onGo} />
    </div>
  );
}

function ChannelsCard({ data }: { data: Overview }) {
  const h = data.health;
  const e = data.email;
  const emailTone: Tone = !h.resend.connected ? "bad" : h.resend.domainStatus === "verified" ? "ok" : "warn";
  const deliveryTone: Tone = !e.sent ? undefined : deliverabilityBad(e) ? "bad" : "ok";
  const waTone: Tone = !h.whatsapp.connected
    ? undefined
    : h.whatsapp.quality === "RED"
      ? "bad"
      : h.whatsapp.quality === "YELLOW"
        ? "warn"
        : "ok";
  const jobsDown = h.jobs.filter((j) => j.stale || j.ok === false);
  const jobsTone: Tone = jobsDown.length ? "bad" : "ok";
  const alert = [emailTone, deliveryTone, waTone, jobsTone].some((t) => t === "bad" || t === "warn");
  const [open, setOpen] = useState(alert);

  return (
    <RelSection
      title="Canais"
      action={
        <>
          <Link href="/config/conexoes" className="type-fine-print text-[var(--primary)]">
            Conexões
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 type-fine-print text-[var(--ink-muted-48)] active:scale-95"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Detalhes
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
          </button>
        </>
      }
    >
      <div className="rel-status-line">
        <RelStatusRow
          tone={emailTone}
          label="E-mail"
          value={!h.resend.connected ? "Não conectado" : h.resend.domainStatus === "verified" ? h.resend.domain ?? "Domínio verificado" : "Domínio pendente"}
        />
        <RelStatusRow
          tone={deliveryTone}
          label="Entrega"
          value={e.sent ? `${pct(e.bounced, e.sent)} bounce · ${pct(e.complained, e.sent)} spam` : "Sem envios no período"}
        />
        <RelStatusRow
          tone={waTone}
          label="WhatsApp"
          value={
            !h.whatsapp.connected
              ? "Opcional · não conectado"
              : `Qualidade ${WA_QUALITY[h.whatsapp.quality ?? "UNKNOWN"] ?? h.whatsapp.quality} · ${h.whatsapp.messagingLimit ?? "—"}`
          }
        />
        <RelStatusRow tone={jobsTone} label="Rotinas" value={jobsDown.length ? `${jobsDown.length} parada${jobsDown.length > 1 ? "s" : ""}` : "Em dia"} />
      </div>

      {open ? (
        <div className="rel-inset mt-3 rel-list">
          {h.resend.connected ? (
            <DetailRow
              tone={h.resend.webhook ? "ok" : "bad"}
              label="Eventos do e-mail"
              value={h.resend.webhook ? (h.resend.lastWebhookAt ? `último ${timeAgo(h.resend.lastWebhookAt)}` : "configurado") : "webhook não configurado"}
            />
          ) : null}
          {h.resend.warmupDailyCap ? (
            <DetailRow tone="warn" label="Aquecimento do domínio" value={`até ${num(h.resend.warmupDailyCap)} e-mails de campanha/dia`} />
          ) : null}
          {e.sent ? (
            <DetailRow
              tone={deliveryTone}
              label="Limite saudável"
              value="bounce até 4% · spam até 0,1%"
            />
          ) : null}
          {h.jobs.map((j) => (
            <DetailRow
              key={j.job}
              tone={j.stale || j.ok === false ? "bad" : "ok"}
              label={JOB_LABEL[j.job] ?? j.job}
              value={j.lastAt ? (j.stale ? `parado desde ${timeAgo(j.lastAt)}` : timeAgo(j.lastAt)) : "nunca rodou"}
            />
          ))}
        </div>
      ) : null}
    </RelSection>
  );
}

function DetailRow({ tone, label, value }: { tone: Tone; label: string; value: string }) {
  return (
    <div className="rel-list-row">
      <ToneIcon tone={tone} />
      <span className="min-w-0 flex-1 truncate type-caption text-[var(--ink)]">{label}</span>
      <span className="shrink-0 type-fine-print text-[var(--ink-muted-48)]">{value}</span>
    </div>
  );
}

function AttentionCard({ items, onGo }: { items: Overview["attention"]; onGo: RelNav }) {
  if (!items.length) {
    return (
      <section className="rel-card flex items-center gap-2">
        <ToneIcon tone="ok" />
        <span className="type-caption text-[var(--ink)]">Nada pendente. Tudo rodando.</span>
      </section>
    );
  }
  return (
    <RelSection title="Precisa de você" action={<span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{items.length}</span>}>
      <div className="rel-list">
        {items.map((it) => {
          const content = (
            <>
              <ToneIcon tone={it.tone} />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-caption-strong text-[var(--ink)]">{it.title}</span>
                {it.detail ? <span className="block truncate type-fine-print text-[var(--ink-muted-48)]">{it.detail}</span> : null}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
            </>
          );
          return it.href ? (
            <Link key={it.key} href={it.href} className="rel-list-row">
              {content}
            </Link>
          ) : (
            <button key={it.key} type="button" className="rel-list-row w-full text-left" onClick={() => onGo((it.tab ?? "inicio") as RelTab, it.sub)}>
              {content}
            </button>
          );
        })}
      </div>
    </RelSection>
  );
}

function DailyChart({ data }: { data: Overview }) {
  const byDay = new Map<string, { sent: number; converted: number }>();
  for (const d of data.daily) {
    const cur = byDay.get(d.day) ?? { sent: 0, converted: 0 };
    cur.sent += d.sent;
    cur.converted += d.converted;
    byDay.set(d.day, cur);
  }
  const weekly = data.days > 120;
  const step = (weekly ? 7 : 1) * 86_400_000;
  const buckets: Array<{ key: string; sent: number; converted: number }> = [];
  const start = new Date(data.since).getTime();
  const end = new Date(data.until).getTime();
  for (let t = start; t <= end; t += step) {
    let sent = 0;
    let converted = 0;
    for (let i = 0; i < (weekly ? 7 : 1); i++) {
      const v = byDay.get(new Date(t + i * 86_400_000).toISOString().slice(0, 10));
      if (v) {
        sent += v.sent;
        converted += v.converted;
      }
    }
    buckets.push({ key: new Date(t).toISOString().slice(0, 10), sent, converted });
  }
  const max = Math.max(1, ...buckets.map((b) => b.sent));
  const total = buckets.reduce((s, b) => s + b.sent, 0);

  return (
    <RelSection
      title={weekly ? "Envios por semana" : "Envios por dia"}
      info="Barra azul: houve compra vinda das mensagens. Passe o mouse para ver o dia."
      action={<span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{num(total)} envios</span>}
    >
      {total ? (
        <div className="rel-bars" role="img" aria-label="Envios no período">
          {buckets.map((b) => (
            <div
              key={b.key}
              className="rel-bar"
              data-tone={b.converted ? undefined : "muted"}
              style={{ height: `${b.sent ? Math.max(3, (b.sent / max) * 100) : 1}%` }}
              title={`${new Date(`${b.key}T12:00:00`).toLocaleDateString("pt-BR")}: ${num(b.sent)} envios, ${num(b.converted)} compras`}
            />
          ))}
        </div>
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Nenhum envio no período.</p>
      )}
    </RelSection>
  );
}

function UpcomingDates({ data, onGo }: { data: Overview; onGo: RelNav }) {
  if (!data.upcoming.length) return null;
  return (
    <RelSection
      title="Próximas datas"
      action={
        <button type="button" className="type-fine-print text-[var(--primary)]" onClick={() => onGo("campanhas")}>
          Campanhas
        </button>
      }
    >
      <div className="rel-strip">
        {data.upcoming.map((d) => {
          const left = daysUntil(d.date);
          const soon = !d.campaign && left <= d.leadDays;
          return (
            <Link
              key={d.key}
              href={d.campaign ? `/relacionamento/campanhas/${d.campaign.id}` : relHref("campanhas")}
              className="rel-date-chip"
              data-soon={soon}
            >
              <span className="type-caption-strong text-[var(--ink)]">{d.label}</span>
              <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">
                {dateBR(d.date)} · {left <= 0 ? "hoje" : `${left} dias`}
              </span>
              {d.campaign ? (
                <span className="rel-badge type-micro-legal mt-1 self-start" data-tone={statusTone(d.campaign.status)}>
                  {CAMPAIGN_STATUS[d.campaign.status] ?? d.campaign.status}
                </span>
              ) : soon ? (
                <span className="rel-badge type-micro-legal mt-1 self-start" data-tone="warn">
                  Sem campanha
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </RelSection>
  );
}
