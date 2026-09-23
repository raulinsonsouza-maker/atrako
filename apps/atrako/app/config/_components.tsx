"use client";

import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";

export function useConfigWorkspace() {
  const { data: clientes = [] } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = (clientes[0]?.id as string) || "";
  return { workspaceId, clientes };
}

export function ConfigBack({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <BackLink href="/config" />
      <h1 className="type-tagline text-[var(--ink)]">{title}</h1>
    </div>
  );
}
