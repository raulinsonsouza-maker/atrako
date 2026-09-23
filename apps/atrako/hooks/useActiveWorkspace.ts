"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

const COOKIE = "atrako_workspace_id";

function readCookie(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}

/**
 * Workspace ativo da sessão/memberships — nunca assume clientes[0] global.
 */
export function useActiveWorkspace() {
  const [workspaceId, setWorkspaceIdState] = useState("");

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (r.status === 401) return [];
      if (!r.ok) throw new Error("Falha ao listar workspaces");
      return r.json() as Promise<
        Array<{ id: string; nome: string; slug?: string; ativo?: boolean }>
      >;
    },
  });

  useEffect(() => {
    const fromCookie = readCookie();
    if (fromCookie && clientes.some((c) => c.id === fromCookie)) {
      setWorkspaceIdState(fromCookie);
      return;
    }
    if (clientes[0]?.id) {
      setWorkspaceIdState(clientes[0].id);
    }
  }, [clientes]);

  const setWorkspaceId = useCallback((id: string) => {
    setWorkspaceIdState(id);
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);

  return {
    workspaceId,
    setWorkspaceId,
    workspaces: clientes,
    isLoading,
  };
}
