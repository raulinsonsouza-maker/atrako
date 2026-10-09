"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppPage } from "@/components/layout/AppPage";
import { Switch } from "@/components/ui/switch";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

type Item = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
};

type Store = {
  id: string;
  slug: string;
  name: string;
  acceptingOrders: boolean;
  deliveryFeeCents: number;
  items: Item[];
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FoodMenuPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["food-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o cardápio");
      return res.json() as Promise<{ store: Store | null }>;
    },
  });

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/atrako/food", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...body }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["food-store", workspaceId] }),
  });

  const store = data?.store;

  return (
    <AppPage
      title="Cardápio"
      actions={
        <Link href="/food" className="type-body text-[var(--primary)]">
          Pedidos
        </Link>
      }
    >
      {isLoading ? <p className="type-body">Carregando cardápio…</p> : null}
      {!isLoading && !store ? (
        <p className="type-body">Esta empresa ainda não está na versão Food.</p>
      ) : null}
      {store ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="type-body-strong">{store.name}</p>
              <p className="type-caption text-[var(--ink-muted-80)]">
                /cardapio/{store.slug} · entrega {brl(store.deliveryFeeCents)}
              </p>
            </div>
            <Switch
              checked={store.acceptingOrders}
              aria-label="Receber pedidos"
              onChange={(checked) => save.mutate({ acceptingOrders: checked })}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {store.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-3">
                <div>
                  <p className="type-body-strong">{item.name}</p>
                  <label className="type-caption text-[var(--ink-muted-80)]">
                    Preço em centavos
                    <input
                      className="ml-2 w-24 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-2 py-1 type-body"
                      defaultValue={item.priceCents}
                      inputMode="numeric"
                      aria-label={`Preço de ${item.name}`}
                      onBlur={(event) => {
                        const priceCents = Number(event.target.value);
                        if (Number.isInteger(priceCents) && priceCents !== item.priceCents) {
                          save.mutate({ itemId: item.id, priceCents });
                        }
                      }}
                    />
                  </label>
                </div>
                <Switch
                  checked={item.available}
                  aria-label={`${item.name} disponível`}
                  onChange={(checked) => save.mutate({ itemId: item.id, available: checked })}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </AppPage>
  );
}
