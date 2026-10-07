"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { getModuleDef, homeFallback, type ModuleKey, type ModulesMap } from "@/lib/modules/registry";

/**
 * Módulos efetivos do workspace ativo. Reaproveita o cache de
 * `["workspace-config", workspaceId]` (mesma query do WorkspaceTheme / Config).
 * Enquanto carrega, só o núcleo conta como ligado.
 */
export function useModules() {
  const { workspaceId } = useActiveWorkspace();

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const modules = (data?.modules ?? null) as ModulesMap | null;

  const isEnabled = useCallback(
    (key: ModuleKey) => (modules ? modules[key]?.enabled === true : getModuleDef(key).core === true),
    [modules],
  );

  /** Enquanto carrega aponta para /assistente; o layout de lá redireciona se estiver desligado. */
  const homeHref = modules && !modules.assistente?.enabled ? homeFallback(workspaceId) : "/assistente";

  return { modules, isEnabled, isLoading, isReady: isFetched && Boolean(modules), homeHref };
}
