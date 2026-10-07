"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui";
import { api, brl, dateBR, daysUntil, num } from "@/components/relacionamento/format";
import { relResultsHref, type RelNav, type RelTab } from "@/components/relacionamento/nav";
import { CAMPAIGN_STATUS, useOverview, type Overview } from "@/components/relacionamento/overview";
import { lastDaysPeriod } from "@/components/relacionamento/period";
import { RelLoading, RelSection, ToneIcon } from "@/components/relacionamento/ui";
import { statusTone } from "@/components/relacionamento/campaignStage";

type SetupStep = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  optional?: boolean;
  action: { label: string; href?: string; tab?: RelTab; sub?: string };
};

/** Pendências que o passo a passo já cobre (não repetir em "Precisa de você"). */
const SETUP_ATTENTION = new Set(["email-off", "theme", "flows-none", "flows-inactive"]);

export function InicioTab({ workspaceId, onGo }: { workspaceId: string; onGo: RelNav }) {
  const [period] = useState(() => lastDaysPeriod(30));
  const { data, isLoading } = useOverview(workspaceId, period);
  if (isLoading || !data) return <RelLoading />;

  const s = data.setup;
  const steps: SetupStep[] = [
    {
      key: "email",
      title: "Conectar o e-mail",
      detail: "É por ele que saem os fluxos e as campanhas.",
      done: s.emailConnected,
      action: { label: "Conectar", href: "/config/conexoes" },
    },
    {
      key: "theme",
      title: "Publicar o visual do e-mail",
      detail: "Logo, cores e assinatura da loja em todas as mensagens.",
      done: s.themePublished,
      action: { label: "Abrir visual", tab: "ajustes", sub: "email" },
    },
    {
      key: "flows",
      title: "Ativar os fluxos automáticos",
      detail: "Carrinho abandonado, pós-compra, recompra e aniversário.",
      done: s.flowsActive,
      action: { label: "Ver fluxos", tab: "fluxos" },
    },
    {
      key: "dates",
      title: "Escolher as datas do ano",
      detail: "Black Friday, Dia das Mães… a campanha nasce sozinha.",
      done: s.datesEnabled,
      action: { label: "Escolher datas", tab: "ajustes", sub: "datas" },
    },
    {
      key: "whatsapp",
      title: "Conectar o WhatsApp",
      detail: "Opcional. Mensagens com taxa de leitura bem maior.",
      done: s.whatsappConnected,
      optional: true,
      action: { label: "Conectar", href: "/config/conexoes" },
    },
  ];
  const required = steps.filter((x) => !x.optional);
  const setupDone = required.every((x) => x.done);
  const attention = setupDone ? data.attention : data.attention.filter((a) => !SETUP_ATTENTION.has(a.key));

  return (
    <div className="flex flex-col gap-4">
      {setupDone ? null : <SetupCard steps={steps} onGo={onGo} />}
      {s.emailConnected ? <ResultTile data={data} workspaceId={workspaceId} /> : null}
      <AttentionCard items={attention} onGo={onGo} />
      <UpcomingDates data={data} workspaceId={workspaceId} />
    </div>
  );
}

function SetupCard({ steps, onGo }: { steps: SetupStep[]; onGo: RelNav }) {
  const required = steps.filter((x) => !x.optional);
  const done = required.filter((x) => x.done).length;
  const nextKey = steps.find((x) => !x.done && !x.optional)?.key;
  return (
    <RelSection
      title="Primeiros passos"
      action={
        <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">
          {done} de {required.length}
        </span>
      }
    >
      <div className="rel-meter mb-2">
        <span style={{ width: `${(done / required.length) * 100}%` }} />
      </div>
      <div>
        {steps.map((step, i) => {
          const next = step.key === nextKey;
          const variant = next ? "primary" : "outline";
          return (
            <div key={step.key} className="rel-setup-step">
              <span className="rel-setup-num" data-done={step.done} data-next={next}>
                {step.done ? <Check className="h-4 w-4" strokeWidth={2} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block type-caption-strong text-[var(--ink)]">{step.title}</span>
                <span className="block type-fine-print text-[var(--ink-muted-48)]">{step.detail}</span>
              </span>
              {step.done ? (
                <span className="type-fine-print text-[var(--success)]">Feito</span>
              ) : step.action.href ? (
                <Link href={step.action.href} className={buttonClass({ variant, size: "toolbar" })}>
                  {step.action.label}
                </Link>
              ) : (
                <Button variant={variant} size="toolbar" onClick={() => onGo(step.action.tab!, step.action.sub)}>
                  {step.action.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </RelSection>
  );
}

function ResultTile({ data, workspaceId }: { data: Overview; workspaceId: string }) {
  const cents = data.attributed.cents + data.influenced.cents;
  const orders = data.attributed.orders + data.influenced.orders;
  return (
    <section className="rel-result-tile">
      <div className="min-w-0">
        <p className="type-fine-print opacity-70">Últimos 30 dias</p>
        <p className="type-tagline tabular-nums">
          {cents ? `${brl(cents)} vieram das mensagens` : "Ainda sem vendas vindas das mensagens"}
        </p>
        {cents ? (
          <p className="type-fine-print opacity-70">
            {num(orders)} pedidos · {num(data.email.sent + data.whatsapp.sent)} mensagens enviadas
          </p>
        ) : null}
      </div>
      <Link href={relResultsHref(workspaceId)} className="inline-flex items-center gap-0.5 type-caption-strong">
        Ver resultados
        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </section>
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

function UpcomingDates({ data, workspaceId }: { data: Overview; workspaceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ id: string }>("/api/atrako/relacionamento/campaigns", { body: { workspaceId, ...body } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["rel-campaigns", workspaceId] });
      router.push(`/relacionamento/campanhas/${r.id}`);
    },
  });
  if (!data.upcoming.length) return null;
  return (
    <RelSection title="Próximas datas" info="Toque numa data para abrir a campanha ou começar uma nova.">
      <div className="rel-strip">
        {data.upcoming.map((d) => {
          const left = daysUntil(d.date);
          const soon = !d.campaign && left <= d.leadDays;
          return (
            <button
              key={d.key}
              type="button"
              className="rel-date-chip active:scale-95"
              data-soon={soon}
              disabled={create.isPending}
              onClick={() =>
                d.campaign
                  ? router.push(`/relacionamento/campanhas/${d.campaign.id}`)
                  : create.mutate({ name: d.label, eventDate: d.date, calendarKey: d.key, channel: "EMAIL" })
              }
            >
              <span className="type-caption-strong text-[var(--ink)]">{d.label}</span>
              <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">
                {dateBR(d.date)} · {left <= 0 ? "hoje" : `${left} dias`}
              </span>
              {d.campaign ? (
                <span className="rel-badge type-micro-legal mt-1 self-start" data-tone={statusTone(d.campaign.status)}>
                  {CAMPAIGN_STATUS[d.campaign.status] ?? d.campaign.status}
                </span>
              ) : (
                <span className="mt-1 inline-flex items-center gap-1 type-micro-legal text-[var(--primary)]">
                  {create.isPending && create.variables?.calendarKey === d.key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Criar campanha
                </span>
              )}
            </button>
          );
        })}
      </div>
    </RelSection>
  );
}
