"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Mail, MessageCircle, Zap } from "lucide-react";
import { Button, InfoHint, PillSelect, Switch } from "@/components/ui";
import { api, num, pct } from "@/components/relacionamento/format";
import { lastDaysPeriod } from "@/components/relacionamento/period";
import { StepEditor, type FlowStep } from "@/components/relacionamento/StepEditor";
import { NativeRecoveryChecklistCard } from "@/components/relacionamento/NativeRecoveryChecklistCard";
import { RelEmpty, RelLoading } from "@/components/relacionamento/ui";
import { EMAIL_EXAMPLE_VALUES, MessagePhone } from "@/components/relacionamento/phone/MessagePhone";
import { interpolate } from "@/lib/flows/variables";
import { TRIGGER_LABEL, delayWords, flowPhoneItems } from "@/components/relacionamento/flowPhone";

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

function shortGap(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 2880 && (minutes < 1440 || minutes % 1440 !== 0)) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
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
  const [editing, setEditing] = useState<{ flowId: string; stepId: string } | null>(null);
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
        let prevDelay = 0;
        let prevMini = 0;
        return (
          <section key={f.id} className="rel-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
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
                  <span className="rel-mini-timeline mt-2 type-micro-legal">
                    {f.steps.map((s, i) => {
                      const gap = s.delayMinutes - prevMini;
                      prevMini = s.delayMinutes;
                      return (
                        <Fragment key={s.id}>
                          {i > 0 ? <span className="rel-mini-gap">{gap > 0 ? shortGap(gap) : ""}</span> : null}
                          <span className="rel-mini-dot" data-channel={s.channel} data-off={!s.enabled}>
                            <ChannelIcon channel={s.channel} />
                          </span>
                        </Fragment>
                      );
                    })}
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

                  <div className="rel-timeline">
                    <div className="rel-tl-trigger type-caption">
                      <span className="rel-tl-rail">
                        <span className="rel-mini-dot">
                          <Zap className="h-3.5 w-3.5" />
                        </span>
                      </span>
                      <span className="text-[var(--ink)]">Quando: {TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
                    </div>
                    {f.steps.map((s) => {
                      const gap = s.delayMinutes - prevDelay;
                      prevDelay = s.delayMinutes;
                      const tplPending =
                        s.channel === "WHATSAPP" && s.preview?.kind === "whatsapp" && s.preview.templateStatus !== "APPROVED";
                      return (
                        <Fragment key={s.id}>
                          <div className="rel-tl-delay type-fine-print">
                            <span className="rel-tl-rail" />
                            <span>{delayWords(gap)}</span>
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            className="rel-tl-item cursor-pointer"
                            data-active={active === s.id}
                            style={s.enabled ? undefined : { opacity: 0.55 }}
                            onClick={() => setActive(s.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setActive(s.id);
                            }}
                          >
                            <span className="rel-mini-dot" data-channel={s.channel}>
                              <ChannelIcon channel={s.channel} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="type-fine-print block text-[var(--ink-muted-48)]">
                                {s.channel === "EMAIL" ? "E-mail" : "WhatsApp"}
                                {s.couponCode ? ` · cupom ${s.couponCode}` : ""}
                              </span>
                              <span className="type-caption-strong block truncate text-[var(--ink)]">{stepTitle(s, data.store.name)}</span>
                              <span className="mt-1 flex flex-wrap gap-1.5">
                                {s.draftContent ? <span className="rel-badge type-micro-legal" data-tone="warn">Não publicado</span> : null}
                                {!s.enabled ? <span className="rel-badge type-micro-legal">Desligado</span> : null}
                                {tplPending ? (
                                  <span className="rel-badge type-micro-legal" data-tone="warn">
                                    {s.preview?.kind === "whatsapp" && s.preview.templateStatus ? "Modelo em análise" : "Sem modelo aprovado"}
                                  </span>
                                ) : null}
                                {s.couponCode && !s.couponConfirmed ? <span className="rel-badge type-micro-legal" data-tone="warn">Confirmar cupom</span> : null}
                              </span>
                            </span>
                            <Button
                              variant="outline"
                              size="toolbar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing({ flowId: f.id, stepId: s.id });
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
                    storeName={data.store.name}
                    avatarUrl={data.store.logoUrl}
                    items={flowPhoneItems(workspaceId, f.trigger, f.steps)}
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
