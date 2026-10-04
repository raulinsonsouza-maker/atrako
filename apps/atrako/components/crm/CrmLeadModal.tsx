"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  ShoppingCart,
  X,
} from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type JourneyItem = {
  at: string;
  type: string;
  title: string;
  detail?: string | null;
  href?: string | null;
};

type CartItem = {
  title: string;
  quantity: number;
  unitPriceCents?: number;
  sku?: string | null;
};

type LeadCart = {
  id: string;
  provider: string;
  providerLabel: string;
  kind: string;
  status: "PENDING" | "OPEN" | "RECOVERED" | "EXPIRED" | string;
  totalCents: number;
  currency: string;
  items: CartItem[];
  recoveryUrl: string | null;
  abandonedAt: string;
  recoveredAt: string | null;
  recoveredCents: number | null;
  notifiedAt: string | null;
};

type LeadDetail = {
  lead: {
    id: string;
    contactId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    source: string | null;
    status: string;
    dealValue: number | null;
    stageId: string | null;
    stageName: string | null;
    stageColor: string | null;
    sources: string[];
    lostReason: string | null;
    lostAt: string | null;
  };
  stages: Array<{ id: string; name: string; color: string }>;
  journey: JourneyItem[];
  carts: LeadCart[];
};

const LOST_REASON_LABELS: Record<string, string> = {
  pedido_nao_pago: "Pedido não pago há mais de 30 dias",
  carrinho_expirado: "Carrinho expirou sem compra (30 dias)",
  reembolso: "Pedido reembolsado",
};

const CART_STATUS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Em aberto", color: "var(--primary)" },
  PENDING: { label: "Aguardando pagamento", color: "var(--ink-muted-48)" },
  RECOVERED: { label: "Recuperado", color: "var(--success)" },
  EXPIRED: { label: "Expirado", color: "var(--ink-muted-48)" },
};

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtCents(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function fmtRelative(iso: string) {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(diffH, "hour");
  return rtf.format(Math.round(diffH / 24), "day");
}

function recoveryMessage(name: string, cart: LeadCart) {
  const first = name.split(" ")[0] || "";
  const item = cart.items[0]?.title;
  const what = item ? (cart.items.length > 1 ? `${item} e outros itens` : item) : "seus itens";
  return `Oi${first ? ` ${first}` : ""}! Vi que você separou ${what} e não finalizou a compra. Ainda está disponível, é só concluir por aqui: ${cart.recoveryUrl}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="!px-3 !py-1.5 type-button-utility"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[var(--success)]" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {copied ? "Copiado" : label}
    </Button>
  );
}

function CartBlock({ cart, leadName }: { cart: LeadCart; leadName: string }) {
  const status = CART_STATUS[cart.status] ?? { label: cart.status, color: "var(--ink-muted-48)" };
  const actionable = (cart.status === "OPEN" || cart.status === "PENDING") && !!cart.recoveryUrl;
  const itemsCents = cart.items.reduce(
    (sum, i) => sum + (i.unitPriceCents ?? 0) * (i.quantity || 1),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-caption-strong text-[var(--ink)]">
            {cart.kind === "order" ? "Pedido não pago" : "Carrinho abandonado"}
          </p>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {cart.providerLabel} · {fmtRelative(cart.abandonedAt)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-2 py-0.5 type-micro-legal"
          style={{ color: status.color }}
        >
          {status.label}
        </span>
      </div>

      {cart.items.length > 0 ? (
        <ul className="divide-y divide-[var(--hairline)]">
          {cart.items.map((item, idx) => (
            <li key={`${item.sku ?? item.title}-${idx}`} className="flex items-baseline justify-between gap-3 py-1.5">
              <p className="min-w-0 type-caption text-[var(--ink)]">
                <span className="tabular-nums text-[var(--ink-muted-48)]">{item.quantity || 1}×</span>{" "}
                {item.title}
              </p>
              {item.unitPriceCents ? (
                <p className="shrink-0 type-caption tabular-nums text-[var(--ink-muted-80)]">
                  {fmtCents(item.unitPriceCents * (item.quantity || 1), cart.currency)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-fine-print text-[var(--ink-muted-48)]">A loja não enviou os itens</p>
      )}

      {itemsCents > 0 && cart.totalCents > itemsCents ? (
        <div className="flex items-baseline justify-between">
          <p className="type-caption text-[var(--ink-muted-48)]">Frete e taxas</p>
          <p className="type-caption tabular-nums text-[var(--ink-muted-80)]">
            {fmtCents(cart.totalCents - itemsCents, cart.currency)}
          </p>
        </div>
      ) : null}

      <div className="flex items-baseline justify-between border-t border-[var(--hairline)] pt-2">
        <p className="type-caption text-[var(--ink-muted-48)]">Total</p>
        <p className="type-body-strong tabular-nums text-[var(--ink)]">
          {fmtCents(cart.totalCents || itemsCents, cart.currency)}
        </p>
      </div>

      {cart.status === "RECOVERED" && cart.recoveredAt ? (
        <p className="type-fine-print text-[var(--success)]">
          Recuperado em {new Date(cart.recoveredAt).toLocaleString("pt-BR")}
          {cart.recoveredCents ? ` · ${fmtCents(cart.recoveredCents, cart.currency)}` : ""}
        </p>
      ) : cart.notifiedAt ? (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          WhatsApp de recuperação enviado {fmtRelative(cart.notifiedAt)}
        </p>
      ) : cart.status === "OPEN" ? (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          WhatsApp automático não enviado — vale um contato manual
        </p>
      ) : null}

      {actionable ? (
        <div className="flex flex-wrap gap-2">
          <a
            href={cart.recoveryUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "secondary-pill" }), "!px-3 !py-1.5 type-button-utility")}
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Link de pagamento
          </a>
          <CopyButton text={cart.recoveryUrl!} label="Copiar link" />
          <CopyButton text={recoveryMessage(leadName, cart)} label="Copiar mensagem" />
        </div>
      ) : null}
    </div>
  );
}

export function CrmLeadModal({
  workspaceId,
  leadId,
  onClose,
}: {
  workspaceId: string;
  leadId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["crm-lead", workspaceId, leadId],
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/crm/leads/${leadId}?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<LeadDetail>;
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function moveStage(stageId: string) {
    if (!data?.lead.stageId || stageId === data.lead.stageId) return;
    const r = await fetch("/api/atrako/crm/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, leadId, stageId }),
    });
    if (!r.ok) return;
    await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, leadId] });
    await qc.invalidateQueries({ queryKey: ["crm-pipeline", workspaceId] });
  }

  const lead = data?.lead;
  const stageColor = lead?.stageColor || "var(--primary)";
  const carts = (data?.carts ?? []).slice(0, 3);
  const journey = [...(data?.journey ?? [])].reverse();
  const selfHref = `/crm/leads/${leadId}`;

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="panel-modal"
        role="dialog"
        aria-modal="true"
        aria-label={lead?.name ?? "Lead"}
        style={{ ["--stage-color" as string]: stageColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                {[lead?.stageName, lead?.source].filter(Boolean).join(" · ") || "Lead"}
              </p>
              <h2 className="mt-1 type-tagline truncate text-[var(--ink)]">
                {isLoading ? "…" : lead?.name ?? "Lead"}
              </h2>
              {lead?.dealValue != null && lead.dealValue > 0 ? (
                <p className="mt-1 type-body-strong tabular-nums text-[var(--primary)]">
                  {fmtCurrency(lead.dealValue)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)] hover:text-[var(--ink)] active:scale-95"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="panel-modal-body">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          ) : isError || !lead ? (
            <p className="py-10 text-center type-caption text-[var(--ink-muted-48)]">
              Não foi possível carregar
            </p>
          ) : (
            <>
              <div className="panel-modal-section space-y-3">
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="type-micro-legal text-[var(--ink-muted-48)]">E-mail</p>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="block truncate type-caption text-[var(--ink)] hover:text-[var(--primary)]">
                        {lead.email}
                      </a>
                    ) : (
                      <p className="type-caption text-[var(--ink)]">—</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="type-micro-legal text-[var(--ink-muted-48)]">Telefone</p>
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} className="block truncate type-caption text-[var(--ink)] hover:text-[var(--primary)]">
                        {lead.phone}
                      </a>
                    ) : (
                      <p className="type-caption text-[var(--ink)]">—</p>
                    )}
                  </div>
                </div>
              </div>

              {lead.status === "LOST" && lead.lostReason ? (
                <div className="panel-modal-section">
                  <p className="type-caption-strong text-[var(--ink)]">Motivo da perda</p>
                  <p className="mt-0.5 type-caption text-[var(--ink-muted-80)]">
                    {LOST_REASON_LABELS[lead.lostReason] ?? lead.lostReason}
                  </p>
                  <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                    Contato mantido na base para reativação.
                  </p>
                </div>
              ) : null}

              {carts.length > 0 ? (
                <div className="panel-modal-section space-y-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                    <p className="type-caption-strong text-[var(--ink)]">Carrinho</p>
                  </div>
                  {carts.map((cart, idx) => (
                    <div
                      key={cart.id}
                      className={idx > 0 ? "border-t border-[var(--hairline)] pt-4" : undefined}
                    >
                      <CartBlock cart={cart} leadName={lead.name} />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="panel-modal-section">
                <p className="mb-2 type-caption-strong text-[var(--ink)]">Etapa</p>
                <PillSelect
                  size="field"
                  aria-label="Etapa"
                  value={lead.stageId ?? ""}
                  onChange={moveStage}
                  options={(data?.stages ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                    color: s.color,
                  }))}
                />
              </div>

              {lead.sources.length > 0 ? (
                <div className="panel-modal-section">
                  <p className="mb-2 type-caption-strong text-[var(--ink)]">Origens</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.sources.map((s) => (
                      <span
                        key={s}
                        className="rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-2.5 py-0.5 type-micro-legal text-[var(--ink-muted-48)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="panel-modal-section">
                <p className="mb-3 type-caption-strong text-[var(--ink)]">Jornada</p>
                {!journey.length ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">Sem eventos ainda</p>
                ) : (
                  <ol className="journey-rail">
                    {journey.map((item, idx) => (
                      <li key={`${item.at}-${item.type}-${idx}`} className="journey-rail-item">
                        <span className="journey-rail-dot" />
                        <p className="type-micro-legal text-[var(--ink-muted-48)]">
                          {new Date(item.at).toLocaleString("pt-BR")}
                        </p>
                        <p className="type-caption-strong text-[var(--ink)]">{item.title}</p>
                        {item.detail ? (
                          <p className="type-fine-print text-[var(--ink-muted-48)]">{item.detail}</p>
                        ) : null}
                        {item.href && item.href !== selfHref ? (
                          <Link
                            href={item.href}
                            className="type-fine-print text-[var(--primary)] hover:underline"
                          >
                            ver
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>

        <div className="panel-modal-footer">
          {lead?.phone ? (
            <Link
              href="/whatsapp"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption-strong text-[var(--on-primary)] active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              WhatsApp
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="!px-4 !py-2 type-button-utility"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </aside>
    </div>
  );
}
