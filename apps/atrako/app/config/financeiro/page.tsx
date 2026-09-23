"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfigBack, useConfigWorkspace } from "../_components";

export default function ConfigFinanceiroPrefsPage() {
  const qc = useQueryClient();
  const { workspaceId } = useConfigWorkspace();
  const { data: config } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    enabled: Boolean(workspaceId),
  });
  const [defaultCategory, setDefaultCategory] = useState("");

  useEffect(() => {
    const fp = (config?.settings?.financePrefs ?? {}) as Record<string, unknown>;
    setDefaultCategory(typeof fp.defaultCategory === "string" ? fp.defaultCategory : "");
  }, [config]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    await fetch("/api/atrako/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, financePrefs: { defaultCategory } }),
    });
    qc.invalidateQueries({ queryKey: ["workspace-config", workspaceId] });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <ConfigBack title="Financeiro" />
      <form onSubmit={save} className="space-y-3 rounded-xl border border-[var(--hairline)] bg-white p-4">
        <label className="block type-fine-print text-[var(--ink-muted-48)]">
          Categoria padrão
          <input
            className="mt-1 w-full rounded-lg border border-[var(--hairline)] px-3 py-2 type-caption"
            value={defaultCategory}
            onChange={(e) => setDefaultCategory(e.target.value)}
          />
        </label>
        <button type="submit" className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-[22px] py-[11px] type-body text-[var(--on-primary)] active:scale-95">
          Salvar
        </button>
      </form>
    </div>
  );
}
