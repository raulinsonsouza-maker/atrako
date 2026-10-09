"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, MapPin, Phone, X } from "lucide-react";
import { ProductPhoto } from "@/components/clientes/ProductPhoto";
import { formatPhone } from "@/components/crm/CrmLeadCard";

type PedidoDetail = {
  id: string;
  externalId: string;
  providerLabel: string;
  statusLabel: string | null;
  occurredAt: string;
  totalCents: number;
  currency: string;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  place: string | null;
  paymentMethod: string | null;
  installments: number | null;
  coupons: Array<{ code: string; discountCents: number | null }>;
  discountCents: number;
  shipping: {
    method: string | null;
    cents: number | null;
    days: number | null;
    estimatedDate: string | null;
  };
  sellerShippingCents: number | null;
  saleFeeCents: number | null;
  netCents: number | null;
  items: Array<{
    title: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    imageUrl: string | null;
  }>;
};

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function plainText(value: string) {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function PedidoSheet({
  clienteId,
  orderId,
  onClose,
}: {
  clienteId: string;
  orderId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cliente-pedido", clienteId, orderId],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/pedidos/${orderId}`);
      if (!res.ok) throw new Error("Falha ao carregar pedido");
      return (await res.json()) as PedidoDetail;
    },
  });

  const when = data
    ? new Date(data.occurredAt).toLocaleString("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      })
    : "";
  const pagamento = data?.paymentMethod
    ? `Pago com ${data.paymentMethod}${data.installments ? ` em ${data.installments}x` : ""}`
    : null;
  const itemsCents = data?.items.reduce((sum, item) => sum + item.lineTotalCents, 0) ?? 0;
  const freightCents = data?.shipping.cents ?? null;

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="panel-modal" role="dialog" aria-label={data ? `Pedido ${data.externalId}` : "Pedido"}>
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="type-tagline text-[var(--ink)]">{isLoading ? "…" : data?.buyerName || "Pedido"}</h2>
              {data ? (
                <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                  #{data.externalId} · {data.providerLabel} · {when}
                </p>
              ) : null}
              {data?.statusLabel ? <span className="rel-badge type-micro-legal mt-2">{data.statusLabel}</span> : null}
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
          {data ? (
            <div className="mt-4 flex flex-col gap-2">
              {data.buyerPhone ? (
                <a href={`tel:${data.buyerPhone}`} className="inline-flex items-center gap-2 type-caption tabular-nums text-[var(--ink-muted-80)]">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  {formatPhone(data.buyerPhone)}
                </a>
              ) : null}
              {data.buyerEmail ? (
                <a href={`mailto:${data.buyerEmail}`} className="inline-flex min-w-0 items-center gap-2 type-caption text-[var(--ink-muted-80)]">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  <span className="truncate">{data.buyerEmail}</span>
                </a>
              ) : null}
              {data.place ? (
                <span className="inline-flex items-center gap-2 type-caption text-[var(--ink-muted-80)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  {data.place}
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
          ) : isError || !data ? (
            <p className="py-10 text-center type-caption text-[var(--ink-muted-48)]">Não foi possível abrir o pedido</p>
          ) : (
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-4">
                {data.items.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="flex items-start gap-4">
                    <ProductPhoto src={item.imageUrl} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="type-caption text-[var(--ink)]">{plainText(item.title)}</p>
                      <p className="mt-1 type-fine-print tabular-nums text-[var(--ink-muted-48)]">
                        {Math.max(1, item.quantity)}× {item.unitPriceCents > 0 ? money(item.unitPriceCents, data.currency) : ""}
                      </p>
                    </div>
                    {item.lineTotalCents > 0 ? (
                      <p className="shrink-0 pt-0.5 type-caption tabular-nums text-[var(--ink)]">
                        {money(item.lineTotalCents, data.currency)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2.5 border-t border-[var(--divider-soft)] pt-4">
                {itemsCents > 0 && itemsCents !== data.totalCents ? (
                  <div className="flex items-start justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Itens</p>
                    <p className="type-caption tabular-nums text-[var(--ink)]">{money(itemsCents, data.currency)}</p>
                  </div>
                ) : null}
                {freightCents != null ? (
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 type-caption text-[var(--ink-muted-48)]">
                      {data.shipping.method ? `Frete · ${data.shipping.method}` : "Frete"}
                    </p>
                    <p className="shrink-0 type-caption tabular-nums text-[var(--ink)]">
                      {freightCents === 0 ? "Grátis" : money(freightCents, data.currency)}
                    </p>
                  </div>
                ) : data.shipping.method ? (
                  <p className="type-caption text-[var(--ink-muted-48)]">Frete · {data.shipping.method}</p>
                ) : null}
                {data.shipping.days ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    Prazo de {data.shipping.days} {data.shipping.days === 1 ? "dia útil" : "dias úteis"}
                  </p>
                ) : null}
                {data.coupons.map((coupon) => (
                  <div key={coupon.code} className="flex items-start justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Cupom {coupon.code}</p>
                    <p className="type-caption tabular-nums text-[var(--ink)]">
                      {coupon.discountCents ? `−${money(coupon.discountCents, data.currency)}` : ""}
                    </p>
                  </div>
                ))}
                {!data.coupons.length && data.discountCents > 0 ? (
                  <div className="flex items-start justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Desconto</p>
                    <p className="type-caption tabular-nums text-[var(--ink)]">−{money(data.discountCents, data.currency)}</p>
                  </div>
                ) : null}
                {data.saleFeeCents ? (
                  <div className="flex items-start justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Taxas</p>
                    <p className="type-caption tabular-nums text-[var(--ink)]">{money(data.saleFeeCents, data.currency)}</p>
                  </div>
                ) : null}
                {data.sellerShippingCents ? (
                  <div className="flex items-start justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Frete do vendedor</p>
                    <p className="type-caption tabular-nums text-[var(--ink)]">{money(data.sellerShippingCents, data.currency)}</p>
                  </div>
                ) : null}
                <div className="mt-1 flex items-baseline justify-between gap-4">
                  <p className="type-caption text-[var(--ink-muted-48)]">Total</p>
                  <p className="type-body-strong tabular-nums text-[var(--ink)]">{money(data.totalCents, data.currency)}</p>
                </div>
                {data.netCents != null && data.saleFeeCents ? (
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="type-caption text-[var(--ink-muted-48)]">Líquido</p>
                    <p className="type-caption-strong tabular-nums text-[var(--ink)]">{money(data.netCents, data.currency)}</p>
                  </div>
                ) : null}
              </div>
              {pagamento ? <p className="type-fine-print text-[var(--ink-muted-80)]">{pagamento}</p> : null}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
