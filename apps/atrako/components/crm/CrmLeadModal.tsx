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
  ShoppingBag,
  ShoppingCart,
  X,
} from "lucide-react";
import { describeOrderOrigin, type OrderSourceView } from "@/lib/commerce-attribution/describe";
import { isClosedOrder, orderStatusLabel } from "@/lib/commerce-attribution/order-status";
import { PillSelect } from "@/components/ui/pill-select";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhone, sourceLabel } from "@/components/crm/CrmLeadCard";
import { LeadCommunications, type LeadCommunicationsData } from "@/components/crm/LeadCommunications";

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
  imageUrl?: string | null;
  productUrl?: string | null;
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
  orderExternalId: string | null;
  orderStatus: string | null;
};

type LeadOrder = {
  id: string;
  externalId: string;
  provider: string;
  providerLabel: string;
  status: string | null;
  totalCents: number;
  currency: string;
  occurredAt: string;
  fromCart: boolean;
  paid: boolean;
  items: Array<{
    title: string;
    quantity: number;
    unitPriceCents: number;
    imageUrl: string | null;
    productUrl: string | null;
  }>;
  source: (OrderSourceView & { deviceType: string | null; adId: string | null }) | null;
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
    createdAt: string;
  };
  stages: Array<{ id: string; name: string; color: string }>;
  journey: JourneyItem[];
  carts: LeadCart[];
  orders?: LeadOrder[];
  communications: LeadCommunicationsData | null;
};

const LOST_REASON_LABELS: Record<string, string> = {
  pedido_nao_pago: "Pedido não pago há mais de 30 dias",
  carrinho_expirado: "Carrinho expirou sem compra (30 dias)",
  reembolso: "Pedido reembolsado",
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtRelative(iso: string) {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(diffH, "hour");
  return rtf.format(Math.round(diffH / 24), "day");
}

function isOpenCart(cart: LeadCart) {
  return cart.status === "OPEN" || cart.status === "PENDING";
}

function cartClosed(cart: LeadCart) {
  return cart.kind === "order" && isClosedOrder(cart.orderStatus);
}

function cartTitle(cart: LeadCart) {
  if (cart.kind !== "order") return "Carrinho abandonado";
  const id = cart.orderExternalId ? `Pedido #${cart.orderExternalId}` : "Pedido";
  return cartClosed(cart) ? `${id} cancelado sem pagamento` : `${id} aguardando pagamento`;
}

function recoveryMessage(name: string, cart: LeadCart, withLink: boolean) {
  const first = name.split(" ")[0] || "";
  const item = cart.items[0]?.title;
  const what = item ? (cart.items.length > 1 ? `${item} e outros itens` : item) : "seus itens";
  const hi = `Oi${first ? ` ${first}` : ""}! Vi que você separou ${what} e não finalizou a compra.`;
  return withLink
    ? `${hi} Ainda está disponível, é só concluir por aqui: ${cart.recoveryUrl}`
    : `${hi} Ainda está disponível — posso te ajudar a concluir?`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="toolbar"
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

function SectionTitle({ icon: Icon, children }: { icon?: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} /> : null}
      <p className="type-caption-strong text-[var(--ink)]">{children}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="panel-modal-stat">
      <p className="type-micro-legal text-[var(--ink-muted-48)]">{label}</p>
      <p className="mt-0.5 type-body-strong tabular-nums text-[var(--ink)]">{value}</p>
      {hint ? <p className="type-micro-legal text-[var(--ink-muted-48)]">{hint}</p> : null}
    </div>
  );
}

function ProductThumb({ src }: { src?: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-14 w-14 shrink-0 rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] object-cover"
    />
  ) : (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] text-[var(--ink-muted-48)]">
      <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
    </span>
  );
}

function ItemList({ items, currency }: { items: CartItem[]; currency: string }) {
  if (!items.length) {
    return <p className="type-fine-print text-[var(--ink-muted-48)]">A loja não enviou os itens</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const qty = item.quantity || 1;
        return (
          <li key={`${item.sku ?? item.title}-${idx}`} className="flex items-center gap-3">
            <ProductThumb src={item.imageUrl} />
            <div className="min-w-0 flex-1">
              {item.productUrl ? (
                <a
                  href={item.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 type-caption-strong text-[var(--ink)] hover:text-[var(--primary)]"
                >
                  {item.title}
                </a>
              ) : (
                <p className="line-clamp-2 type-caption-strong text-[var(--ink)]">{item.title}</p>
              )}
              {item.unitPriceCents ? (
                <p className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">
                  {qty}× {fmtCents(item.unitPriceCents, currency)}
                </p>
              ) : (
                <p className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{qty}×</p>
              )}
            </div>
            {item.unitPriceCents ? (
              <p className="shrink-0 type-caption tabular-nums text-[var(--ink)]">
                {fmtCents(item.unitPriceCents * qty, currency)}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function CartBlock({ cart, leadName }: { cart: LeadCart; leadName: string }) {
  const closed = cartClosed(cart);
  const canPay = !closed && !!cart.recoveryUrl;
  const itemsCents = cart.items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * (i.quantity || 1), 0);

  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="type-caption-strong text-[var(--ink)]">{cartTitle(cart)}</p>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          {cart.providerLabel} · {fmtRelative(cart.abandonedAt)}
        </p>
      </div>

      <ItemList items={cart.items} currency={cart.currency} />

      <div className="space-y-1 border-t border-[var(--hairline)] pt-3">
        {itemsCents > 0 && cart.totalCents > itemsCents ? (
          <div className="flex items-baseline justify-between">
            <p className="type-caption text-[var(--ink-muted-48)]">Frete e taxas</p>
            <p className="type-caption tabular-nums text-[var(--ink-muted-80)]">
              {fmtCents(cart.totalCents - itemsCents, cart.currency)}
            </p>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between">
          <p className="type-caption text-[var(--ink-muted-48)]">Total</p>
          <p className="type-body-strong tabular-nums text-[var(--ink)]">
            {fmtCents(cart.totalCents || itemsCents, cart.currency)}
          </p>
        </div>
      </div>

      {cart.notifiedAt ? (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          WhatsApp de recuperação enviado {fmtRelative(cart.notifiedAt)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canPay ? (
          <>
            <a
              href={cart.recoveryUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "outline", size: "toolbar" })}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              Abrir link de pagamento
            </a>
            <CopyButton text={cart.recoveryUrl!} label="Copiar link" />
          </>
        ) : null}
        <CopyButton text={recoveryMessage(leadName, cart, canPay)} label="Copiar mensagem" />
      </div>
    </div>
  );
}

function hasKnownOrigin(source: LeadOrder["source"]) {
  return !!source && (!!source.adMethod || source.channel !== "unknown");
}

function OrderBlock({ order }: { order: LeadOrder }) {
  const origin = hasKnownOrigin(order.source) ? describeOrderOrigin(order.source) : null;
  const status = orderStatusLabel(order.status);
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-caption-strong text-[var(--ink)]">Pedido #{order.externalId}</p>
            {status ? (
              <span className="rel-badge type-micro-legal" data-tone={order.paid ? "ok" : "bad"}>
                {status}
              </span>
            ) : null}
          </div>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {order.providerLabel} · {fmtDateTime(order.occurredAt)}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 type-body-strong tabular-nums",
            order.paid ? "text-[var(--ink)]" : "text-[var(--ink-muted-48)] line-through",
          )}
        >
          {fmtCents(order.totalCents, order.currency)}
        </p>
      </div>

      {order.items.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 phone:grid-cols-1">
          {order.items.map((item, idx) => (
            <li key={`${item.title}-${idx}`} className="flex min-w-0 items-center gap-3">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] object-cover"
                />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)]" />
              )}
              <div className="min-w-0 flex-1">
                {item.productUrl ? (
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate type-caption text-[var(--ink)] hover:text-[var(--primary)]"
                    title={item.title}
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="truncate type-caption text-[var(--ink)]" title={item.title}>
                    {item.title}
                  </p>
                )}
                <p className="type-micro-legal tabular-nums text-[var(--ink-muted-48)]">
                  {item.quantity}× {fmtCents(item.unitPriceCents, order.currency)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {origin ? (
        <div className="rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-3 py-2">
          <p className="type-micro-legal text-[var(--ink-muted-48)]">Origem da compra</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="type-caption-strong text-[var(--ink)]">{origin.title}</p>
            {origin.badge ? (
              <span className="rel-badge type-micro-legal" data-tone={origin.badge.tone}>
                {origin.badge.label}
              </span>
            ) : null}
          </div>
          {origin.detail ? <p className="type-fine-print text-[var(--ink-muted-80)]">{origin.detail}</p> : null}
          {origin.lastVisit ? (
            <p className="mt-1 type-micro-legal text-[var(--ink-muted-48)]">{origin.lastVisit}</p>
          ) : null}
        </div>
      ) : (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          {order.source ? "A loja não informa a origem deste pedido." : "Origem ainda não calculada."}
        </p>
      )}
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
  const selfHref = `/crm/leads/${leadId}`;

  const openCarts = (data?.carts ?? []).filter(isOpenCart).slice(0, 3);
  const orders = (data?.orders ?? []).filter((o) => !o.fromCart).slice(0, 5);
  const paidOrders = (data?.orders ?? []).filter((o) => o.paid);
  const profile = data?.communications?.profile ?? null;
  const journey = [...(data?.journey ?? [])].reverse();

  const boughtCount = profile?.ordersCount || paidOrders.length;
  const boughtCents = profile?.ordersCount
    ? profile.totalSpentCents
    : paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const hasCommerce = boughtCount > 0 || (data?.orders?.length ?? 0) > 0 || (data?.carts?.length ?? 0) > 0;

  const recoverable = openCarts.filter((c) => !cartClosed(c));
  const openCents = openCarts.reduce((s, c) => s + c.totalCents, 0);

  const latestSource =
    (data?.orders ?? []).find((o) => o.paid && hasKnownOrigin(o.source))?.source ?? null;
  const originValue = latestSource
    ? latestSource.adMethod
      ? "Meta Ads"
      : latestSource.channelLabel
    : sourceLabel(lead?.source ?? null) ?? "—";
  const originHint = latestSource ? "da última compra" : "como entrou no CRM";

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
            <div className="min-w-0 flex-1">
              <h2 className="type-tagline text-[var(--ink)]">{isLoading ? "…" : lead?.name ?? "Lead"}</h2>
              {lead ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="inline-flex min-w-0 items-center gap-1.5 type-caption text-[var(--ink-muted-80)] hover:text-[var(--primary)]"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  ) : null}
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1.5 type-caption tabular-nums text-[var(--ink-muted-80)] hover:text-[var(--primary)]"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      {formatPhone(lead.phone)}
                    </a>
                  ) : null}
                  {!lead.email && !lead.phone ? (
                    <span className="type-caption text-[var(--ink-muted-48)]">Sem e-mail ou telefone</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lead && data?.stages.length ? (
                <PillSelect
                  aria-label="Etapa"
                  value={lead.stageId ?? ""}
                  onChange={moveStage}
                  options={data.stages.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                />
              ) : null}
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
        </div>

        <div className="panel-modal-body">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          ) : isError || !lead ? (
            <p className="py-10 text-center type-caption text-[var(--ink-muted-48)]">Não foi possível carregar</p>
          ) : (
            <>
              <div className="panel-modal-stats">
                {hasCommerce ? (
                  <Stat
                    label="Comprou"
                    value={boughtCount ? fmtCents(boughtCents) : "Ainda não"}
                    hint={
                      boughtCount
                        ? `${boughtCount} ${boughtCount === 1 ? "pedido pago" : "pedidos pagos"}${profile?.ordersCount ? ` · ${profile.lifecycleLabel}` : ""}`
                        : "nenhum pedido pago"
                    }
                  />
                ) : (
                  <Stat
                    label="Valor do negócio"
                    value={lead.dealValue ? fmtCurrency(lead.dealValue) : "—"}
                    hint={lead.dealValue ? null : "não informado"}
                  />
                )}
                <Stat
                  label="Não finalizado"
                  value={openCarts.length ? fmtCents(openCents) : "—"}
                  hint={
                    openCarts.length
                      ? recoverable.length
                        ? recoverable.length === 1 && recoverable[0].kind === "order"
                          ? "aguardando pagamento"
                          : "carrinho abandonado"
                        : "pedido cancelado"
                      : "nada pendente"
                  }
                />
                <Stat label="Origem" value={originValue} hint={originHint} />
                <Stat label="No CRM desde" value={fmtDate(lead.createdAt)} hint={fmtRelative(lead.createdAt)} />
              </div>

              {profile?.ordersCount ? (
                <p className="mt-2 px-1 type-fine-print text-[var(--ink-muted-48)]">
                  Primeira compra {profile.firstOrderAt ? fmtDate(profile.firstOrderAt) : "—"} · última{" "}
                  {profile.lastOrderAt ? fmtDate(profile.lastOrderAt) : "—"}
                  {profile.avgIntervalDays ? ` · compra a cada ~${Math.round(profile.avgIntervalDays)} dias` : ""}
                  {profile.topProducts.length
                    ? ` · mais comprados: ${profile.topProducts.slice(0, 3).map((t) => t.title).join(", ")}`
                    : ""}
                </p>
              ) : null}

              {lead.status === "LOST" && lead.lostReason ? (
                <div className="panel-modal-section mt-3">
                  <SectionTitle>Motivo da perda</SectionTitle>
                  <p className="mt-1 type-caption text-[var(--ink-muted-80)]">
                    {LOST_REASON_LABELS[lead.lostReason] ?? lead.lostReason}
                  </p>
                  <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                    Contato mantido na base para reativação.
                  </p>
                </div>
              ) : null}

              {openCarts.length > 0 ? (
                <div className="panel-modal-section mt-3 space-y-4">
                  <SectionTitle icon={ShoppingCart}>Compra não finalizada</SectionTitle>
                  {openCarts.map((cart, idx) => (
                    <div key={cart.id} className={idx > 0 ? "border-t border-[var(--hairline)] pt-4" : undefined}>
                      <CartBlock cart={cart} leadName={lead.name} />
                    </div>
                  ))}
                </div>
              ) : null}

              {orders.length ? (
                <div className="panel-modal-section mt-3 space-y-4">
                  <SectionTitle icon={ShoppingBag}>
                    {(data?.orders?.length ?? 0) > orders.length ? "Últimos pedidos" : "Pedidos"}
                  </SectionTitle>
                  {orders.map((order, idx) => (
                    <div key={order.id} className={idx > 0 ? "border-t border-[var(--hairline)] pt-4" : undefined}>
                      <OrderBlock order={order} />
                    </div>
                  ))}
                </div>
              ) : null}

              {data?.communications ? (
                <div className="mt-3">
                  <LeadCommunications
                    workspaceId={workspaceId}
                    leadId={leadId}
                    data={data.communications}
                    showProfile={false}
                    showHistory={false}
                  />
                </div>
              ) : null}

              <div className="panel-modal-section mt-3">
                <div className="mb-3">
                  <SectionTitle>Jornada</SectionTitle>
                </div>
                {!journey.length ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">Sem eventos ainda</p>
                ) : (
                  <ol className="journey-rail">
                    {journey.map((item, idx) => (
                      <li key={`${item.at}-${item.type}-${idx}`} className="journey-rail-item">
                        <span className="journey-rail-dot" />
                        <p className="type-micro-legal text-[var(--ink-muted-48)]">{fmtDateTime(item.at)}</p>
                        <p className="type-caption-strong text-[var(--ink)]">{item.title}</p>
                        {item.detail ? (
                          <p className="type-fine-print text-[var(--ink-muted-48)]">{item.detail}</p>
                        ) : null}
                        {item.href && item.href !== selfHref ? (
                          <Link href={item.href} className="type-fine-print text-[var(--primary)] hover:underline">
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
            <Link href="/whatsapp" className={buttonClass({ variant: "primary", size: "toolbar" })}>
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              WhatsApp
            </Link>
          ) : null}
          <Button type="button" variant="outline" size="toolbar" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </aside>
    </div>
  );
}
