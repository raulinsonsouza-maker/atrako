"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  MODULE_RELEASES,
  MODULE_RELEASE_LABELS,
  getModuleDef,
  type ModuleKey,
  type ModuleRelease,
} from "@/lib/modules/registry";

type ModuleRow = {
  key: ModuleKey;
  core: boolean;
  defaultRelease: ModuleRelease;
  release: ModuleRelease;
};

const RELEASE_HELP: Record<ModuleRelease, string> = {
  AVAILABLE: "Liga por padrão; o workspace pode desligar.",
  BETA: "Desligado por padrão; o workspace pode ligar em Config → Módulos.",
  HIDDEN: "Some para todos os clientes. A equipe Atrako vê em preview.",
};

const RELEASE_OPTIONS = MODULE_RELEASES.map((r) => ({ value: r, label: MODULE_RELEASE_LABELS[r] }));

export default function AdminModulosPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: async () => {
      const r = await fetch("/api/admin/modules");
      if (!r.ok) throw new Error("Não foi possível carregar os módulos.");
      return r.json() as Promise<{ modules: ModuleRow[] }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (input: { key: ModuleKey; release: ModuleRelease }) => {
      const r = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível salvar.");
      return j as { modules: ModuleRow[] };
    },
    onSuccess: (j) => {
      qc.setQueryData(["admin-modules"], { modules: j.modules });
      void qc.invalidateQueries({ queryKey: ["workspace-config"] });
    },
  });

  return (
    <AppPage title="Módulos" narrow>
      <p className="type-caption text-[var(--ink-muted-48)]">
        Status global de cada módulo. Cada workspace liga ou desliga os módulos disponíveis em
        Config → Módulos.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : isError || !data ? (
        <p className="type-caption text-[var(--danger)]">Não foi possível carregar os módulos.</p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--canvas)]">
          {data.modules.map((row, i) => {
            const def = getModuleDef(row.key);
            const Icon = def.icon;
            return (
              <div
                key={row.key}
                className={`flex flex-wrap items-center gap-3.5 px-4 py-3.5 ${
                  i > 0 ? "border-t border-[var(--divider-soft)]" : ""
                }`}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-glow)] text-[var(--primary)]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block type-caption-strong text-[var(--ink)]">{def.label}</span>
                  <span className="mt-0.5 block type-fine-print text-[var(--ink-muted-48)]">
                    {row.core ? "Núcleo — sempre disponível" : RELEASE_HELP[row.release]}
                  </span>
                </span>
                {row.core ? (
                  <span className="type-fine-print text-[var(--ink-muted-48)]">Núcleo</span>
                ) : (
                  <SegmentedControl
                    value={row.release}
                    onChange={(release) => mutation.mutate({ key: row.key, release })}
                    options={RELEASE_OPTIONS}
                    aria-label={`Status de ${def.label}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {mutation.isError ? (
        <p className="type-caption text-[var(--danger)]">
          {mutation.error instanceof Error ? mutation.error.message : "Não foi possível salvar."}
        </p>
      ) : null}
    </AppPage>
  );
}
