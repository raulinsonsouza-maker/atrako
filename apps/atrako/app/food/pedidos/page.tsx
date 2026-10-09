"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type FoodItemLine = {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  removals: string[] | null;
  additions: Array<{ name: string; priceCents: number; quantity: number }> | null;
  notes: string | null;
};

type FoodOrder = {
  id: string;
  number: number;
  channel: string;
  customerName: string;
  phone: string;
  fulfillment: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  totalCents: number;
  changeForCents: number | null;
  address: { street?: string; number?: string; complement?: string; neighborhood?: string } | null;
  createdAt: string;
  items: FoodItemLine[];
};

const COLUMNS = [
  { status: "NEW", label: "Novo" },
  { status: "CONFIRMED", label: "Confirmado" },
  { status: "PREPARING", label: "Preparando" },
  { status: "READY", label: "Pronto" },
  { status: "COMPLETED", label: "Finalizado" },
];

const CHANNEL: Record<string, string> = { STORE: "Loja", WHATSAPP: "WhatsApp", COUNTER: "Balcão" };
const METHOD: Record<string, string> = { PIX: "Pix", CASH: "Dinheiro", CARD_ON_DELIVERY: "Cartão" };
const PAYMENT: Record<string, string> = {
  PENDING: "Pix pendente",
  APPROVED: "Pago",
  REJECTED: "Recusado",
  REFUNDED: "Estornado",
  PAY_ON_DELIVERY: "Na entrega",
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nextStep(order: FoodOrder) {
  const pickup = order.fulfillment === "PICKUP";
  const map: Record<string, string> = pickup
    ? { NEW: "CONFIRMED", CONFIRMED: "PREPARING", PREPARING: "READY", READY: "COMPLETED" }
    : { NEW: "CONFIRMED", CONFIRMED: "PREPARING", PREPARING: "READY", READY: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "COMPLETED" };
  return map[order.fulfillmentStatus] ?? null;
}

function columnOf(order: FoodOrder) {
  if (order.fulfillmentStatus === "OUT_FOR_DELIVERY") return "READY";
  return order.fulfillmentStatus;
}

export default function FoodOrdersPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  const [alertIds, setAlertIds] = useState<string[]>([]);
  const [history, setHistory] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [draft, setDraft] = useState({ customerName: "", phone: "", itemId: "", quantity: "1", paymentMethod: "CASH" });

  const { data } = useQuery({
    queryKey: ["food-orders", workspaceId],
    enabled: Boolean(workspaceId),
    refetchInterval: 8000,
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food/orders?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      return res.json() as Promise<{ orders: FoodOrder[] }>;
    },
  });
  const menu = useQuery({
    queryKey: ["food-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o cardápio");
      return res.json() as Promise<{ store: { items: Array<{ id: string; name: string; available: boolean; imageUrl: string | null }> } | null }>;
    },
  });

  const orders = data?.orders ?? [];
  useEffect(() => {
    const fresh = orders.filter((order) => order.fulfillmentStatus === "NEW" && !seen.current.has(order.id));
    if (seen.current.size && fresh.length) {
      setAlertIds(fresh.map((order) => order.id));
      try {
        const audio = new AudioContext();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start();
        osc.stop(audio.currentTime + 0.18);
      } catch {
        // o aviso visual segue mesmo sem som
      }
    }
    for (const order of orders) seen.current.add(order.id);
  }, [orders]);

  const action = useMutation({
    mutationFn: async (body: { id: string; fulfillmentStatus?: string; receivePayment?: boolean }) => {
      const res = await fetch(`/api/atrako/food/orders/${body.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, fulfillmentStatus: body.fulfillmentStatus, receivePayment: body.receivePayment }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Não foi possível atualizar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["food-orders", workspaceId] }),
  });

  const counter = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/atrako/food/orders/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          customerName: draft.customerName,
          phone: draft.phone,
          paymentMethod: draft.paymentMethod,
          fulfillment: "PICKUP",
          items: [{ itemId: draft.itemId, quantity: Number(draft.quantity) || 1 }],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Não foi possível lançar");
    },
    onSuccess: () => {
      setWalkIn(false);
      queryClient.invalidateQueries({ queryKey: ["food-orders", workspaceId] });
    },
  });

  const active = orders.filter((order) => order.fulfillmentStatus !== "CANCELLED");
  const cancelled = orders.filter((order) => order.fulfillmentStatus === "CANCELLED");

  return (
    <section>
      <div className="food-banner">
        <div>
          <strong>Pedidos</strong>
          <p>{alertIds.length ? `${alertIds.length} pedido novo` : "A fila da loja, do WhatsApp e do balcão."}</p>
        </div>
        <button type="button" className="food-button" onClick={() => setWalkIn((value) => !value)}>Pedido no balcão</button>
      </div>
      {walkIn ? (
        <form
          className="food-form"
          onSubmit={(event) => {
            event.preventDefault();
            counter.mutate();
          }}
        >
          <input placeholder="Nome" value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} required />
          <input placeholder="Celular" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required />
          <div className="food-picks">
            {(menu.data?.store?.items ?? []).filter((item) => item.available).map((item) => (
              <button key={item.id} type="button" className={draft.itemId === item.id ? "food-pick is-on" : "food-pick"} onClick={() => setDraft({ ...draft, itemId: item.id })}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <i />}
                {item.name}
              </button>
            ))}
          </div>
          <input value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} />
          <div className="food-row">
            {[["CASH", "Dinheiro"], ["CARD_ON_DELIVERY", "Cartão"], ["PIX", "Pix"]].map(([value, label]) => (
              <button key={value} type="button" className={draft.paymentMethod === value ? "food-button" : "food-button ghost"} onClick={() => setDraft({ ...draft, paymentMethod: value })}>
                {label}
              </button>
            ))}
          </div>
          {counter.error ? <p>{counter.error.message}</p> : null}
          <button className="food-button" type="submit" disabled={counter.isPending || !draft.itemId}>Lançar na fila</button>
        </form>
      ) : null}
      <div className="food-columns">
        {COLUMNS.map((column) => (
          <section key={column.status} className="food-column">
            <h2>{column.label}</h2>
            {active.filter((order) => columnOf(order) === column.status).map((order) => (
              <article key={order.id} className={alertIds.includes(order.id) ? "food-card is-new" : "food-card"}>
                <strong>#{order.number} {order.customerName}</strong>
                <p>
                  <span className="food-chip">{CHANNEL[order.channel] ?? order.channel}</span>
                  <span className="food-chip">{METHOD[order.paymentMethod] ?? order.paymentMethod}</span>
                  <span className="food-chip">{PAYMENT[order.paymentStatus] ?? order.paymentStatus}</span>
                  {order.fulfillmentStatus === "OUT_FOR_DELIVERY" ? <span className="food-chip">Saiu para entrega</span> : null}
                </p>
                <p>{brl(order.totalCents)} · {order.fulfillment === "PICKUP" ? "Retirada" : "Entrega"}</p>
                {order.fulfillment === "DELIVERY" && order.address ? (
                  <p>{[order.address.street, order.address.number, order.address.complement].filter(Boolean).join(", ")}{order.address.neighborhood ? ` · ${order.address.neighborhood}` : ""}</p>
                ) : null}
                {order.paymentMethod === "CASH" && order.changeForCents ? <p>Troco para {brl(order.changeForCents)}</p> : null}
                {order.items.map((item) => (
                  <p key={item.id}>
                    {item.quantity}× {item.name}
                    {item.additions?.length ? ` + ${item.additions.map((addition) => addition.name).join(", ")}` : ""}
                    {item.removals?.length ? ` · sem ${item.removals.join(", ")}` : ""}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                ))}
                <div className="food-card__actions">
                {order.paymentStatus === "PAY_ON_DELIVERY" ? (
                  <button type="button" className="food-button ghost" onClick={() => action.mutate({ id: order.id, receivePayment: true })}>Recebido</button>
                ) : null}
                {nextStep(order) ? (
                  <button type="button" className="food-button" onClick={() => action.mutate({ id: order.id, fulfillmentStatus: nextStep(order)! })}>Avançar</button>
                ) : null}
                {order.fulfillmentStatus !== "COMPLETED" && order.fulfillmentStatus !== "CANCELLED" ? (
                  <button type="button" className="food-button ghost" onClick={() => action.mutate({ id: order.id, fulfillmentStatus: "CANCELLED" })}>Cancelar</button>
                ) : null}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
      <div className="food-panel" style={{ marginTop: 16 }}>
        <button type="button" className="food-button ghost" onClick={() => setHistory((value) => !value)}>
          {history ? "Ocultar cancelados" : "Histórico com cancelados"}
        </button>
        {history ? cancelled.map((order) => (
          <p key={order.id}>#{order.number} {order.customerName} · cancelado · {CHANNEL[order.channel] ?? order.channel}</p>
        )) : null}
      </div>
      {action.error ? <p>{action.error.message}</p> : null}
    </section>
  );
}
