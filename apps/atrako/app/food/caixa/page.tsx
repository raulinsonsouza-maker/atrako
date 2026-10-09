"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const LABEL: Record<string, string> = {
  APPROVED: "Aprovado",
  PAY_ON_DELIVERY: "Pendente na entrega",
  REFUNDED: "Estorno",
};

export default function FoodCashPage() {
  const { workspaceId } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["food-summary", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food/summary?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o caixa");
      return res.json() as Promise<{
        caixa: {
          approvedCents: number;
          pendingDeliveryCents: number;
          refundedCents: number;
          rows: Array<{ id: string; number: number; customerName: string; paymentStatus: string; totalCents: number }>;
        };
      }>;
    },
  });
  const caixa = data?.caixa;

  return (
    <section>
      <h1 className="food-brand">Caixa</h1>
      {caixa ? (
        <>
          <div className="food-stats">
            <article className="food-stat"><span>Aprovado</span><strong>{brl(caixa.approvedCents)}</strong></article>
            <article className="food-stat"><span>Pendente na entrega</span><strong>{brl(caixa.pendingDeliveryCents)}</strong></article>
            <article className="food-stat"><span>Estorno</span><strong>{brl(caixa.refundedCents)}</strong></article>
          </div>
          <div className="food-list">
            {caixa.rows.map((row) => (
              <article key={row.id} className="food-row">
                <span>#{row.number} {row.customerName}<br /><span className="food-muted">{LABEL[row.paymentStatus] ?? row.paymentStatus}</span></span>
                <strong>{brl(row.totalCents)}</strong>
              </article>
            ))}
          </div>
        </>
      ) : <p className="food-muted">Carregando…</p>}
    </section>
  );
}
