"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  ListChecks,
  Loader2,
  MessageCircle,
  Sprout,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { Button, SectionCard, Switch, TextLink } from "@/components/ui";
import { ChatPhone, type ChatItem } from "@/components/symbius/phone/ChatPhone";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { useLpHost } from "@/components/layout/LpHostContext";
import {
  JOURNEY_STAGES,
  NO_REPLY_STEPS,
  NURTURE_STAGE,
  journeyConversation,
  leadBrief,
  nurtureConversation,
  type JourneyChatItem,
  type JourneyStage,
  type JourneyStageKey,
} from "@/lib/qualification/journey";
import { FIELD_DEFS, type QualifyAnswers, type QualifyFieldKey } from "@/lib/qualification/fields";

type Jornada = {
  brand: string;
  qualification: { enabled: boolean; askKeys: QualifyFieldKey[]; lpKeys: QualifyFieldKey[] };
  channels: {
    whatsapp: { connected: boolean; phone: string | null };
    email: { connected: boolean; from: string | null };
  };
  templates: Record<string, string | null>;
  stages: Record<JourneyStageKey, number>;
  priorities: { A: number; B: number; C: number };
  stalled: number;
};

type Tone = "ok" | "warn" | "bad" | "off";

const STAGE_ICON: Record<JourneyStageKey, LucideIcon> = {
  entrada: FileText,
  abertura: MessageCircle,
  perguntas: ListChecks,
  horario: CalendarClock,
  equipe: UserRoundCheck,
  nutricao: Sprout,
};

const TEMPLATE_STATUS: Record<string, { label: string; tone: Tone }> = {
  APPROVED: { label: "Aprovado", tone: "ok" },
  PENDING: { label: "Em análise", tone: "warn" },
  IN_APPEAL: { label: "Em análise", tone: "warn" },
  REJECTED: { label: "Reprovado", tone: "bad" },
  PAUSED: { label: "Pausado", tone: "bad" },
  DISABLED: { label: "Desativado", tone: "bad" },
};

const crmLabel = (key: QualifyFieldKey) => FIELD_DEFS.find((d) => d.key === key)?.crmLabel ?? key;

const answer = (label: string) => ({ value: label, label, code: label, source: "whatsapp" as const, at: "" });
const EXAMPLE_ANSWERS: QualifyAnswers = {
  city: answer("Curitiba"),
  state: answer("PR"),
  niche: answer("Advocacia"),
  business_objective: answer("Operar a unidade"),
  start_timeline: answer("Em até 30 dias"),
  investment_status: answer("Tenho o valor"),
  main_question: answer("Condições da franquia"),
  best_contact_time: answer("Manhã"),
};

function Dot({ tone }: { tone: Tone }) {
  return <span className="journey-dot" data-tone={tone === "off" ? undefined : tone} aria-hidden />;
}

function StatusItem({ label, tone, value, children }: { label: string; tone: Tone; value: string; children?: React.ReactNode }) {
  return (
    <div className="journey-status-item">
      <span className="type-fine-print text-[var(--ink-muted-48)]">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <Dot tone={tone} />
        <span className="type-body-strong truncate text-[var(--ink)]">{value}</span>
      </span>
      {children ? <div className="flex min-h-5 flex-wrap items-center gap-2 type-fine-print text-[var(--ink-muted-80)]">{children}</div> : null}
    </div>
  );
}

function toChatItems(items: JourneyChatItem[], active: JourneyStageKey | null): ChatItem[] {
  return items.map((it): ChatItem => {
    if (it.kind === "system") return { kind: "system", id: it.id, text: it.text, tone: "event" };
    if (it.kind === "sent") return { kind: "sent", id: it.id, text: it.text };
    return {
      kind: "received",
      id: it.id,
      text: it.text,
      buttons: [
        ...it.buttons.map((text) => ({ text, kind: "reply" as const })),
        ...(it.list ? [{ text: it.list, kind: "other" as const }] : []),
      ],
      footer: it.template ? "Modelo aprovado pela Meta" : undefined,
      highlight: active === it.stage,
      dim: Boolean(active) && active !== it.stage,
    };
  });
}

function StageRow({
  stage,
  count,
  active,
  onSelect,
  dashed,
  children,
}: {
  stage: JourneyStage;
  count: number | null;
  active: boolean;
  onSelect: () => void;
  dashed?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = STAGE_ICON[stage.key];
  const channel = stage.channel === "whatsapp" ? "WHATSAPP" : stage.channel === "email" ? "EMAIL" : undefined;
  return (
    <button
      type="button"
      className="rel-tl-item cursor-pointer"
      data-active={active}
      data-reserve={dashed || undefined}
      onClick={onSelect}
    >
      <span className="flex justify-center">
        <span className="rel-mini-dot" data-channel={channel}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="type-caption-strong text-[var(--ink)]">{stage.title}</span>
          <span className="type-fine-print text-[var(--ink-muted-48)]">{stage.when}</span>
        </span>
        {children ? <span className="mt-1.5 flex flex-wrap gap-1.5">{children}</span> : null}
      </span>
      {count == null ? (
        <span />
      ) : (
        <span className="journey-count" data-zero={count === 0}>
          <span className="type-body-strong tabular-nums text-[var(--ink)]">{count}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">agora</span>
        </span>
      )}
    </button>
  );
}

function Rail() {
  return (
    <div className="rel-tl-delay">
      <span className="rel-tl-rail" />
    </div>
  );
}

export function JornadaWhatsApp({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const lp = useLpHost();
  const { info } = useAtendimentoInfo();
  const canManage = info?.role === "OWNER" || info?.role === "ADMIN";
  const [active, setActive] = useState<JourneyStageKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ["atendimento-jornada", workspaceId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/atendimento/jornada?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!r.ok) throw new Error("Falha ao carregar");
      return (await r.json()) as Jornada;
    },
  });

  const post = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/atrako/atendimento/jornada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...body }),
      });
      const json = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(json.error || "Não foi possível salvar");
      return json;
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => setError(e.message),
  });

  const questions = useMemo(
    () => (data ? data.qualification.askKeys.filter((k) => !data.qualification.lpKeys.includes(k)) : []),
    [data],
  );

  const chat = useMemo(() => {
    if (!data) return [];
    const base = journeyConversation({
      brand: data.brand || "sua empresa",
      askKeys: data.qualification.askKeys,
      lpKeys: data.qualification.lpKeys,
    });
    const items =
      active === "nutricao"
        ? [...base.filter((i) => i.stage === "entrada" || i.stage === "abertura" || i.stage === "perguntas"), ...nurtureConversation()]
        : base;
    return items;
  }, [data, active]);

  const brief = useMemo(() => {
    const [head, ...rest] = leadBrief({ answers: EXAMPLE_ANSWERS, priority: "A", reason: "qualified" }).split("\n");
    return { head, rows: rest.map((line) => line.split(/:\s(.+)/).slice(0, 2) as [string, string]) };
  }, []);

  if (isLoading || !data) {
    return (
      <section className="rel-card flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-muted-48)]" />
      </section>
    );
  }

  const wa = data.channels.whatsapp;
  const open = TEMPLATE_STATUS[data.templates.qualify_open ?? ""];
  const nudge = TEMPLATE_STATUS[data.templates.qualify_nudge ?? ""];
  const templatesMissing = !data.templates.qualify_open || !data.templates.qualify_nudge;
  const templatesTone: Tone = !wa.connected ? "off" : open?.tone === "ok" && nudge?.tone === "ok" ? "ok" : open?.tone === "bad" ? "bad" : "warn";
  const focusId = active ? chat.find((i) => i.stage === active)?.id ?? null : null;
  const enabled = data.qualification.enabled;

  return (
    <div className="flex flex-col gap-4">
      <div className="journey-status">
        <StatusItem label="WhatsApp" tone={wa.connected ? "ok" : "bad"} value={wa.connected ? "Conectado" : "Desconectado"}>
          {wa.connected ? (
            <span className="tabular-nums">{wa.phone ?? "Número comercial"}</span>
          ) : lp ? (
            <span>Conecte em Conexões</span>
          ) : (
            <TextLink href="/config/conexoes">Conectar</TextLink>
          )}
        </StatusItem>

        <StatusItem
          label="Modelos da Meta"
          tone={templatesTone}
          value={!wa.connected ? "Aguardando WhatsApp" : templatesMissing ? "Não criados" : open?.tone === "ok" && nudge?.tone === "ok" ? "Aprovados" : "Em análise"}
        >
          {wa.connected && templatesMissing && canManage ? (
            <Button size="toolbar" variant="outline" disabled={post.isPending} onClick={() => post.mutate({ action: "templates" })}>
              {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Criar modelos
            </Button>
          ) : (
            <>
              <span>Abertura · {open?.label ?? "—"}</span>
              <span>Lembrete · {nudge?.label ?? "—"}</span>
            </>
          )}
        </StatusItem>

        <StatusItem label="E-mail" tone={data.channels.email.connected ? "ok" : "warn"} value={data.channels.email.connected ? "Domínio próprio" : "Envio da plataforma"}>
          <span className="truncate">{data.channels.email.from ?? "Nutrição e avisos"}</span>
        </StatusItem>

        <StatusItem label="Qualificação automática" tone={enabled ? "ok" : "off"} value={enabled ? "Ligada" : "Desligada"}>
          <Switch
            checked={enabled}
            disabled={!canManage || post.isPending}
            onChange={(on) => post.mutate({ action: "toggle", enabled: on })}
            aria-label="Qualificação automática"
          />
        </StatusItem>
      </div>

      {error ? <p className="rel-card type-caption text-[var(--danger)]">{error}</p> : null}
      {enabled && !wa.connected ? (
        <p className="rel-card flex items-center gap-2 type-caption text-[var(--ink)]">
          <Dot tone="bad" />
          Sem WhatsApp conectado, nenhum lead recebe a qualificação. Eles seguem só na nutrição por e-mail.
        </p>
      ) : null}

      <SectionCard title="Jornada do lead" action={active ? <Button variant="ghost" size="toolbar" onClick={() => setActive(null)}>Ver tudo</Button> : null}>
        <div className="journey-grid">
          <div className="rel-timeline min-w-0">
            {JOURNEY_STAGES.map((stage, i) => (
              <Fragment key={stage.key}>
                {i > 0 ? <Rail /> : null}
                {stage.key === "horario" ? (
                  <>
                    <div className="journey-fork type-fine-print text-[var(--ink-muted-48)]">
                      <span className="rel-tl-rail" />
                      <span className="flex flex-wrap items-center gap-1.5">
                        Classificação
                        <span className="rel-badge type-micro-legal" data-tone="ok">A quente · {data.priorities.A}</span>
                        <span className="rel-badge type-micro-legal" data-tone="warn">B interessado · {data.priorities.B}</span>
                        <span className="rel-badge type-micro-legal">C nutrição · {data.priorities.C}</span>
                      </span>
                    </div>
                    <Rail />
                  </>
                ) : null}
                <StageRow
                  stage={stage}
                  count={stage.key === "entrada" ? data.stages.entrada : data.stages[stage.key]}
                  active={active === stage.key}
                  onSelect={() => setActive(active === stage.key ? null : stage.key)}
                >
                  {stage.key === "entrada"
                    ? data.qualification.lpKeys
                        .filter((k) => k !== "name" && k !== "phone" && k !== "email")
                        .map((k) => (
                          <span key={k} className="rel-badge type-micro-legal">
                            {crmLabel(k)}
                          </span>
                        ))
                    : null}
                  {stage.key === "abertura" ? (
                    <span className="rel-badge type-micro-legal" data-tone={open?.tone === "ok" ? "ok" : undefined}>
                      Modelo da Meta
                    </span>
                  ) : null}
                  {stage.key === "perguntas"
                    ? questions.map((k, n) => (
                        <span key={k} className="rel-badge type-micro-legal">
                          {n + 1}. {crmLabel(k)}
                        </span>
                      ))
                    : null}
                  {stage.key === "horario" ? <span className="rel-badge type-micro-legal">Manhã · Tarde · Noite</span> : null}
                  {stage.key === "equipe" ? (
                    <>
                      <span className="rel-badge type-micro-legal">Ficha no lead</span>
                      <span className="rel-badge type-micro-legal">Aviso</span>
                      <span className="rel-badge type-micro-legal">E-mail se quente</span>
                    </>
                  ) : null}
                </StageRow>
              </Fragment>
            ))}

            <div className="mt-4 border-t border-[var(--divider-soft)] pt-4">
              <StageRow
                stage={NURTURE_STAGE}
                count={data.stages.nutricao + data.stalled}
                active={active === "nutricao"}
                onSelect={() => setActive(active === "nutricao" ? null : "nutricao")}
                dashed
              >
                <span className="rel-badge type-micro-legal">C · {data.stages.nutricao}</span>
                <span className="rel-badge type-micro-legal" data-tone={data.stalled ? "warn" : undefined}>
                  Sem resposta · {data.stalled}
                </span>
                {NO_REPLY_STEPS.map((s) => (
                  <span key={s.after} className="rel-badge type-micro-legal">
                    {s.after}: {s.what.toLowerCase()}
                  </span>
                ))}
              </StageRow>
            </div>
          </div>

          <div className="flex justify-center lg:sticky lg:top-4">
            <ChatPhone
              theme="whatsapp"
              header={{ name: data.brand || "Sua empresa", subtitle: "Conta comercial" }}
              items={toChatItems(chat, active)}
              focusId={focusId}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Ficha que a equipe recebe" info={<ClipboardList className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} />}>
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <dl className="journey-brief type-caption">
            {brief.rows.map(([k, v]) => (
              <Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
          </dl>
          <div className="flex flex-col gap-1.5 type-fine-print text-[var(--ink-muted-80)] md:max-w-[220px]">
            <span className="type-caption-strong text-[var(--ink)]">{brief.head.replace("Ficha do WhatsApp · ", "")}</span>
            <span>Nota no lead, aviso no sino e conversa liberada em Conversas.</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
