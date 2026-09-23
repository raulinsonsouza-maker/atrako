"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfigBack, useConfigWorkspace } from "../_components";

function SimplePrefsPage({
  title,
  field,
  keys,
}: {
  title: string;
  field: "tracking" | "financePrefs" | "formsPrefs" | "notifyPrefs";
  keys: Array<{ key: string; label: string }>;
}) {
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
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    const src = (config?.settings?.[field] ?? {}) as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const k of keys) next[k.key] = typeof src[k.key] === "string" ? (src[k.key] as string) : "";
    setVals(next);
  }, [config, field, keys]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    await fetch("/api/atrako/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, [field]: vals }),
    });
    qc.invalidateQueries({ queryKey: ["workspace-config", workspaceId] });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <ConfigBack title={title} />
      <form onSubmit={save} className="space-y-3 rounded-xl border border-[var(--hairline)] bg-white p-4">
        {keys.map((k) => (
          <label key={k.key} className="block type-fine-print text-[var(--ink-muted-48)]">
            {k.label}
            <input
              className="mt-1 w-full rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm"
              value={vals[k.key] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [k.key]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-[22px] py-[11px] type-body text-[var(--on-primary)] active:scale-95">
          Salvar
        </button>
      </form>
    </div>
  );
}

export default function ConfigRastreamentoPage() {
  return (
    <SimplePrefsPage
      title="Rastreamento"
      field="tracking"
      keys={[
        { key: "pixelId", label: "ID do Meta Pixel" },
        { key: "capiToken", label: "Token da API de conversões (CAPI)" },
      ]}
    />
  );
}
