"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CrmPipelineBoard } from "@/components/crm/CrmPipelineBoard";
import { AppPage } from "@/components/layout/AppPage";

function CrmBody({ workspaceId }: { workspaceId: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CrmPipelineBoard workspaceId={workspaceId} />
    </Suspense>
  );
}

export default function CrmPage() {
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });

  const workspaceId = clientes[0]?.id as string | undefined;

  return (
    <AppPage title="Leads" className="min-h-0">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : !workspaceId ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Link
            href="/config"
            className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-5 py-2.5 type-caption-strong text-[var(--on-primary)] active:scale-95"
          >
            Criar empresa
          </Link>
        </div>
      ) : (
        <CrmBody workspaceId={workspaceId} />
      )}
    </AppPage>
  );
}
