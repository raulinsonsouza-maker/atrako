"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button, PillSelect } from "@/components/ui";
import { api, brl, brlMicros, delayLabel, num, pct } from "@/components/relacionamento/format";
import { StepEditor, type FlowStep } from "@/components/relacionamento/StepEditor";
import { NativeRecoveryChecklistCard } from "@/components/relacionamento/NativeRecoveryChecklistCard";

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
  order_unpaid: "Pedido aguardando pagamento",
  order_paid: "Pedido pago",
  second_purchase: "Depois da 1ª compra",
  repurchase_due: "Hora de recomprar",
  winback: "Cliente inativo",
  lead_lost: "Lead marcado como perdido",
  lead_welcome: "Novo cadastro",
  date_based: "Data importante",
};

export function FlowsTab({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ flowId: string; stepId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ["rel-flows", workspaceId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<{ flows: Flow[] }>(`/api/atrako/relacionamento/flows?workspaceId=${workspaceId}&days=30`),
  });
  const post = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/api/atrako/relacionamento/flows", { body: { workspaceId, ...body } }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

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
      <section className="rel-card space-y-3">
        <h2 className="type-body-strong text-[var(--ink)]">Fluxos automáticos</h2>
        <p className="type-caption text-[var(--ink-muted-80)]">
          Carrinho abandonado, pedido não pago, pós-compra, segunda compra, recompra, reativação, nutrição de perdidos, boas-vindas e aniversário —
          prontos com o texto e o visual da sua loja. Eles começam pausados para você revisar.
        </p>
        <Button disabled={post.isPending} onClick={() => post.mutate({ action: "ensure_defaults" })}>
          {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Criar fluxos padrão
        </Button>
        {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-[var(--ink-muted-80)]">
          Cada contato fica em um fluxo por vez (o de maior prioridade). Comprou, respondeu ou descadastrou: sai do fluxo.
        </p>
        <Button variant="ghost" disabled={post.isPending} onClick={() => post.mutate({ action: "ensure_defaults" })}>
          Adicionar fluxos que faltam
        </Button>
      </div>
      {error ? <p className="rel-card type-caption text-[var(--ink)]">{error}</p> : null}
      <NativeRecoveryChecklistCard workspaceId={workspaceId} />

      {data.flows.map((f) => {
        const expanded = open === f.id;
        const drafts = f.steps.filter((s) => s.draftContent).length;
        const sent = f.steps.reduce((s, st) => s + st.stats.sent, 0);
        const clicked = f.steps.reduce((s, st) => s + st.stats.clicked, 0);
        const cost = f.steps.reduce((s, st) => s + st.stats.costMicros, 0);
        const active = (f.enrollments.ACTIVE ?? 0) + (f.enrollments.PAUSED ?? 0);
        return (
          <section key={f.id} className="rel-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={() => setOpen(expanded ? null : f.id)}>
                {expanded ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-body-strong text-[var(--ink)]">{f.name}</span>
                    <span className="rel-badge type-micro-legal" data-tone={f.status === "ACTIVE" ? "ok" : f.pausedReason && f.pausedReason !== "Pausado manualmente" ? "warn" : undefined}>
                      {f.status === "ACTIVE" ? "Ativo" : f.status === "PAUSED" ? "Pausado" : "Rascunho"}
                    </span>
                    {drafts ? <span className="rel-badge type-micro-legal" data-tone="warn">{drafts} rascunho{drafts > 1 ? "s" : ""}</span> : null}
                  </span>
                  <span className="type-fine-print block text-[var(--ink-muted-48)]">
                    {TRIGGER_LABEL[f.trigger] ?? f.trigger}
                    {f.description ? ` · ${f.description}` : ""}
                  </span>
                  {f.status === "PAUSED" && f.pausedReason && f.pausedReason !== "Pausado manualmente" ? (
                    <span className="type-fine-print block text-[var(--ink)]">{f.pausedReason}</span>
                  ) : null}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant={f.status === "ACTIVE" ? "outline" : "primary"}
                  className="px-4 py-2"
                  disabled={post.isPending}
                  onClick={() => post.mutate({ action: "flow_update", flowId: f.id, status: f.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}
                >
                  {f.status === "ACTIVE" ? "Pausar" : "Ativar"}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Em andamento" value={num(active)} />
              <Stat label="Entraram (30d)" value={num(f.entered)} />
              <Stat label="Cliques" value={pct(clicked, sent)} />
              <Stat label="Receita atribuída" value={brl(f.attributed.cents)} />
              <Stat label="Custo WhatsApp" value={brlMicros(cost)} />
            </div>

            {expanded ? (
              <div className="mt-3">
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
                  <span className="type-fine-print text-[var(--ink-muted-48)]">Grupo de controle (não recebe, para medir o efeito real):</span>
                  <PillSelect
                    value={String(f.holdoutPercent)}
                    onChange={(v) => post.mutate({ action: "flow_update", flowId: f.id, holdoutPercent: Number(v) })}
                    options={[0, 5, 10, 20].map((n) => ({ value: String(n), label: n ? `${n}%` : "Desligado" }))}
                    aria-label="Grupo de controle"
                  />
                  {f.holdoutPercent > 0 && f.holdout.control.n ? (
                    <span className="type-fine-print text-[var(--ink-muted-80)]">
                      Compraram: {pct(f.holdout.treated.converted, f.holdout.treated.n)} com mensagens vs {pct(f.holdout.control.converted, f.holdout.control.n)} sem
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
