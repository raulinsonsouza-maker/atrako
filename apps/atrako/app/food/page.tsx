"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type FoodItem = {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  removals: string[] | null;
  notes: string | null;
};

type FoodOrder = {
  id: string;
  number: number;
  customerName: string;
  phone: string;
  fulfillment: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  couponCode: string | null;
  address: { street?: string; number?: string; complement?: string; neighborhood?: string; cep?: string } | null;
  changeForCents: number | null;
  createdAt: string;
  items: FoodItem[];
};

const STATUS_LABEL: Record<string, string> = {
  NEW: "Novo",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Pix pendente",
  APPROVED: "Pago",
  REJECTED: "Recusado",
  REFUNDED: "Estornado",
  PAY_ON_DELIVERY: "Pagar na entrega",
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nextSteps(order: FoodOrder) {
  const pickup = order.fulfillment === "PICKUP";
  const map: Record<string, string[]> = pickup
    ? { NEW: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PREPARING", "CANCELLED"], PREPARING: ["READY", "CANCELLED"], READY: ["COMPLETED", "CANCELLED"] }
    : {
        NEW: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["PREPARING", "CANCELLED"],
        PREPARING: ["READY", "CANCELLED"],
        READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
        OUT_FOR_DELIVERY: ["COMPLETED", "CANCELLED"],
      };
  return map[order.fulfillmentStatus] ?? [];
}

export default function FoodQueuePage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["food-orders", workspaceId],
    enabled: Boolean(workspaceId),
    refetchInterval: 8000,
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food/orders?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      return res.json() as Promise<{ orders: FoodOrder[] }>;
    },
  });

  const action = useMutation({
    mutationFn: async (body: { id: string; fulfillmentStatus?: string; receivePayment?: boolean }) => {
      const res = await fetch(`/api/atrako/food/orders/${body.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, fulfillmentStatus: body.fulfillmentStatus, receivePayment: body.receivePayment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Não foi possível atualizar");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["food-orders", workspaceId] }),
  });

  const orders = data?.orders ?? [];
  const open = orders.find((order) => order.id === openId) ?? null;

  return (
    <AppPage
      title="Pedidos"
      actions={
        <Link href="/food/cardapio" className="type-body text-[var(--primary)]">
          Cardápio
        </Link>
      }
    >
      {isLoading ? <p className="type-body text-[var(--ink-muted-80)]">Carregando pedidos…</p> : null}
      {!isLoading && orders.length === 0 ? (
        <p className="type-body text-[var(--ink-muted-80)]">Nenhum pedido ainda.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setOpenId(order.id === openId ? null : order.id)}
              className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-3 text-left"
            >
              <span>
                <strong className="type-body-strong">#{order.number}</strong>
                <span className="type-body"> {order.customerName}</span>
                <span className="mt-1 block type-caption text-[var(--ink-muted-80)]">
                  {STATUS_LABEL[order.fulfillmentStatus] ?? order.fulfillmentStatus} · {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
                </span>
              </span>
              <span className="type-body-strong">{brl(order.totalCents)}</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <section className="mt-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
          <h2 className="type-body-strong">Pedido #{open.number}</h2>
          <p className="type-caption text-[var(--ink-muted-80)]">
            {open.customerName} · {open.phone} · {open.fulfillment === "PICKUP" ? "Retirada" : "Entrega"}
          </p>
          {open.address ? (
            <p className="type-body">
              {open.address.street}, {open.address.number}
              {open.address.complement ? ` · ${open.address.complement}` : ""} · {open.address.neighborhood} · {open.address.cep}
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {open.items.map((item) => (
              <li key={item.id} className="type-body">
                {item.quantity}× {item.name} · {brl(item.priceCents * item.quantity)}
                {item.removals?.length ? <span className="block type-caption">Sem: {item.removals.join(", ")}</span> : null}
                {item.notes ? <span className="block type-caption">{item.notes}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 type-body">
            Subtotal {brl(open.subtotalCents)}
            {open.discountCents ? ` · desconto ${brl(open.discountCents)}` : ""}
            {open.couponCode ? ` (${open.couponCode})` : ""} · entrega {brl(open.deliveryFeeCents)} · total {brl(open.totalCents)}
          </p>
          <p className="type-caption text-[var(--ink-muted-80)]">
            {PAYMENT_LABEL[open.paymentStatus]} · {open.paymentMethod === "CASH" ? "Dinheiro" : open.paymentMethod === "CARD_ON_DELIVERY" ? "Cartão na entrega" : "Pix"}
            {open.changeForCents ? ` · troco para ${brl(open.changeForCents)}` : ""}
          </p>
          {action.error ? <p className="mt-2 type-caption text-[var(--ink)]">{action.error.message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {open.paymentStatus === "PAY_ON_DELIVERY" ? (
              <Button type="button" onClick={() => action.mutate({ id: open.id, receivePayment: true })} disabled={action.isPending}>
                Marcar pagamento recebido
              </Button>
            ) : null}
            {nextSteps(open).map((step) => (
              <Button
                key={step}
                type="button"
                variant={step === "CANCELLED" ? "outline" : "primary"}
                onClick={() => action.mutate({ id: open.id, fulfillmentStatus: step })}
                disabled={action.isPending}
              >
                {STATUS_LABEL[step]}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </AppPage>
  );
}
