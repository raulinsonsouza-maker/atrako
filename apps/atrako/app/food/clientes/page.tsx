"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FoodCustomersPage() {
  const { workspaceId } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["food-summary", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food/summary?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar clientes");
      return res.json() as Promise<{
        customers: Array<{ name: string; phone: string; orders: number; cents: number; averageCents: number; lastAt: string; idle: boolean }>;
      }>;
    },
  });

  return (
    <section>
      <h1 className="food-brand">Clientes</h1>
      <div className="food-list">
        {(data?.customers ?? []).map((customer) => (
          <article key={customer.phone} className="food-row">
            <span>
              {customer.name}<br />
              <span className="food-muted">
                {customer.orders} pedidos · ticket {brl(customer.averageCents)}
                {customer.idle ? " · parado" : ""}
              </span>
            </span>
            <strong>{brl(customer.cents)}</strong>
          </article>
        ))}
      </div>
      {data && data.customers.length === 0 ? <p className="food-muted">Nenhuma compra paga ainda.</p> : null}
    </section>
  );
}
