"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  applyBrandPrimaryToElement,
  clearBrandPrimaryFromElement,
  DEFAULT_PRIMARY,
} from "@/lib/brand/primaryColor";

/**
 * Carrega primaryColor do workspace ativo e injeta nas CSS vars do DS.
 * Sem cor configurada → Action Blue padrão (#0066cc).
 */
export function WorkspaceTheme() {
  const { data: clientes = [] } = useQuery({
    queryKey: ["brand-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
    staleTime: 60_000,
  });

  const workspaceId = (clientes[0]?.id as string | undefined) || "";

  const { data: config } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const primaryColor =
    (config?.settings?.primaryColor as string | null | undefined) ?? null;

  useEffect(() => {
    const root = document.documentElement;
    applyBrandPrimaryToElement(root, primaryColor || DEFAULT_PRIMARY);
    return () => {
      clearBrandPrimaryFromElement(root);
    };
  }, [primaryColor]);

  return null;
}
