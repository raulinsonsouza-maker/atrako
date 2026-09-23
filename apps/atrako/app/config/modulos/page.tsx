"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ConfigBack, useConfigWorkspace } from "../_components";

const MODULES = [
  ["crm", "CRM"],
  ["agenda", "Agenda"],
  ["commerce", "Vendas"],
  ["social", "Social"],
  ["finance", "Financeiro"],
  ["forms", "Formulários"],
  ["insights", "Insights"],
] as const;

export default function ConfigModulosPage() {
  const qc = useQueryClient();
  const { workspaceId } = useConfigWorkspace();
  const { data: config, isLoading } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    enabled: Boolean(workspaceId),
  });

  async function toggle(key: string, value: boolean) {
    if (!workspaceId) return;
    await fetch("/api/atrako/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, modulesEnabled: { [key]: value } }),
    });
    qc.invalidateQueries({ queryKey: ["workspace-config", workspaceId] });
  }

  const enabled = (config?.settings?.modulesEnabled ?? {}) as Record<string, boolean>;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <ConfigBack title="Módulos" />
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ul className="space-y-2 rounded-xl border border-[var(--hairline)] bg-white p-4">
          {MODULES.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={enabled[key] !== false}
                onChange={(e) => toggle(key, e.target.checked)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
