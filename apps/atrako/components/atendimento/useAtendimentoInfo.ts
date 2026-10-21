"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export type AtendimentoRole = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";
export type AtendimentoChannel = "meta" | "instagram";

export type AtendimentoInfo = {
  name: string;
  logoUrl: string | null;
  /** Versão do logo para o menu escuro. */
  logoOnDark: string | null;
  role: AtendimentoRole;
  channels: Record<AtendimentoChannel, boolean>;
};

export function useAtendimentoInfo() {
  const { workspaceId, isError } = useActiveWorkspace();
  const query = useQuery({
    queryKey: ["atendimento-shell", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/atendimento?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar a área");
      return res.json() as Promise<AtendimentoInfo>;
    },
  });
  return { workspaceId, workspaceError: isError, info: query.data };
}
