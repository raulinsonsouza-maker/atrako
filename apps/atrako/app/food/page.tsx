"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Summary = {
  today: {
    revenueCents: number;
    count: number;
    averageCents: number;
    inProgress: number;
    storeCents: number;
    whatsappCents: number;
    counterCents: number;
    dishes: Array<{ name: string; quantity: number; cents: number }>;
  };
};

export default function FoodHomePage() {
  const { workspaceId } = useActiveWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["food-summary", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food/summary?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o início");
      return res.json() as Promise<Summary>;
    },
  });
  const today = data?.today;

  return (
    <section>
      <h1 className="food-brand">Início</h1>
      {isLoading ? <p className="food-muted">Carregando…</p> : null}
      {today ? (
        <>
          <div className="food-stats">
            <article className="food-stat"><span>Faturamento hoje</span><strong>{brl(today.revenueCents)}</strong></article>
            <article className="food-stat"><span>Pedidos pagos</span><strong>{today.count}</strong></article>
            <article className="food-stat"><span>Ticket médio</span><strong>{brl(today.averageCents)}</strong></article>
            <article className="food-stat"><span>Em andamento</span><strong>{today.inProgress}</strong></article>
          </div>
          <div className="food-stats">
            <article className="food-stat"><span>Loja</span><strong>{brl(today.storeCents)}</strong></article>
            <article className="food-stat"><span>WhatsApp</span><strong>{brl(today.whatsappCents)}</strong></article>
            <article className="food-stat"><span>Balcão</span><strong>{brl(today.counterCents)}</strong></article>
          </div>
          <div className="food-panel">
            <h2>Pratos que mais saíram hoje</h2>
            {today.dishes.length === 0 ? <p className="food-muted">Ainda não há venda paga hoje.</p> : null}
            <ul className="food-list">
              {today.dishes.map((dish) => (
                <li key={dish.name} className="food-row">
                  <span>{dish.quantity}× {dish.name}</span>
                  <strong>{brl(dish.cents)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
