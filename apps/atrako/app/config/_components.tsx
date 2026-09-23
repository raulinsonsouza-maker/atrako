"use client";

import { BackLink } from "@/components/ui/back-link";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export function useConfigWorkspace() {
  const { workspaceId, workspaces } = useActiveWorkspace();
  return { workspaceId, clientes: workspaces };
}

export function ConfigBack({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <BackLink href="/config" />
      <h1 className="type-tagline text-[var(--ink)]">{title}</h1>
    </div>
  );
}
