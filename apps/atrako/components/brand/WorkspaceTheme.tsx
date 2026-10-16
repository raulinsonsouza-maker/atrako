"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  applyBrandPrimaryToElement,
  clearBrandPrimaryFromElement,
  DEFAULT_PRIMARY,
} from "@/lib/brand/primaryColor";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

/**
 * Carrega primaryColor do workspace ativo e injeta nas CSS vars do DS.
 * Sem cor configurada → Action Blue padrão (#0066cc).
 * Admin staff nunca herda a marca do dealer (evita azul → vermelho ao carregar).
 */
export function WorkspaceTheme() {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");
  const { workspaceId } = useActiveWorkspace();

  const { data: config } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    enabled: Boolean(workspaceId) && !isAdmin,
    staleTime: 30_000,
  });

  const primaryColor = isAdmin
    ? DEFAULT_PRIMARY
    : ((config?.settings?.primaryColor as string | null | undefined) ?? null);

  useEffect(() => {
    const root = document.documentElement;
    applyBrandPrimaryToElement(root, primaryColor || DEFAULT_PRIMARY);
    return () => {
      clearBrandPrimaryFromElement(root);
    };
  }, [primaryColor]);

  return null;
}
