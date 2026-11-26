"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, MapPin, Phone, X } from "lucide-react";
import { formatPhone } from "@/components/crm/CrmLeadCard";
import { PillSelect } from "@/components/ui/pill-select";

type OrderDetail = {
  channel: "commerce" | "tray";
  id: string;
  externalId: string;
  email: string | null;
  name: string | null;
  cpf: string | null;
  phone: string | null;
  status: string | null;
  fulfillment: string;
  fulfillmentStatus: string | null;
  statusLabel?: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingFeeCents: number;
  totalCents: number;
  createdAt: string;
  approvedAt: string | null;
  mpOrderId: string | null;
  mpPaymentId: string | null;
  paymentMethod: string | null;
  installments: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  shippingAddress: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    cep: string;
  } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    sku: string | null;
    installments: number | null;
  }>;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function paymentLabel(order: OrderDetail) {
  const m = (order.paymentMethod || "").toLowerCase();
  if (m === "pix" || m.includes("pix")) return "Pix";
  if (m === "credit_card" || m.includes("cart")) {
    return order.installments && order.installments > 1
      ? `Cartão · ${order.installments}x`
      : "Cartão";
  }
  if (order.paymentMethod && order.paymentMethod !== "unknown") return order.paymentMethod;
  return null;
}

function addressLine(a: OrderDetail["shippingAddress"]) {
  if (!a) return null;
  const parts = [
    [a.street, a.number].filter(Boolean).join(", "),
    a.complement,
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join(" - "),
    a.cep ? `CEP ${a.cep}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const NEXT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  NEW: [
    { value: "CONFIRMED", label: "Confirmar" },
    { value: "CANCELLED", label: "Cancelar" },
  ],
  CONFIRMED: [
    { value: "READY", label: "Pronto (retirada)" },
    { value: "SHIPPED", label: "Enviado" },
    { value: "CANCELLED", label: "Cancelar" },
  ],
  READY: [
    { value: "COMPLETED", label: "Concluir" },
    { value: "CANCELLED", label: "Cancelar" },
  ],
  SHIPPED: [
    { value: "DELIVERED", label: "Entregue" },
    { value: "CANCELLED", label: "Cancelar" },
  ],
  DELIVERED: [{ value: "COMPLETED", label: "Concluir" }],
};

export function CommerceOrderSheet({
  workspaceId,
  orderId,
  channel,
  onClose,
  onFulfillmentChange,
}: {
  workspaceId: string;
  orderId: string;
  channel: "commerce" | "tray";
  onClose: () => void;
  onFulfillmentChange?: (status: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["commerce-order-detail", workspaceId, orderId, channel],
    queryFn: async () => {
      const q = new URLSearchParams({
        workspaceId,
        orderId,
        channel,
      });
      const res = await fetch(`/api/atrako/commerce/store-orders?${q}`);
      if (!res.ok) throw new Error("Falha ao carregar pedido");
      return (await res.json()) as { order: OrderDetail };
    },
  });

  const order = data?.order;
  const pay = order ? paymentLabel(order) : null;
  const addr = order ? addressLine(order.shippingAddress) : null;
  const utm = order
    ? [order.utmSource, order.utmMedium, order.utmCampaign].filter(Boolean).join(" / ")
    : "";

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="panel-modal" role="dialog" aria-label={order ? `Pedido ${order.externalId}` : "Pedido"}>
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="type-tagline text-[var(--ink)]">
                {isLoading ? "…" : order?.name || "Pedido"}
              </h2>
              {order ? (
                <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                  #{order.externalId} · {order.channel === "tray" ? "Tray" : "Loja Atrako"} ·{" "}
                  {when(order.createdAt)}
                </p>
              ) : null}
              {order?.statusLabel || order?.fulfillmentStatus ? (
                <span className="rel-badge type-micro-legal mt-2">
                  {order.statusLabel || order.fulfillmentStatus}
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
          {order ? (
            <div className="mt-4 flex flex-col gap-2">
              {order.phone ? (
                <a
                  href={`tel:${order.phone}`}
                  className="inline-flex items-center gap-2 type-caption tabular-nums text-[var(--ink-muted-80)]"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  {formatPhone(order.phone)}
                </a>
              ) : null}
              {order.email ? (
                <a
                  href={`mailto:${order.email}`}
                  className="inline-flex min-w-0 items-center gap-2 type-caption text-[var(--ink-muted-80)]"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  <span className="truncate">{order.email}</span>
                </a>
              ) : null}
              {order.cpf ? (
                <p className="type-caption tabular-nums text-[var(--ink-muted-80)]">CPF {order.cpf}</p>
              ) : null}
              {addr ? (
                <span className="inline-flex items-start gap-2 type-caption text-[var(--ink-muted-80)]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  {addr}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="panel-modal-body">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          ) : isError || !order ? (
            <p className="py-10 text-center type-caption text-[var(--ink-muted-48)]">
              Não foi possível abrir o pedido
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              <ul className="flex flex-col gap-3">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="type-caption text-[var(--ink)]">{item.name}</p>
                      <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                        {item.quantity}× {brl(item.priceCents)}
                        {item.sku ? ` · SKU ${item.sku}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 type-caption tabular-nums text-[var(--ink)]">
                      {brl(item.priceCents * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2 border-t border-[var(--divider-soft)] pt-4">
                <div className="flex justify-between gap-4">
                  <p className="type-caption text-[var(--ink-muted-48)]">Subtotal</p>
                  <p className="type-caption tabular-nums">{brl(order.subtotalCents)}</p>
                </div>
                {order.discountCents > 0 ? (
                  <div className="flex justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Desconto</p>
                    <p className="type-caption tabular-nums">−{brl(order.discountCents)}</p>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <p className="type-caption text-[var(--ink-muted-48)]">Frete</p>
                  <p className="type-caption tabular-nums">
                    {order.shippingFeeCents === 0 ? "Grátis" : brl(order.shippingFeeCents)}
                  </p>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-4">
                  <p className="type-caption text-[var(--ink-muted-48)]">Total</p>
                  <p className="type-body-strong tabular-nums">{brl(order.totalCents)}</p>
                </div>
                {pay ? (
                  <p className="type-fine-print text-[var(--ink-muted-80)]">
                    {pay}
                    {order.mpPaymentId ? ` · MP ${order.mpPaymentId}` : ""}
                    {order.approvedAt ? ` · pago em ${when(order.approvedAt)}` : ""}
                  </p>
                ) : null}
                {utm ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">UTM {utm}</p>
                ) : null}
              </div>

              <div className="border-t border-[var(--divider-soft)] pt-4">
                <p className="type-caption-strong text-[var(--ink)]">Histórico</p>
                <ol className="mt-3 space-y-2">
                  <li className="type-fine-print text-[var(--ink-muted-80)]">
                    Pedido realizado · {when(order.createdAt)}
                  </li>
                  {order.approvedAt || order.status === "APPROVED" ? (
                    <li className="type-fine-print text-[var(--ink-muted-80)]">
                      Pagamento confirmado · {when(order.approvedAt || order.createdAt)}
                    </li>
                  ) : (
                    <li className="type-fine-print text-[var(--ink-muted-48)]">
                      Pagamento · {order.status || "pendente"}
                    </li>
                  )}
                  {order.fulfillmentStatus ? (
                    <li className="type-fine-print text-[var(--ink-muted-80)]">
                      Envio · {order.fulfillmentStatus}
                    </li>
                  ) : null}
                </ol>
              </div>

              {channel === "commerce" && order.fulfillmentStatus ? (
                <div className="border-t border-[var(--divider-soft)] pt-4">
                  <p className="mb-2 type-caption text-[var(--ink-muted-48)]">Atualizar fulfillment</p>
                  <PillSelect
                    size="toolbar"
                    value=""
                    onChange={(v) => {
                      if (v) onFulfillmentChange?.(v);
                    }}
                    options={[
                      { value: "", label: order.fulfillmentStatus },
                      ...(NEXT_OPTIONS[order.fulfillmentStatus] ?? []),
                    ]}
                    aria-label="Status do envio"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
