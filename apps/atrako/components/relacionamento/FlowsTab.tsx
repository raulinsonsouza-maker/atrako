"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button, InfoHint, PillSelect, Switch } from "@/components/ui";
import { api, brl, brlMicros, delayLabel, num, pct } from "@/components/relacionamento/format";
import type { RelPeriod } from "@/components/relacionamento/period";
import { StepEditor, type FlowStep } from "@/components/relacionamento/StepEditor";
import { NativeRecoveryChecklistCard } from "@/components/relacionamento/NativeRecoveryChecklistCard";
import { RelEmpty, RelLoading } from "@/components/relacionamento/ui";

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

const TRIGGER_LABEL: Record<string, string> = {
  cart_abandoned: "Carrinho abandonado",
  cart_aging_30: "Carrinho sem compra há 30 dias",
  cart_aging_60: "Carrinho sem compra há 60 dias",
  cart_aging_90: "Carrinho sem compra há 90 dias",
  order_unpaid: "Pedido aguardando pagamento",
  order_paid: "Pedido pago",
  second_purchase: "Depois da 1ª compra",
  repurchase_due: "Hora de recomprar",
  winback: "Cliente inativo",
  lead_lost: "Lead marcado como perdido",
  lead_welcome: "Novo cadastro",
  date_based: "Data importante",
};

export function FlowsTab({ workspaceId, period }: { workspaceId: string; period: RelPeriod }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ flowId: string; stepId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ["rel-flows", workspaceId];
  const { data, isLoading } = useQuery({
    queryKey: [...key, period.qs],
    queryFn: () => api<{ flows: Flow[] }>(`/api/atrako/relacionamento/flows?workspaceId=${workspaceId}&${period.qs}`),
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
            {activeCount} de {data.flows.length} ativos
          </span>
          <InfoHint>
            Cada contato fica em um fluxo por vez (o de maior prioridade). Comprou, respondeu ou descadastrou: sai do fluxo. Passos com rascunho só vão ao ar
            depois de testar e publicar.
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
        const sent = f.steps.reduce((s, st) => s + st.stats.sent, 0);
        const clicked = f.steps.reduce((s, st) => s + st.stats.clicked, 0);
        const cost = f.steps.reduce((s, st) => s + st.stats.costMicros, 0);
        const active = (f.enrollments.ACTIVE ?? 0) + (f.enrollments.PAUSED ?? 0);
        const pausedByError = f.status === "PAUSED" && Boolean(f.pausedReason) && f.pausedReason !== "Pausado manualmente";
        return (
          <section key={f.id} className="rel-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={() => setOpen(expanded ? null : f.id)}>
                {expanded ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-body-strong text-[var(--ink)]">{f.name}</span>
                    {f.status === "DRAFT" ? <span className="rel-badge type-micro-legal">Rascunho</span> : null}
                    {pausedByError ? <span className="rel-badge type-micro-legal" data-tone="bad">Pausado</span> : null}
                    {drafts ? <span className="rel-badge type-micro-legal" data-tone="warn">{drafts} rascunho{drafts > 1 ? "s" : ""}</span> : null}
                  </span>
                  <span className="type-fine-print block text-[var(--ink-muted-48)]">{TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
                  {pausedByError ? <span className="type-fine-print block text-[var(--ink)]">{f.pausedReason}</span> : null}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <span className="type-fine-print text-[var(--ink-muted-48)]">{f.status === "ACTIVE" ? "Ativo" : "Pausado"}</span>
                <Switch
                  checked={f.status === "ACTIVE"}
                  disabled={post.isPending}
                  onChange={(on) => post.mutate({ action: "flow_update", flowId: f.id, status: on ? "ACTIVE" : "PAUSED" })}
                  aria-label={`${f.name} ativo`}
                />
              </div>
            </div>

            <div className={`mt-3 grid gap-3 ${expanded ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"}`}>
              <Stat label="Em andamento" value={num(active)} />
              {expanded ? <Stat label="Entraram" value={num(f.entered)} /> : null}
              <Stat label="Cliques" value={pct(clicked, sent)} />
              <Stat label="Receita" value={brl(f.attributed.cents)} />
              {expanded ? <Stat label="Custo WhatsApp" value={brlMicros(cost)} /> : null}
            </div>

            {expanded ? (
              <div className="mt-3">
                {f.description ? <p className="mb-3 type-fine-print text-[var(--ink-muted-48)]">{f.description}</p> : null}
                {f.trigger === "cart_abandoned" ? (
                  <div className="mb-3">
                    <NativeRecoveryChecklistCard workspaceId={workspaceId} />
                  </div>
                ) : null}
                {f.steps.map((s) => (
                  <div key={s.id} className="rel-step" style={s.enabled ? undefined : { opacity: 0.55 }}>
                    <span className="rel-step-dot">
                      {s.channel === "EMAIL" ? <Mail className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    </span>
                    <button type="button" className="min-w-0 text-left" onClick={() => setEditing({ flowId: f.id, stepId: s.id })}>
                      <span className="type-caption-strong block truncate text-[var(--ink)]">
                        {s.position === 0 && s.delayMinutes === 0 ? "Na hora" : `+${delayLabel(s.delayMinutes)}`} · {s.label}
                      </span>
                      <span className="type-fine-print block text-[var(--ink-muted-48)]">
                        {num(s.stats.sent)} envios · {pct(s.stats.clicked, s.stats.sent)} cliques · {brl(s.stats.cents)}
                        {s.couponCode ? ` · cupom ${s.couponCode}${s.couponConfirmed ? "" : " (não confirmado)"}` : ""}
                        {s.draftContent ? " · rascunho não publicado" : ""}
                        {!s.enabled ? " · desligado" : ""}
                      </span>
                    </button>
                    <Button variant="ghost" onClick={() => setEditing({ flowId: f.id, stepId: s.id })}>
                      Editar
                    </Button>
                  </div>
                ))}
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--divider-soft)] pt-3">
                  <span className="inline-flex items-center gap-0.5 type-fine-print text-[var(--ink-muted-48)]">
                    Grupo de controle
                    <InfoHint>Uma parte sorteada não recebe nada. Comparar com quem recebeu mostra o efeito real do fluxo (veja em Desempenho).</InfoHint>
                  </span>
                  <PillSelect
                    value={String(f.holdoutPercent)}
                    onChange={(v) => post.mutate({ action: "flow_update", flowId: f.id, holdoutPercent: Number(v) })}
                    options={[0, 5, 10, 20].map((n) => ({ value: String(n), label: n ? `${n}%` : "Desligado" }))}
                    aria-label="Grupo de controle"
                  />
                  {f.holdoutPercent > 0 && f.holdout.control.n ? (
                    <span className="type-fine-print text-[var(--ink-muted-80)]">
                      {pct(f.holdout.treated.converted, f.holdout.treated.n)} compraram com mensagens vs {pct(f.holdout.control.converted, f.holdout.control.n)} sem
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="type-micro-legal block text-[var(--ink-muted-48)]">{label}</span>
      <span className="type-caption-strong tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}
