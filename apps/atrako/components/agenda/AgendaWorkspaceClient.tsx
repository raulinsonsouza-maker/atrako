"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { AgendaSubNav } from "@/components/agenda/AgendaSubNav";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export type AgendaWorkspaceContext = {
  workspaceId: string;
  workspaceSlug: string;
  businessMode: "SOLO" | "SALON";
};

export function useAgendaWorkspace() {
  const { workspaceId, workspaces, isLoading: loadingClientes } = useActiveWorkspace();
  const workspaceSlug = workspaces.find((w) => w.id === workspaceId)?.slug;

  const { data: meta, isLoading: loadingMeta } = useQuery({
    queryKey: ["agenda-meta", workspaceId],
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/agenda/meta?workspaceId=${encodeURIComponent(workspaceId!)}`,
      );
      if (!r.ok) return { businessMode: "SOLO" as const };
      const j = await r.json();
      const mode = j.businessMode === "SALON" ? "SALON" : "SOLO";
      return { businessMode: mode };
    },
    enabled: Boolean(workspaceId),
  });

  const businessMode: AgendaWorkspaceContext["businessMode"] =
    meta?.businessMode === "SALON" ? "SALON" : "SOLO";

  return {
    workspaceId,
    workspaceSlug,
    businessMode,
    isLoading: loadingClientes || (Boolean(workspaceId) && loadingMeta),
  };
}

export function AgendaWorkspaceGate({
  title,
  actions,
  narrow,
  hideSubNav,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  narrow?: boolean;
  hideSubNav?: boolean;
  children: (ctx: AgendaWorkspaceContext) => React.ReactNode;
}) {
  const { workspaceId, workspaceSlug, businessMode, isLoading } = useAgendaWorkspace();

  return (
    <AppPage title={title} actions={actions} narrow={narrow}>
      {!hideSubNav ? <AgendaSubNav /> : null}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : !workspaceId || !workspaceSlug ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
          <p className="type-body text-[var(--ink-muted-48)]">
            Crie uma empresa em Config para usar a Agenda.
          </p>
          <Link
            href="/config"
            className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-5 py-2.5 type-caption-strong text-[var(--on-primary)] active:scale-95"
          >
            Ir para Config
          </Link>
        </div>
      ) : (
        children({ workspaceId, workspaceSlug, businessMode })
      )}
    </AppPage>
  );
}

export async function agendaFetchJson<T>(
  path: string,
  workspaceId: string,
  init?: RequestInit & { search?: Record<string, string | undefined> },
): Promise<T> {
  const { search, ...rest } = init ?? {};
  const q = new URLSearchParams({ workspaceId });
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      if (v != null && v !== "") q.set(k, v);
    }
  }
  const url = path.includes("?")
    ? `${path}&${q.toString()}`
    : `/api/atrako/agenda/${path.replace(/^\//, "")}?${q.toString()}`;
  const r = await fetch(url, rest);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : "request failed");
  }
  return r.json() as Promise<T>;
}
