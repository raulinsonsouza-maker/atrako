"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";
import type { ShippingRules, ShippingZone } from "@/lib/commerce/shipping";

function emptyZone(): ShippingZone {
  return {
    id: `zone-${Date.now().toString(36)}`,
    name: "",
    cepFrom: "",
    cepTo: "",
    feeCents: 1500,
    daysMin: 3,
    daysMax: 7,
    active: true,
  };
}

export default function CommerceShippingPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<ShippingRules | null>(null);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [shipEnabled, setShipEnabled] = useState(true);
  const [freeMin, setFreeMin] = useState("");
  const [defaultFee, setDefaultFee] = useState("15,00");

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        store: {
          shippingRules: ShippingRules;
          pickupEnabled: boolean;
          shipEnabled: boolean;
        } | null;
      }>;
    },
  });

  useEffect(() => {
    if (!data?.store) return;
    setRules(data.store.shippingRules);
    setPickupEnabled(data.store.pickupEnabled);
    setShipEnabled(data.store.shipEnabled);
    setFreeMin(
      data.store.shippingRules.freeShippingMinCents != null
        ? (data.store.shippingRules.freeShippingMinCents / 100).toFixed(2).replace(".", ",")
        : "",
    );
    setDefaultFee(
      data.store.shippingRules.defaultFeeCents != null
        ? (data.store.shippingRules.defaultFeeCents / 100).toFixed(2).replace(".", ",")
        : "",
    );
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!rules) return;
      const freeShippingMinCents = freeMin.trim()
        ? Math.round(Number(freeMin.replace(",", ".")) * 100)
        : null;
      const defaultFeeCents = defaultFee.trim()
        ? Math.round(Number(defaultFee.replace(",", ".")) * 100)
        : null;
      const r = await fetch("/api/atrako/commerce/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          pickupEnabled,
          shipEnabled,
          shippingRules: {
            ...rules,
            pickupEnabled,
            shipEnabled,
            freeShippingMinCents,
            defaultFeeCents,
            zones: rules.zones.map((z) => ({
              ...z,
              feeCents: Math.round(Number(z.feeCents) || 0),
            })),
          },
        }),
      });
      if (!r.ok) throw new Error("Falha ao salvar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-store", workspaceId] }),
  });

  if (isLoading || !rules) {
    return <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="type-tagline text-[var(--ink)]">Frete</h1>
        <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
          Tabela fixa por faixa de CEP. Sem cotação dos Correios.
        </p>
      </div>

      <div className="flex flex-wrap gap-6 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
        <label className="flex items-center gap-2">
          <Switch checked={shipEnabled} onChange={setShipEnabled} />
          <span className="type-body">Entrega</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={pickupEnabled} onChange={setPickupEnabled} />
          <span className="type-body">Retirada</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Frete grátis a partir de (R$)</span>
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body"
            value={freeMin}
            onChange={(e) => setFreeMin(e.target.value)}
            placeholder="vazio = desligado"
          />
        </label>
        <label className="space-y-1">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Fallback fora das zonas (R$)</span>
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body"
            value={defaultFee}
            onChange={(e) => setDefaultFee(e.target.value)}
            placeholder="vazio = não entrega"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="type-body-strong">Zonas</h2>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "!gap-1.5")}
            onClick={() => setRules({ ...rules, zones: [...rules.zones, emptyZone()] })}
          >
            <Plus className="h-4 w-4" />
            Zona
          </button>
        </div>

        <ul className="space-y-3">
          {rules.zones.map((zone, index) => (
            <li
              key={zone.id}
              className="grid gap-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-3 sm:grid-cols-6"
            >
              <input
                className="h-10 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-body sm:col-span-2"
                value={zone.name}
                onChange={(e) => {
                  const zones = [...rules.zones];
                  zones[index] = { ...zone, name: e.target.value };
                  setRules({ ...rules, zones });
                }}
                placeholder="Nome (Capital SP)"
              />
              <input
                className="h-10 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-body"
                value={zone.cepFrom}
                onChange={(e) => {
                  const zones = [...rules.zones];
                  zones[index] = { ...zone, cepFrom: e.target.value };
                  setRules({ ...rules, zones });
                }}
                placeholder="CEP de"
              />
              <input
                className="h-10 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-body"
                value={zone.cepTo}
                onChange={(e) => {
                  const zones = [...rules.zones];
                  zones[index] = { ...zone, cepTo: e.target.value };
                  setRules({ ...rules, zones });
                }}
                placeholder="CEP até"
              />
              <input
                className="h-10 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-body"
                value={(zone.feeCents / 100).toFixed(2).replace(".", ",")}
                onChange={(e) => {
                  const zones = [...rules.zones];
                  zones[index] = {
                    ...zone,
                    feeCents: Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0,
                  };
                  setRules({ ...rules, zones });
                }}
                placeholder="R$"
              />
              <div className="flex items-center gap-2">
                <input
                  className="h-10 w-14 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-body"
                  value={zone.daysMin}
                  onChange={(e) => {
                    const zones = [...rules.zones];
                    zones[index] = { ...zone, daysMin: Number(e.target.value) || 0 };
                    setRules({ ...rules, zones });
                  }}
                  title="Dias mín"
                />
                <input
                  className="h-10 w-14 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-body"
                  value={zone.daysMax}
                  onChange={(e) => {
                    const zones = [...rules.zones];
                    zones[index] = { ...zone, daysMax: Number(e.target.value) || 0 };
                    setRules({ ...rules, zones });
                  }}
                  title="Dias máx"
                />
                <button
                  type="button"
                  className="p-2 text-[var(--ink-muted-48)]"
                  onClick={() =>
                    setRules({ ...rules, zones: rules.zones.filter((_, i) => i !== index) })
                  }
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className={cn(buttonVariants({ variant: "primary" }))}
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Salvando…" : "Salvar frete"}
      </button>
      {save.isSuccess ? (
        <p className="type-caption text-[var(--success)]">Salvo.</p>
      ) : null}
    </div>
  );
}
