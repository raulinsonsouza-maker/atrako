"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PillSelect } from "@/components/ui/pill-select";
import { CommerceOrderSheet } from "@/components/commerce/CommerceOrderSheet";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type OrderRow = {
  channel: "commerce" | "tray";
  id: string;
  externalId: string;
  email: string | null;
  name: string | null;
  status: string | null;
  fulfillment: string;
  fulfillmentStatus: string | null;
  totalCents: number;
  createdAt: string;
  items: { name: string; quantity: number; sku?: string | null }[];
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
  const [open, setOpen] = useState<{ id: string; channel: "commerce" | "tray" } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-store-orders", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store-orders?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ orders: OrderRow[]; trayConnected?: boolean }>;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce-store-orders", workspaceId] });
      if (open) {
        queryClient.invalidateQueries({
          queryKey: ["commerce-order-detail", workspaceId, open.id, open.channel],
        });
      }
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="type-tagline text-[var(--ink)]">Pedidos</h1>
        <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
          Checkout da loja
          {data?.trayConnected ? " e pedidos Tray" : ""} — clique para ver o detalhe.
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
              { value: "", label: o.fulfillmentStatus || o.status || "—" },
              ...(o.channel === "commerce" && o.fulfillmentStatus
                ? NEXT_OPTIONS[o.fulfillmentStatus] ?? []
                : []),
            ];
            return (
              <li
                key={`${o.channel}-${o.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left active:scale-[0.99]"
                  onClick={() => setOpen({ id: o.id, channel: o.channel })}
                >
                  <p className="type-body-strong">
                    {o.name || o.email || "Cliente"} · {brl(o.totalCents)}
                  </p>
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    #{o.externalId} · {o.channel === "tray" ? "Tray" : "Atrako"} ·{" "}
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </button>
                {o.channel === "commerce" ? (
                  <div className="w-44" onClick={(e) => e.stopPropagation()}>
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
                ) : (
                  <span className="rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 py-1 type-fine-print text-[var(--ink-muted-48)]">
                    Tray
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && workspaceId ? (
        <CommerceOrderSheet
          workspaceId={workspaceId}
          orderId={open.id}
          channel={open.channel}
          onClose={() => setOpen(null)}
          onFulfillmentChange={(status) => {
            if (open.channel === "commerce") {
              patch.mutate({ orderId: open.id, fulfillmentStatus: status });
            }
          }}
        />
      ) : null}
    </div>
  );
}
