"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export type WorkspaceConfig = {
  workspace: { id: string; name: string; slug: string | null; logoUrl: string | null };
  settings: {
    timezone: string;
    currency: string;
    primaryColor: string | null;
    tracking: {
      pixelId?: string | null;
      ga4MeasurementId?: string | null;
      hasCapiToken?: boolean;
      hasGa4ApiSecret?: boolean;
    };
    messagingPrefs: Record<string, unknown>;
  };
  connections: Array<{ provider: string; status: string; hasCredentials: boolean }>;
};

export function useConfigWorkspace() {
  const { workspaceId, workspaces, isReady } = useActiveWorkspace();
  return { workspaceId, clientes: workspaces, isReady };
}

export function workspaceConfigKey(workspaceId: string | null | undefined) {
  return ["workspace-config", workspaceId] as const;
}

export function useWorkspaceConfig() {
  const { workspaceId, isReady } = useConfigWorkspace();
  const query = useQuery({
    queryKey: workspaceConfigKey(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("Não foi possível carregar");
      return (await r.json()) as WorkspaceConfig;
    },
    enabled: Boolean(workspaceId),
    retry: 1,
  });
  return { workspaceId, ...query, isLoading: !isReady || query.isLoading };
}

/** PATCH em /api/atrako/config com estado salvando / Salvo / erro. */
export function useSaveConfig() {
  const qc = useQueryClient();
  const { workspaceId } = useConfigWorkspace();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!workspaceId) return false;
      setSaving(true);
      setSaved(false);
      setError(null);
      try {
        const r = await fetch("/api/atrako/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, ...patch }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Não foi possível salvar.");
        }
        await qc.invalidateQueries({ queryKey: workspaceConfigKey(workspaceId) });
        setSaved(true);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [qc, workspaceId],
  );

  const markDirty = useCallback(() => setSaved(false), []);

  return { save, saving, saved, error, markDirty };
}

export function SaveButton({
  form,
  saving,
  saved,
  disabled,
}: {
  form: string;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      form={form}
      variant="primary"
      disabled={saving || disabled}
      className="!px-5 !py-2 type-button-utility"
    >
      {saving ? (
        "Salvando…"
      ) : saved ? (
        <span className="inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Salvo
        </span>
      ) : (
        "Salvar"
      )}
    </Button>
  );
}

export function ConfigPage({
  title,
  actions,
  loading,
  wide,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  loading?: boolean;
  /** Grades de cards em 2 colunas (Integrações). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AppPage
      narrow
      className={wide ? "max-w-4xl" : undefined}
      actions={actions}
      title={
        <div className="flex min-w-0 items-center gap-2">
          <BackLink href="/config" />
          <h1 className="type-tagline truncate text-[var(--ink)]">{title}</h1>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-8">{children}</div>
      )}
    </AppPage>
  );
}

export function ConfigSection({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="type-caption-strong text-[var(--ink-muted-80)]">{title}</h2>
          {description ? (
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className="utility-card space-y-5">{children}</div>
    </section>
  );
}

export function StatusBadge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 type-fine-print ${
        active ? "text-[var(--ink)]" : "text-[var(--ink-muted-48)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-[var(--success)]" : "bg-[var(--ink-muted-48)]"
        }`}
        aria-hidden
      />
      {children}
    </span>
  );
}
