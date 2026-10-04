"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

const COOKIE = "atrako_workspace_id";

function readCookie(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}

function writeCookie(id: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Workspace ativo da sessão/memberships — nunca assume clientes[0] global.
 * Resolve o id de forma síncrona a partir da lista (evita flash de “Criar empresa”).
 */
export function useActiveWorkspace() {
  const [overrideId, setOverrideId] = useState<string | null>(null);

  const { data: clientes = [], isLoading, isFetched, isError, error, refetch } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (r.status === 401) {
        const error = new Error("Sua sessão expirou. Entre novamente para carregar os workspaces.");
        Object.assign(error, { status: 401 });
        throw error;
      }
      if (!r.ok) throw new Error("Falha ao listar workspaces");
      return r.json() as Promise<
        Array<{ id: string; nome: string; slug?: string; ativo?: boolean }>
      >;
    },
  });

  const workspaceId = useMemo(() => {
    if (clientes.length === 0) return "";
    if (overrideId && clientes.some((c) => c.id === overrideId)) return overrideId;
    const fromCookie = readCookie();
    if (fromCookie && clientes.some((c) => c.id === fromCookie)) return fromCookie;
    return clientes[0]?.id ?? "";
  }, [clientes, overrideId]);

  // Espelha escolha padrão no cookie (não-httpOnly) para navegações seguintes.
  useEffect(() => {
    if (!workspaceId) return;
    if (readCookie() !== workspaceId) writeCookie(workspaceId);
  }, [workspaceId]);

  const setWorkspaceId = useCallback((id: string) => {
    setOverrideId(id);
    writeCookie(id);
  }, []);

  return {
    workspaceId,
    setWorkspaceId,
    workspaces: clientes,
    isLoading,
    isError,
    error,
    retry: refetch,
    /** Lista resolvida — true mesmo com 0 empresas (pode mostrar onboarding). */
    isReady: isFetched && !isLoading,
  };
}
