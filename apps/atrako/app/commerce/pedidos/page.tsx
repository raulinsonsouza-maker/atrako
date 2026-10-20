"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PillSelect } from "@/components/ui/pill-select";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type Order = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  fulfillment: string;
  fulfillmentStatus: string;
  totalCents: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

export default function CommerceOrdersPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-store-orders", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store-orders?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ orders: Order[] }>;
    },
  });

  const patch = useMutation({
    mutationFn: async (payload: { orderId: string; fulfillmentStatus: string }) => {
      const r = await fetch("/api/atrako/commerce/store-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...payload }),
      });
      if (!r.ok) throw new Error("Falha");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["commerce-store-orders", workspaceId] }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="type-tagline text-[var(--ink)]">Pedidos</h1>
        <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
          Pedidos da vitrine com frete e fulfillment.
        </p>
      </div>

      {isLoading ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      ) : (data?.orders ?? []).length === 0 ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Nenhum pedido ainda.</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
          {(data?.orders ?? []).map((o) => {
            const options = [
              { value: "", label: o.fulfillmentStatus },
              ...(NEXT_OPTIONS[o.fulfillmentStatus] ?? []),
            ];
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="type-body-strong">
                    {o.name || o.email} · {brl(o.totalCents)}
                  </p>
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} ·{" "}
                    {o.fulfillment} · pagamento {o.status}
                  </p>
                </div>
                <div className="w-44">
                  <PillSelect
                    size="toolbar"
                    value=""
                    onChange={(v) => {
                      if (v) patch.mutate({ orderId: o.id, fulfillmentStatus: v });
                    }}
                    options={options}
                    aria-label="Status"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
