"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShoppingBag,
  ShoppingCart,
  X,
} from "lucide-react";
import {
  describeOrderOrigin,
  describeVisit,
  type OrderSourceView,
  type OrderVisitView,
} from "@/lib/commerce-attribution/describe";
import { isClosedOrder, orderStatusLabel } from "@/lib/commerce-attribution/order-status";
import { formatLocation, type OrderDetails } from "@/lib/commerce/order-details";
import { Button, buttonClass } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/components/crm/CrmLeadCard";
import { useCrmLinks } from "@/components/crm/CrmLinksContext";
import { LeadCommunications, type LeadCommunicationsData } from "@/components/crm/LeadCommunications";
import { LeadPaymentLinks } from "@/components/crm/LeadPaymentLinks";

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
  visit: OrderVisitView | null;
  details: OrderDetails | null;
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
    sourceLabel: string | null;
    location: string | null;
    nickname: string | null;
    address: string | null;
    document: string | null;
    shipping: string | null;
    lostReason: string | null;
    lostAt: string | null;
    notes?: Array<{ id: string; text: string; at: string }>;
    ownerMemberId?: string | null;
    ownerName?: string | null;
    campaignName?: string | null;
    adName?: string | null;
    formName?: string | null;
    qualification?: {
      playbookId: string;
      priority: "A" | "B" | "C" | null;
      priorityLabel?: string | null;
      filledPercent: number;
      currentState: string;
      cadenceStatus?: string;
      nextAction?: string | null;
      missing: string[];
      answers: Array<{
        key: string;
        fieldLabel: string;
        label: string;
        value: string;
        code: string | null;
        source: string;
        at: string;
      }>;
    } | null;
    createdAt: string;
  };
  members?: Array<{ id: string; name: string; email: string }>;
  stages: Array<{ id: string; name: string; color: string }>;
  journey: JourneyItem[];
  carts: LeadCart[];
  orders?: LeadOrder[];
  communications: LeadCommunicationsData | null;
};

const ORDERS_PREVIEW = 3;

const LOST_REASON_LABELS: Record<string, string> = {
  pedido_nao_pago: "Pedido não pago há mais de 6 meses",
  carrinho_expirado: "6 meses sem compra depois do carrinho",
  contato_invalido: "E-mail e WhatsApp não chegam",
  reembolso: "Pedido reembolsado",
  preco: "Preço",
  sem_fit: "Sem fit",
  concorrente: "Concorrente",
  sem_resposta: "Sem resposta",
};

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
  return cartClosed(cart) ? `${id} · não pago` : `${id} aguardando pagamento`;
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function journeyTone(item: JourneyItem): "ok" | "neutral" {
  if (
    item.type === "marketplace.order.placed" ||
    item.type === "commerce.order" ||
    item.type === "lead.lost" ||
    item.type === "cart.abandoned"
  ) {
    return "neutral";
  }
  if (/purchase|won|recovered|income/.test(item.type) || /pago/i.test(item.title)) return "ok";
  return "neutral";
}

function JourneyMark({ item }: { item: JourneyItem }) {
  const tone = journeyTone(item);
  const Icon =
    tone === "ok"
      ? Check
      : /placed|created|form|stage|order|booking/.test(item.type)
        ? Pencil
        : Clock;
  return (
    <span className="journey-rail-mark" data-tone={tone === "ok" ? "ok" : undefined}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

function SectionTitle({ icon: Icon, children }: { icon?: typeof ShoppingBag; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} /> : null}
      <p className="type-caption-strong text-[var(--ink)]">{children}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-modal-stat">
      <p className="panel-modal-stat-label type-fine-print">{label}</p>
      <p className="panel-modal-stat-value type-caption-strong tabular-nums" title={value}>
        {value}
      </p>
    </div>
  );
}

function priorityTone(priority: "A" | "B" | "C" | null | undefined): "ok" | "warn" | undefined {
  if (priority === "A") return "ok";
  if (priority === "B") return "warn";
  return undefined;
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

function CartBlock({ cart, leadName, order }: { cart: LeadCart; leadName: string; order?: LeadOrder }) {
  const closed = cartClosed(cart);
  const canPay = !closed && !!cart.recoveryUrl;
  const itemsCents = cart.items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * (i.quantity || 1), 0);

  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-caption-strong text-[var(--ink)]">{cartTitle(cart)}</p>
          {cart.orderStatus && closed ? (
            <span className="rel-badge type-micro-legal" data-tone="bad">
              {orderStatusLabel(cart.orderStatus)}
            </span>
          ) : null}
        </div>
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

      {order?.source ? <OriginBox order={order} label="Como chegou" /> : null}

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

function OrderBlock({ order, leadLocation }: { order: LeadOrder; leadLocation: string | null }) {
  const status = orderStatusLabel(order.status);
  const d = order.details;
  const itemsCents = order.items.reduce((sum, i) => sum + i.unitPriceCents * (i.quantity || 1), 0);
  const shipping = d?.shipping ?? null;
  const shippingCents =
    shipping?.cents ??
    (order.provider === "MERCADO_LIVRE"
      ? null
      : itemsCents > 0 && order.totalCents > itemsCents
        ? order.totalCents - itemsCents
        : null);
  const showMethodInRow =
    shippingCents != null && !!shipping?.method && !(shippingCents === 0 && /gr[aá]tis/i.test(shipping.method));
  const notes = orderNotes(order, d, shippingCents == null, leadLocation);

  return (
    <div className="space-y-3">
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
          {order.providerLabel} · {fmtRelative(d?.createdAt ?? order.occurredAt)}
        </p>
      </div>

      <ItemList items={order.items} currency={order.currency} />

      <div className="space-y-1 border-t border-[var(--hairline)] pt-3">
        {shippingCents != null ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate type-caption text-[var(--ink-muted-48)]">
              {showMethodInRow ? `Frete · ${shipping!.method}` : shipping ? "Frete" : "Frete e taxas"}
            </p>
            <p className="shrink-0 type-caption tabular-nums text-[var(--ink-muted-80)]">
              {shippingCents === 0 ? "Grátis" : fmtCents(shippingCents, order.currency)}
            </p>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between">
          <p className="type-caption text-[var(--ink-muted-48)]">Total</p>
          <p
            className={cn(
              "type-body-strong tabular-nums",
              order.paid ? "text-[var(--ink)]" : "text-[var(--ink-muted-48)] line-through",
            )}
          >
            {fmtCents(order.totalCents || itemsCents, order.currency)}
          </p>
        </div>
      </div>

      {notes.length ? (
        <p className="type-fine-print text-[var(--ink-muted-80)]">
          {notes.map((n, i) => (
            <Fragment key={i}>
              {i > 0 ? " · " : null}
              {n}
            </Fragment>
          ))}
        </p>
      ) : null}

      <OriginBox order={order} />
    </div>
  );
}

/** Pagamento, cupom, prazo, destino e presente numa linha curta abaixo do total. */
function orderNotes(order: LeadOrder, d: OrderDetails | null, showMethod: boolean, leadLocation: string | null) {
  if (!d) return [];
  const notes: ReactNode[] = [];
  if (d.paymentMethod) {
    const installments = d.installments ? ` em ${d.installments}x` : "";
    notes.push(order.paid ? `Pago com ${d.paymentMethod}${installments}` : `Escolheu ${d.paymentMethod}`);
  }
  if (d.coupons.length) {
    for (const c of d.coupons) {
      notes.push(`cupom ${c.code}${c.discountCents ? ` (−${fmtCents(c.discountCents, order.currency)})` : ""}`);
    }
  } else if (d.discountCents > 0) {
    notes.push(`desconto de ${fmtCents(d.discountCents, order.currency)}`);
  }
  const s = d.shipping;
  if (s?.method && showMethod) notes.push(s.method);
  if (s?.days) notes.push(`prazo de ${s.days} ${s.days === 1 ? "dia útil" : "dias úteis"}`);
  if (s?.estimatedDate) notes.push(`previsão ${s.estimatedDate.slice(8, 10)}/${s.estimatedDate.slice(5, 7)}`);
  const place = formatLocation(d.location);
  if (place && place !== leadLocation) notes.push(`entrega em ${place}`);
  if (d.gift) notes.push(d.giftTo ? `presente para ${d.giftTo}` : "presente");
  if (s?.trackingUrl) {
    notes.push(
      <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
        rastrear
      </a>,
    );
  }
  return notes;
}

function OriginBox({ order, label = "Origem da compra" }: { order: LeadOrder; label?: string }) {
  const origin = hasKnownOrigin(order.source) ? describeOrderOrigin(order.source) : null;
  const visit = order.visit ? describeVisit(order.visit) : null;
  return (
    <>
      {origin ? (
        <div className="rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-3 py-2">
          <p className="type-micro-legal text-[var(--ink-muted-48)]">{label}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="type-caption-strong text-[var(--ink)]">{origin.title}</p>
            {origin.badge ? (
              <span className="rel-badge type-micro-legal" data-tone={origin.badge.tone}>
                {origin.badge.label}
              </span>
            ) : null}
          </div>
          {origin.detail && order.source?.adMethod ? (
            <p className="type-fine-print text-[var(--ink-muted-80)]">{origin.detail}</p>
          ) : null}
          {visit?.arrival ? <p className="type-fine-print text-[var(--ink-muted-80)]">{visit.arrival}</p> : null}
          {visit?.session ? <p className="type-micro-legal text-[var(--ink-muted-48)]">{visit.session}</p> : null}
          {origin.lastVisit ? (
            <p className="mt-1 type-micro-legal text-[var(--ink-muted-48)]">{origin.lastVisit}</p>
          ) : null}
        </div>
      ) : (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          {order.source ? "A loja não informa a origem deste pedido." : "Origem ainda não calculada."}
          {visit?.session ? ` ${visit.session}.` : ""}
        </p>
      )}
    </>
  );
}

export function CrmLeadModal({
  workspaceId,
  leadId,
  salesMode = false,
  onClose,
}: {
  workspaceId: string;
  leadId: string;
  salesMode?: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [panelTab, setPanelTab] = useState<"jornada" | "pedidos" | "conversas" | "notas" | "cobranca">("jornada");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sendingCof, setSendingCof] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
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

  useEffect(() => {
    if (salesMode && (panelTab === "conversas" || panelTab === "pedidos")) {
      setPanelTab("jornada");
    }
  }, [salesMode, panelTab]);

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
  const links = useCrmLinks();

  const openCarts = (data?.carts ?? []).filter(isOpenCart).slice(0, 3);
  const allOrders = (data?.orders ?? []).filter((o) => !o.fromCart);
  const orders = showAllOrders ? allOrders : allOrders.slice(0, ORDERS_PREVIEW);
  const paidOrders = (data?.orders ?? []).filter((o) => o.paid);
  const profile = data?.communications?.profile ?? null;
  const journey = [...(data?.journey ?? [])].reverse();

  const boughtCount = profile?.ordersCount || paidOrders.length;
  const boughtCents = profile?.ordersCount
    ? profile.totalSpentCents
    : paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const openCents = openCarts.reduce((s, c) => s + c.totalCents, 0);
  const purchaseItems = (data?.orders ?? []).find((o) => o.items.length)?.items ?? [];
  const purchaseShown = purchaseItems.slice(0, 2).map((item) => (item.quantity > 1 ? `${item.quantity}× ${item.title}` : item.title));
  const purchaseExtra = purchaseItems.length - purchaseShown.length;
  const purchaseLine = purchaseShown.length
    ? purchaseExtra > 0
      ? `${purchaseShown.join(", ")} e mais ${purchaseExtra}`
      : purchaseShown.join(", ")
    : null;

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
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary-glow)] type-caption-strong text-[var(--primary)]">
              {lead ? initials(lead.name) : "…"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="type-tagline truncate text-[var(--ink)]">{isLoading ? "…" : lead?.name ?? "Lead"}</h2>
                  {lead && data?.stages.length ? (
                    <PillSelect
                      className="panel-modal-stage-chip mt-2"
                      aria-label="Etapa do funil"
                      value={lead.stageId ?? ""}
                      onChange={(stageId) => {
                        void moveStage(stageId);
                      }}
                      options={data.stages.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                    />
                  ) : lead ? (
                    <span className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 type-fine-print text-[var(--ink-muted-48)]">
                      Sem etapa
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--hairline)] text-[var(--ink-muted-48)] active:scale-95"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              {lead ? (
                <div className="panel-modal-contacts">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="type-caption tabular-nums">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                      {formatPhone(lead.phone)}
                    </a>
                  ) : null}
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="type-caption">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  ) : null}
                  {lead.location ? (
                    <span className="type-caption">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                      {lead.location}
                    </span>
                  ) : null}
                  {lead.address ? <span className="type-caption">{lead.address}</span> : null}
                  {lead.nickname ? (
                    <span className="type-caption">Apelido no Mercado Livre: {lead.nickname}</span>
                  ) : null}
                  {lead.document ? <span className="type-caption tabular-nums">{lead.document}</span> : null}
                  {lead.shipping ? <span className="type-caption">Envio {lead.shipping}</span> : null}
                  {purchaseLine ? (
                    <span className="type-caption">
                      <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                      {purchaseLine}
                    </span>
                  ) : null}
                  {!lead.phone && !lead.email ? (
                    <span className="type-caption text-[var(--ink-muted-48)]">
                      {lead.source === "mercadolivre" || lead.source === "MERCADO_LIVRE"
                        ? "O Mercado Livre não enviou e-mail nem telefone"
                        : "Sem e-mail ou telefone"}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {lead && salesMode ? (
            <div className="panel-modal-stats">
              {lead.qualification ? (
                <Stat
                  label="Prioridade"
                  value={lead.qualification.priorityLabel || "—"}
                />
              ) : (
                <Stat
                  label="Valor"
                  value={
                    lead.dealValue != null
                      ? lead.dealValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"
                  }
                />
              )}
              <Stat label="Origem" value={lead.sourceLabel || lead.formName || lead.campaignName || "—"} />
              <Stat label="Entrou" value={fmtDate(lead.createdAt)} />
            </div>
          ) : lead ? (
            <div className="panel-modal-stats">
              <Stat label="Receita paga" value={fmtCents(boughtCents)} />
              <Stat
                label={boughtCount ? "Pedidos pagos" : openCents ? "Não pago" : "Pedidos pagos"}
                value={boughtCount ? String(boughtCount) : openCents ? fmtCents(openCents) : "0"}
              />
              <Stat label="Entrou" value={fmtDate(lead.createdAt)} />
            </div>
          ) : null}
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
              {lead.qualification?.answers?.length ? (
                <section className="panel-modal-qualify">
                  <div className="panel-modal-qualify-head">
                    <h3 className="type-caption-strong">Do formulário</h3>
                    {lead.qualification.priorityLabel ? (
                      <span
                        className="rel-badge type-micro-legal"
                        data-tone={priorityTone(lead.qualification.priority)}
                      >
                        {lead.qualification.priorityLabel}
                      </span>
                    ) : null}
                    {lead.qualification.filledPercent < 100 ? (
                      <span className="type-fine-print text-[var(--ink-muted-48)]">
                        {lead.qualification.filledPercent}% respondido
                      </span>
                    ) : null}
                    {lead.phone ? (
                      <a
                        href={links.conversationHref(lead.phone)}
                        className="panel-modal-qualify-wa type-fine-print"
                      >
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                  <dl className="panel-modal-qualify-grid">
                    {lead.qualification.answers.map((a) => (
                      <div key={a.key} className="panel-modal-qualify-item">
                        <dt className="type-fine-print">{a.fieldLabel}</dt>
                        <dd className="type-caption-strong">{a.label || a.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {lead.qualification.nextAction ? (
                    <div className="panel-modal-qualify-next">
                      <span className="type-micro-legal">Próximo passo</span>
                      <p className="type-caption">{lead.qualification.nextAction}</p>
                    </div>
                  ) : null}
                </section>
              ) : null}
              <div className="panel-modal-tabs">
                <div className="panel-modal-tabs-list" role="tablist" aria-label="Lead">
                  {(
                    [
                      ["jornada", "Jornada"],
                      ...(!salesMode
                        ? ([
                            ["pedidos", "Pedidos"],
                            ["conversas", "Conversas"],
                          ] as const)
                        : []),
                      ["notas", "Notas"],
                      ["cobranca", "Cobrança"],
                    ] as Array<["jornada" | "pedidos" | "conversas" | "notas" | "cobranca", string]>
                  ).map(([id, label]) => {
                    const active = panelTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setPanelTab(id)}
                        className={`-mb-px shrink-0 border-b-2 pb-2.5 pt-2 type-nav-link active:scale-95 ${
                          active
                            ? "border-[var(--primary)] text-[var(--ink)]"
                            : "border-transparent text-[var(--muted-foreground)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {panelTab === "jornada" ? (
                <div className="panel-modal-panel" role="tabpanel">
                  {!journey.length ? (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">Sem eventos ainda</p>
                  ) : (
                    <ol className="journey-rail">
                      {journey.map((item, idx) => (
                        <li key={`${item.at}-${item.type}-${idx}`} className="journey-rail-item">
                          <JourneyMark item={item} />
                          <div className="min-w-0 pt-0.5">
                            <p className="type-fine-print text-[var(--ink-muted-48)]">{fmtDateTime(item.at)}</p>
                            <p className="mt-0.5 type-caption-strong text-[var(--ink)]">{item.title}</p>
                            {item.detail ? (
                              <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">{item.detail}</p>
                            ) : null}
                            {links.journeyLinks && item.href && item.href !== selfHref ? (
                              <Link href={item.href} className="mt-0.5 inline-block type-fine-print text-[var(--primary)]">
                                ver
                              </Link>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}

              {panelTab === "pedidos" ? (
                <div className="panel-modal-panel space-y-4" role="tabpanel">
                  {openCarts.length > 0 ? (
                    <div className="space-y-4">
                      <SectionTitle icon={ShoppingCart}>
                        {lead.status === "WON" ? "Nova compra não finalizada" : "Compra não finalizada"}
                      </SectionTitle>
                      {openCarts.map((cart, idx) => (
                        <div key={cart.id} className={idx > 0 ? "border-t border-[var(--hairline)] pt-4" : undefined}>
                          <CartBlock
                            cart={cart}
                            leadName={lead.name}
                            order={(data?.orders ?? []).find(
                              (o) => o.provider === cart.provider && o.externalId === cart.orderExternalId,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {orders.length ? (
                    <div className="space-y-4">
                      <SectionTitle icon={ShoppingBag}>
                        {allOrders.length > 1 ? `Pedidos (${allOrders.length})` : "Pedido"}
                      </SectionTitle>
                      {orders.map((order, idx) => (
                        <div key={order.id} className={idx > 0 ? "border-t border-[var(--hairline)] pt-4" : undefined}>
                          <OrderBlock order={order} leadLocation={lead.location} />
                        </div>
                      ))}
                      {allOrders.length > ORDERS_PREVIEW ? (
                        <button
                          type="button"
                          onClick={() => setShowAllOrders((v) => !v)}
                          className="type-caption text-[var(--primary)] active:scale-95"
                        >
                          {showAllOrders ? "Mostrar só os últimos" : `Ver todos os ${allOrders.length} pedidos`}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {!openCarts.length && !orders.length ? (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhum pedido</p>
                  ) : null}
                </div>
              ) : null}

              {panelTab === "conversas" && !salesMode ? (
                <div className="panel-modal-panel" role="tabpanel">
                  {data?.communications ? (
                    <LeadCommunications
                      workspaceId={workspaceId}
                      leadId={leadId}
                      data={data.communications}
                      showProfile={false}
                      showHistory
                    />
                  ) : (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhuma conversa</p>
                  )}
                </div>
              ) : null}

              {panelTab === "cobranca" ? (
                <div className="panel-modal-panel" role="tabpanel">
                  <LeadPaymentLinks workspaceId={workspaceId} leadId={leadId} />
                </div>
              ) : null}

              {panelTab === "notas" ? (
                <div className="panel-modal-panel space-y-3" role="tabpanel">
                  {salesMode ? (
                    <PillSelect
                      size="field"
                      value={lead.ownerMemberId ?? ""}
                      onChange={(ownerMemberId) => {
                        void fetch(`/api/atrako/crm/leads/${leadId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            workspaceId,
                            action: "owner",
                            ownerMemberId: ownerMemberId || null,
                          }),
                        }).then(() => qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, leadId] }));
                      }}
                      options={[
                        { value: "", label: "Sem responsável" },
                        ...(data?.members ?? []).map((m) => ({ value: m.id, label: m.name })),
                      ]}
                      aria-label="Responsável"
                    />
                  ) : null}
                  {(lead.notes ?? []).length ? (
                    <ul className="space-y-3">
                      {lead.notes?.map((note) => (
                        <li key={note.id}>
                          <p className="type-caption text-[var(--ink)]">{note.text}</p>
                          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">{fmtDate(note.at)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">Sem notas</p>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = noteText.trim();
                      if (!text || savingNote) return;
                      setSavingNote(true);
                      void fetch(`/api/atrako/crm/leads/${leadId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workspaceId, action: "note", text }),
                      })
                        .then(async (r) => {
                          if (!r.ok) return;
                          setNoteText("");
                          await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, leadId] });
                        })
                        .finally(() => setSavingNote(false));
                    }}
                  >
                    <input
                      className="h-11 min-w-0 flex-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Escreva uma nota"
                    />
                    <Button type="submit" variant="primary" size="toolbar" disabled={savingNote || !noteText.trim()}>
                      Salvar
                    </Button>
                  </form>
                  {lead.status === "LOST" && lead.lostReason ? (
                    <div>
                      <p className="type-caption-strong text-[var(--ink)]">Motivo da perda</p>
                      <p className="mt-1 type-caption text-[var(--ink-muted-80)]">
                        {LOST_REASON_LABELS[lead.lostReason] ?? lead.lostReason}
                      </p>
                      <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                        Contato mantido na base para reativação.
                      </p>
                    </div>
                  ) : null}
                  {profile?.ordersCount ? (
                    <div className="space-y-1">
                      <p className="type-caption text-[var(--ink-muted-80)]">
                        Ticket médio {fmtCents(profile.avgTicketCents)}
                        {profile.avgIntervalDays ? ` · compra a cada ~${Math.round(profile.avgIntervalDays)} dias` : ""}
                        {profile.nextPurchaseAt
                          ? new Date(profile.nextPurchaseAt).getTime() < Date.now()
                            ? ` · recompra esperada em ${fmtDate(profile.nextPurchaseAt)}, ainda não voltou`
                            : ` · próxima compra esperada em ${fmtDate(profile.nextPurchaseAt)}`
                          : ""}
                      </p>
                      <p className="type-fine-print text-[var(--ink-muted-48)]">
                        Primeira compra {profile.firstOrderAt ? fmtDate(profile.firstOrderAt) : "—"} · última{" "}
                        {profile.lastOrderAt ? fmtDate(profile.lastOrderAt) : "—"}
                        {profile.topProducts.length
                          ? ` · mais comprados: ${profile.topProducts.slice(0, 3).map((t) => t.title).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="panel-modal-footer">
          {lead?.phone ? (
            <Button
              type="button"
              variant="outline"
              size="toolbar"
              disabled={sendingCof}
              onClick={async () => {
                setSendingCof(true);
                try {
                  const r = await fetch(`/api/atrako/crm/leads/${lead.id}/send-cof`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspaceId }),
                  });
                  if (!r.ok) throw new Error("Falha ao enviar COF");
                  await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, lead.id] });
                } catch (e) {
                  setSendError(e instanceof Error ? e.message : "Falha ao enviar COF");
                } finally {
                  setSendingCof(false);
                }
              }}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
              Enviar COF
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="toolbar" onClick={() => setPanelTab("notas")}>
            Adicionar nota
          </Button>
          {lead && lead.status !== "WON" ? (
            <Button type="button" variant="outline" size="toolbar" onClick={() => setPanelTab("cobranca")}>
              Cobrar
            </Button>
          ) : null}
          {lead?.phone ? (
            <Link
              href={links.conversationHref(lead.phone)}
              className={buttonClass({ variant: "dark-utility", size: "toolbar" })}
            >
              Conversar no WhatsApp
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
