"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cake, Mail, MessageCircle, Pause, Play, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, brl, dateBR, DELIVERY_STATUS_LABEL, deliveryTone } from "@/components/relacionamento/format";

export type LeadCommunicationsData = {
  channels: {
    email: string | null;
    phone: string | null;
    emailOptOutAt: string | null;
    emailBouncedAt: string | null;
    emailComplainedAt: string | null;
    waOptOutAt: string | null;
    waMarketingOptOutAt: string | null;
    marketingConsentAt: string | null;
    consentSource: string | null;
    flowsPausedUntil: string | null;
  };
  enrollments: Array<{
    id: string;
    flowName: string;
    status: string;
    stepIndex: number;
    totalSteps: number;
    nextRunAt: string | null;
    exitReason: string | null;
    holdout: boolean;
    convertedCents: number | null;
    createdAt: string;
  }>;
  deliveries: Array<{
    id: string;
    channel: string;
    status: string;
    title: string;
    origin: string;
    couponCode: string | null;
    sentAt: string | null;
    deliveredAt: string | null;
    openedAt: string | null;
    clickedAt: string | null;
    convertedAt: string | null;
    convertedCents: number | null;
    conversionKind: string | null;
    error: string | null;
    createdAt: string;
  }>;
  profile: {
    lifecycle: string;
    lifecycleLabel: string;
    ordersCount: number;
    totalSpentCents: number;
    avgTicketCents: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    avgIntervalDays: number | null;
    nextPurchaseAt: string | null;
    topProducts: Array<{ title: string; count?: number }>;
  } | null;
  birthday: { day: number; month: number; year: number | null; source: string | null } | null;
};

const ENROLLMENT_STATUS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  CONVERTED: "Comprou",
  EXITED: "Saiu",
  COMPLETED: "Concluído",
};

const EXIT_REASONS: Record<string, string> = {
  removed_manually: "removido manualmente",
  purchased: "comprou",
  cart_removed: "carrinho fechado",
  wa_optout: "saiu do WhatsApp",
  wa_stop: "pediu para parar",
  unsubscribe: "descadastrou",
  bounce: "e-mail inválido",
  complaint: "marcou como spam",
};

function Trail({ d }: { d: LeadCommunicationsData["deliveries"][number] }) {
  const steps = [
    { label: "Enviado", at: d.sentAt },
    { label: "Entregue", at: d.deliveredAt },
    { label: d.channel === "WHATSAPP" ? "Lido" : "Aberto", at: d.openedAt },
    { label: "Clicou", at: d.clickedAt },
    { label: "Comprou", at: d.convertedAt },
  ].filter((s) => s.at);
  if (!steps.length) return null;
  return (
    <p className="type-micro-legal text-[var(--ink-muted-48)]">
      {steps.map((s) => `${s.label} ${dateBR(s.at, true)}`).join(" · ")}
    </p>
  );
}

export function LeadCommunications({
  workspaceId,
  leadId,
  data,
  showProfile = true,
}: {
  workspaceId: string;
  leadId: string;
  data: LeadCommunicationsData;
  showProfile?: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [birthday, setBirthday] = useState(
    data.birthday ? `${String(data.birthday.day).padStart(2, "0")}/${String(data.birthday.month).padStart(2, "0")}${data.birthday.year ? `/${data.birthday.year}` : ""}` : "",
  );
  const [editingBirthday, setEditingBirthday] = useState(false);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      await api(`/api/atrako/crm/leads/${leadId}/communications`, { body: { workspaceId, ...body } });
      await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, leadId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  const c = data.channels;
  const emailBlocked = c.emailComplainedAt ? "Marcou como spam" : c.emailBouncedAt ? "E-mail inválido (bounce)" : c.emailOptOutAt ? "Descadastrado" : null;
  const waBlocked = c.waOptOutAt ? "Pediu para não receber" : c.waMarketingOptOutAt ? "Sem marketing (só avisos)" : null;
  const active = data.enrollments.filter((e) => e.status === "ACTIVE" || e.status === "PAUSED");
  const past = data.enrollments.filter((e) => e.status !== "ACTIVE" && e.status !== "PAUSED").slice(0, 3);
  const p = data.profile;

  return (
    <>
      {showProfile && p && p.ordersCount > 0 ? (
        <div className="panel-modal-section space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
              <p className="type-caption-strong text-[var(--ink)]">Cliente</p>
            </div>
            <span className="rel-badge type-micro-legal" data-tone={p.lifecycle === "VIP" || p.lifecycle === "RECORRENTE" ? "ok" : p.lifecycle === "EM_RISCO" || p.lifecycle === "INATIVO" ? "bad" : undefined}>
              {p.lifecycleLabel}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="type-micro-legal text-[var(--ink-muted-48)]">Pedidos</p>
              <p className="type-body-strong tabular-nums text-[var(--ink)]">{p.ordersCount}</p>
            </div>
            <div>
              <p className="type-micro-legal text-[var(--ink-muted-48)]">Total gasto</p>
              <p className="type-body-strong tabular-nums text-[var(--ink)]">{brl(p.totalSpentCents)}</p>
            </div>
            <div>
              <p className="type-micro-legal text-[var(--ink-muted-48)]">Ticket médio</p>
              <p className="type-body-strong tabular-nums text-[var(--ink)]">{brl(p.avgTicketCents)}</p>
            </div>
          </div>
          <p className="type-fine-print text-[var(--ink-muted-80)]">
            Primeira compra {dateBR(p.firstOrderAt)} · última {dateBR(p.lastOrderAt)}
            {p.avgIntervalDays ? ` · compra a cada ~${Math.round(p.avgIntervalDays)} dias` : ""}
            {p.nextPurchaseAt ? ` · próxima prevista ${dateBR(p.nextPurchaseAt)}` : ""}
          </p>
          {p.topProducts.length ? (
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              Mais comprados: {p.topProducts.slice(0, 3).map((t) => t.title).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="panel-modal-section space-y-3">
        <p className="type-caption-strong text-[var(--ink)]">Comunicações</p>

        <div className="flex flex-wrap gap-1.5">
          <span className="rel-badge type-micro-legal" data-tone={emailBlocked ? "bad" : c.email ? "ok" : undefined}>
            <Mail className="h-3 w-3" strokeWidth={1.75} />
            {emailBlocked ?? (c.email ? "E-mail ok" : "Sem e-mail")}
          </span>
          <span className="rel-badge type-micro-legal" data-tone={waBlocked ? "bad" : c.phone ? "ok" : undefined}>
            <MessageCircle className="h-3 w-3" strokeWidth={1.75} />
            {waBlocked ?? (c.phone ? "WhatsApp ok" : "Sem telefone")}
          </span>
          <button
            type="button"
            className="rel-badge type-micro-legal active:scale-95"
            data-tone={c.marketingConsentAt ? "ok" : "warn"}
            disabled={busy === "consent"}
            onClick={() => void act({ action: "consent", value: !c.marketingConsentAt }, "consent")}
            title="Consentimento para comunicações de marketing (LGPD)"
          >
            {c.marketingConsentAt ? `Consentiu (${c.consentSource ?? "—"})` : "Sem consentimento registrado"}
          </button>
        </div>

        {c.flowsPausedUntil ? (
          <div className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-3 py-2">
            <p className="type-fine-print text-[var(--ink-muted-80)]">
              Respondeu — fluxos de venda pausados até {dateBR(c.flowsPausedUntil, true)}
            </p>
            <button
              type="button"
              className="type-fine-print text-[var(--primary)] active:scale-95"
              onClick={() => void act({ action: "unpause_flows" }, "unpause")}
            >
              Retomar
            </button>
          </div>
        ) : null}

        {active.map((e) => (
          <div key={e.id} className="rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="type-caption-strong truncate text-[var(--ink)]">{e.flowName}</p>
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  {ENROLLMENT_STATUS[e.status] ?? e.status} · passo {Math.min(e.stepIndex + 1, e.totalSteps)} de {e.totalSteps}
                  {e.holdout ? " · grupo de controle" : ""}
                  {e.nextRunAt && e.status === "ACTIVE" ? ` · próximo ${dateBR(e.nextRunAt, true)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)] active:scale-95"
                  title={e.status === "PAUSED" ? "Retomar" : "Pausar"}
                  disabled={busy === e.id}
                  onClick={() => void act({ action: e.status === "PAUSED" ? "resume" : "pause", enrollmentId: e.id }, e.id)}
                >
                  {e.status === "PAUSED" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)] active:scale-95"
                  title="Remover do fluxo"
                  disabled={busy === e.id}
                  onClick={() => void act({ action: "remove", enrollmentId: e.id }, e.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {past.map((e) => (
          <p key={e.id} className="type-fine-print text-[var(--ink-muted-48)]">
            {e.flowName}: {ENROLLMENT_STATUS[e.status] ?? e.status}
            {e.exitReason ? ` (${EXIT_REASONS[e.exitReason] ?? e.exitReason})` : ""}
            {e.convertedCents ? ` · ${brl(e.convertedCents)}` : ""}
          </p>
        ))}

        {data.deliveries.length ? (
          <ul className="divide-y divide-[var(--divider-soft)]">
            {data.deliveries.slice(0, 12).map((d) => (
              <li key={d.id} className="space-y-0.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 type-caption text-[var(--ink)]">
                    {d.channel === "EMAIL" ? (
                      <Mail className="mr-1 inline h-3.5 w-3.5 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                    ) : (
                      <MessageCircle className="mr-1 inline h-3.5 w-3.5 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                    )}
                    {d.title}
                  </p>
                  <span className="rel-badge type-micro-legal" data-tone={deliveryTone(d.status)}>
                    {DELIVERY_STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </div>
                <p className="type-micro-legal text-[var(--ink-muted-48)]">
                  {d.origin}
                  {d.couponCode ? ` · cupom ${d.couponCode}` : ""}
                  {d.convertedCents ? ` · ${brl(d.convertedCents)} (${d.conversionKind === "ATTRIBUTED" ? "atribuída" : "influenciada"})` : ""}
                </p>
                <Trail d={d} />
                {d.error ? <p className="type-micro-legal text-[var(--danger)]">{d.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhuma mensagem automática enviada ainda.</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[var(--divider-soft)] pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <Cake className="h-4 w-4 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
            {editingBirthday ? (
              <input
                className="rel-input type-caption h-8 w-32"
                placeholder="DD/MM/AAAA"
                value={birthday}
                autoFocus
                onChange={(e) => setBirthday(e.target.value)}
              />
            ) : (
              <p className="type-caption text-[var(--ink)]">
                {data.birthday
                  ? `Aniversário ${String(data.birthday.day).padStart(2, "0")}/${String(data.birthday.month).padStart(2, "0")}`
                  : "Sem aniversário"}
              </p>
            )}
          </div>
          {editingBirthday ? (
            <Button
              type="button"
              variant="outline"
              className="!px-3 !py-1 type-button-utility"
              disabled={busy === "birthday"}
              onClick={async () => {
                await act({ action: "birthday", value: birthday }, "birthday");
                setEditingBirthday(false);
              }}
            >
              Salvar
            </Button>
          ) : (
            <button
              type="button"
              className="type-fine-print text-[var(--primary)] active:scale-95"
              onClick={() => setEditingBirthday(true)}
            >
              {data.birthday ? "Editar" : "Adicionar"}
            </button>
          )}
        </div>
        {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
      </div>
    </>
  );
}
