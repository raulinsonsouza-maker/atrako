"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Mail, MessageCircle, Zap } from "lucide-react";
import { Button, InfoHint, PillSelect, SegmentedControl, Switch } from "@/components/ui";
import { api, num, pct } from "@/components/relacionamento/format";
import { lastDaysPeriod } from "@/components/relacionamento/period";
import { StepEditor, type FlowStep } from "@/components/relacionamento/StepEditor";
import { NativeRecoveryChecklistCard } from "@/components/relacionamento/NativeRecoveryChecklistCard";
import { RelEmpty, RelLoading } from "@/components/relacionamento/ui";
import { EMAIL_EXAMPLE_VALUES, MessagePhone, type PhoneChannel } from "@/components/relacionamento/phone/MessagePhone";
import { interpolate } from "@/lib/flows/variables";
import {
  RESERVE_SUFFIX,
  RESERVE_TAG,
  TRIGGER_LABEL,
  channelSteps,
  channelSummary,
  delayWords,
  flowPhoneItems,
  reserveEmail,
  shortGap,
} from "@/components/relacionamento/flowPhone";

export type Flow = {
  id: string;
  key: string;
  name: string;
  trigger: string;
  status: "ACTIVE" | "PAUSED" | "DRAFT";
  pausedReason: string | null;
  priority: number;
  holdoutPercent: number;
  settings: Record<string, unknown> | null;
  description: string | null;
  enrollments: Record<string, number>;
  holdout: { treated: { n: number; converted: number; rate: number }; control: { n: number; converted: number; rate: number } };
  entered: number;
  attributed: { orders: number; cents: number };
  influenced: { orders: number; cents: number };
  steps: FlowStep[];
};

export type FlowStore = { name: string; logoUrl: string | null };

function ChannelIcon({ channel, className = "h-3.5 w-3.5" }: { channel: FlowStep["channel"]; className?: string }) {
  return channel === "EMAIL" ? <Mail className={className} /> : <MessageCircle className={className} />;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function MiniLane({ label, channel, steps }: { label: string; channel: PhoneChannel; steps: FlowStep[] }) {
  let prev = 0;
  return (
    <span className="rel-mini-timeline">
      <span className="rel-mini-lane-label">{label}</span>
      {steps.map((s) => {
        const gap = s.delayMinutes - prev;
        prev = s.delayMinutes;
        const reserve = channel === "EMAIL" && s.channel === "WHATSAPP";
        return (
          <Fragment key={s.id}>
            {gap > 0 ? <span className="rel-mini-gap">{shortGap(gap)}</span> : null}
            <span className="rel-mini-dot" data-channel={channel} data-off={!s.enabled} data-reserve={reserve || undefined}>
              <ChannelIcon channel={channel} />
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}

function stepTitle(s: FlowStep, storeName: string) {
  if (s.channel === "EMAIL") {
    const subject = s.preview?.kind === "email" && s.preview.subject ? s.preview.subject : s.label;
    return interpolate(subject, { ...EMAIL_EXAMPLE_VALUES, loja: storeName });
  }
  const body = s.preview?.kind === "whatsapp" ? s.preview.wa?.body : "";
  return body ? body.replace(/[*_~]/g, "").slice(0, 90) : s.label;
}

export function FlowsTab({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [period] = useState(() => lastDaysPeriod(30));
  const [open, setOpen] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ flowId: string; stepId: string; focus?: "fallback" } | null>(null);
  const [tabs, setTabs] = useState<Record<string, PhoneChannel>>({});
  const [error, setError] = useState<string | null>(null);
  const key = ["rel-flows", workspaceId];
  const { data, isLoading } = useQuery({
    queryKey: [...key, period.qs],
    queryFn: () => api<{ flows: Flow[]; store: FlowStore }>(`/api/atrako/relacionamento/flows?workspaceId=${workspaceId}&${period.qs}`),
    placeholderData: (prev) => prev,
  });
  const post = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/api/atrako/relacionamento/flows", { body: { workspaceId, ...body } }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["rel-overview", workspaceId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !data) return <RelLoading />;

  const editFlow = editing ? data.flows.find((f) => f.id === editing.flowId) : null;
  const editStep = editFlow?.steps.find((s) => s.id === editing?.stepId);
  if (editFlow && editStep) {
    return (
      <StepEditor
        workspaceId={workspaceId}
        flow={editFlow}
        step={editStep}
        store={data.store}
        focus={editing?.focus}
        onClose={() => setEditing(null)}
        onSaved={() => void qc.invalidateQueries({ queryKey: key })}
      />
    );
  }

  if (!data.flows.length) {
    return (
      <section className="rel-card">
        <RelEmpty
          text="Carrinho, pós-compra, recompra, aniversário e mais — prontos com o visual da sua loja. Começam pausados."
          action={
            <Button disabled={post.isPending} onClick={() => post.mutate({ action: "ensure_defaults" })}>
              {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar fluxos
            </Button>
          }
        />
        {error ? <p className="type-caption text-center text-[var(--ink)]">{error}</p> : null}
      </section>
    );
  }

  const activeCount = data.flows.filter((f) => f.status === "ACTIVE").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="type-caption text-[var(--ink-muted-80)]">
            {activeCount} de {data.flows.length} ligados
          </span>
          <InfoHint>
            Cada fluxo é uma sequência automática de mensagens. Cada contato fica em um fluxo por vez; comprou, respondeu ou descadastrou, sai do fluxo.
          </InfoHint>
        </div>
        <Button variant="ghost" disabled={post.isPending} onClick={() => post.mutate({ action: "ensure_defaults" })}>
          Completar fluxos
        </Button>
      </div>
      {error ? <p className="rel-card type-caption text-[var(--ink)]">{error}</p> : null}

      {data.flows.map((f) => {
        const expanded = open === f.id;
        const drafts = f.steps.filter((s) => s.draftContent).length;
        const running = (f.enrollments.ACTIVE ?? 0) + (f.enrollments.PAUSED ?? 0);
        const pausedByError = f.status === "PAUSED" && Boolean(f.pausedReason) && f.pausedReason !== "Pausado manualmente";
        const showAdvanced = advanced === f.id;
        const summary = channelSummary(f.steps);
        const channel: PhoneChannel = tabs[f.id] ?? (summary.waTab ? "WHATSAPP" : "EMAIL");
        const laneSteps = channelSteps(f.steps, channel);
        let prevDelay = 0;
        return (
          <section key={f.id} className="rel-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 basis-[280px] items-start gap-2 text-left"
                onClick={() => {
                  setOpen(expanded ? null : f.id);
                  setActive(null);
                }}
              >
                {expanded ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-body-strong text-[var(--ink)]">{f.name}</span>
                    {f.status === "DRAFT" ? <span className="rel-badge type-micro-legal">Rascunho</span> : null}
                    {pausedByError ? <span className="rel-badge type-micro-legal" data-tone="bad">Pausado</span> : null}
                    {drafts ? <span className="rel-badge type-micro-legal" data-tone="warn">{drafts} não publicado{drafts > 1 ? "s" : ""}</span> : null}
                  </span>
                  <span className="type-fine-print block text-[var(--ink-muted-48)]">{TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
                  {pausedByError ? <span className="type-fine-print block text-[var(--ink)]">{f.pausedReason}</span> : null}
                  <span className="rel-mini-lanes mt-2 type-micro-legal">
                    {summary.waTab ? <MiniLane label="WhatsApp" channel="WHATSAPP" steps={channelSteps(f.steps, "WHATSAPP")} /> : null}
                    {summary.emailTab ? <MiniLane label="E-mail" channel="EMAIL" steps={channelSteps(f.steps, "EMAIL")} /> : null}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-3">
                <span className="type-fine-print text-right text-[var(--ink-muted-48)]">
                  <span className="type-caption-strong block tabular-nums text-[var(--ink)]">{num(running)}</span>
                  em andamento
                </span>
                <Switch
                  checked={f.status === "ACTIVE"}
                  disabled={post.isPending}
                  onChange={(on) => post.mutate({ action: "flow_update", flowId: f.id, status: on ? "ACTIVE" : "PAUSED" })}
                  aria-label={`${f.name} ligado`}
                />
              </div>
            </div>

            {expanded ? (
              <div className="rel-flow-open">
                <div className="min-w-0">
                  {f.description ? <p className="mb-3 type-caption text-[var(--ink-muted-80)]">{f.description}</p> : null}
                  {f.trigger === "cart_abandoned" ? (
                    <div className="mb-3">
                      <NativeRecoveryChecklistCard workspaceId={workspaceId} />
                    </div>
                  ) : null}

                  {summary.waTab && summary.emailTab ? (
                    <SegmentedControl
                      aria-label="Canal"
                      value={channel}
                      onChange={(v) => {
                        setTabs((t) => ({ ...t, [f.id]: v }));
                        setActive(null);
                      }}
                      options={[
                        { value: "WHATSAPP", label: `WhatsApp (${summary.waTab})` },
                        { value: "EMAIL", label: `E-mail (${summary.emailTab})` },
                      ]}
                    />
                  ) : null}
                  {summary.wa ? (
                    <p className="rel-channel-summary type-fine-print">
                      <span>
                        <MessageCircle className="h-3.5 w-3.5 text-[var(--success)]" />
                        Quem tem WhatsApp recebe {plural(summary.wa, "mensagem", "mensagens")}
                        {summary.email ? ` e ${plural(summary.email, "e-mail", "e-mails")}` : ""}
                      </span>
                      <span>
                        <Mail className="h-3.5 w-3.5 text-[var(--primary)]" />
                        Quem não tem recebe{" "}
                        {summary.email + summary.reserve ? plural(summary.email + summary.reserve, "e-mail", "e-mails") : "nada deste fluxo"}
                      </span>
                    </p>
                  ) : null}

                  <div className="rel-timeline mt-2">
                    <div className="rel-tl-trigger type-caption">
                      <span className="rel-tl-rail">
                        <span className="rel-mini-dot">
                          <Zap className="h-3.5 w-3.5" />
                        </span>
                      </span>
                      <span className="text-[var(--ink)]">Quando: {TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
                    </div>
                    {laneSteps.map((s) => {
                      const gap = s.delayMinutes - prevDelay;
                      prevDelay = s.delayMinutes;
                      const reserve = channel === "EMAIL" && s.channel === "WHATSAPP" ? reserveEmail(s) : null;
                      const rowId = reserve ? s.id + RESERVE_SUFFIX : s.id;
                      const tplPending =
                        !reserve && s.channel === "WHATSAPP" && s.preview?.kind === "whatsapp" && s.preview.templateStatus !== "APPROVED";
                      const title = reserve
                        ? interpolate(reserve.subject || "E-mail", { ...EMAIL_EXAMPLE_VALUES, loja: data.store.name })
                        : stepTitle(s, data.store.name);
                      return (
                        <Fragment key={rowId}>
                          <div className="rel-tl-delay type-fine-print">
                            <span className="rel-tl-rail" />
                            <span>
                              {delayWords(gap)}
                              {gap !== s.delayMinutes && s.delayMinutes > 0 ? ` · ${shortGap(s.delayMinutes)} após o gatilho` : ""}
                            </span>
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            className="rel-tl-item cursor-pointer"
                            data-active={active === rowId}
                            data-reserve={reserve ? true : undefined}
                            style={s.enabled ? undefined : { opacity: 0.55 }}
                            onClick={() => setActive(rowId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setActive(rowId);
                            }}
                          >
                            <span className="rel-mini-dot" data-channel={channel}>
                              <ChannelIcon channel={channel} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="type-fine-print block text-[var(--ink-muted-48)]">
                                {reserve ? "E-mail reserva do WhatsApp" : s.channel === "EMAIL" ? "E-mail" : "WhatsApp"}
                                {s.couponCode ? ` · cupom ${s.couponCode}` : ""}
                              </span>
                              <span className="type-caption-strong block truncate text-[var(--ink)]">{title}</span>
                              <span className="mt-1 flex flex-wrap gap-1.5">
                                {reserve ? <span className="rel-badge type-micro-legal">{RESERVE_TAG}</span> : null}
                                {s.draftContent ? <span className="rel-badge type-micro-legal" data-tone="warn">Não publicado</span> : null}
                                {!s.enabled ? <span className="rel-badge type-micro-legal">Desligado</span> : null}
                                {tplPending ? (
                                  <span className="rel-badge type-micro-legal" data-tone="warn">
                                    {s.preview?.kind === "whatsapp" && s.preview.templateStatus ? "Modelo em análise" : "Sem modelo aprovado"}
                                  </span>
                                ) : null}
                                {s.channel === "WHATSAPP" && !reserve && reserveEmail(s) ? (
                                  <span className="rel-badge type-micro-legal">Sem WhatsApp: vai por e-mail</span>
                                ) : null}
                                {s.couponCode && !s.couponConfirmed ? <span className="rel-badge type-micro-legal" data-tone="warn">Confirmar cupom</span> : null}
                              </span>
                            </span>
                            <Button
                              variant="outline"
                              size="toolbar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing({ flowId: f.id, stepId: s.id, focus: reserve ? "fallback" : undefined });
                              }}
                            >
                              Editar
                            </Button>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>

                  <div className="mt-4 border-t border-[var(--divider-soft)] pt-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 type-fine-print text-[var(--ink-muted-80)]"
                      onClick={() => setAdvanced(showAdvanced ? null : f.id)}
                    >
                      {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Opções avançadas
                    </button>
                    {showAdvanced ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-0.5 type-fine-print text-[var(--ink-muted-48)]">
                          Grupo de controle
                          <InfoHint>Uma parte sorteada não recebe nada. Comparar com quem recebeu mostra o efeito real do fluxo.</InfoHint>
                        </span>
                        <PillSelect
                          value={String(f.holdoutPercent)}
                          onChange={(v) => post.mutate({ action: "flow_update", flowId: f.id, holdoutPercent: Number(v) })}
                          options={[0, 5, 10, 20].map((n) => ({ value: String(n), label: n ? `${n}%` : "Desligado" }))}
                          aria-label="Grupo de controle"
                        />
                        {f.holdoutPercent > 0 && f.holdout.control.n ? (
                          <span className="type-fine-print text-[var(--ink-muted-80)]">
                            {pct(f.holdout.treated.converted, f.holdout.treated.n)} compraram com mensagens vs{" "}
                            {pct(f.holdout.control.converted, f.holdout.control.n)} sem
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-center lg:sticky lg:top-4">
                  <MessagePhone
                    key={channel}
                    storeName={data.store.name}
                    avatarUrl={data.store.logoUrl}
                    items={flowPhoneItems(workspaceId, f.trigger, f.steps, channel)}
                    channel={channel}
                    highlightId={active}
                    onSelect={setActive}
                  />
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
