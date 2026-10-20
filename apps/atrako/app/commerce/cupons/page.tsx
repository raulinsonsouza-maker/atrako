"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  usedCount: number;
  active: boolean;
};

export default function CommerceCouponsPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENT");
  const [value, setValue] = useState("10");

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-data", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ coupons: Coupon[] }>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/atrako/commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "coupon",
          code,
          type,
          value: type === "PERCENT" ? Number(value) : Math.round(Number(value.replace(",", ".")) * 100),
        }),
      });
      if (!r.ok) throw new Error("Falha");
    },
    onSuccess: () => {
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["commerce-data", workspaceId] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="type-tagline text-[var(--ink)]">Cupons</h1>
        <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
          Válidos na vitrine e no checkout digital.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) create.mutate();
        }}
      >
        <input
          className="h-11 w-36 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CODIGO"
        />
        <div className="w-36">
          <PillSelect
            size="field"
            value={type}
            onChange={setType}
            options={[
              { value: "PERCENT", label: "Percentual" },
              { value: "FIXED", label: "Valor fixo" },
            ]}
          />
        </div>
        <input
          className="h-11 w-24 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "PERCENT" ? "10" : "20,00"}
        />
        <button type="submit" className={cn(buttonVariants({ variant: "primary" }), "h-11 !gap-1.5")}>
          <Plus className="h-4 w-4" />
          Criar
        </button>
      </form>

      {isLoading ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
          {(data?.coupons ?? []).map((c) => (
            <li key={c.id} className="flex justify-between px-4 py-3">
              <div>
                <p className="type-body-strong">{c.code}</p>
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  {c.type === "PERCENT" ? `${c.value}%` : `R$ ${(c.value / 100).toFixed(2)}`} · usado{" "}
                  {c.usedCount}×
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
