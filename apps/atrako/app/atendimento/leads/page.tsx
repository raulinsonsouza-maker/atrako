"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CrmPipelineBoard } from "@/components/crm/CrmPipelineBoard";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
    </div>
  );
}

export default function AtendimentoLeadsPage() {
  const { workspaceId } = useActiveWorkspace();

  return (
    <AppPage title="Leads" className="min-h-0 md:pt-5">
      {workspaceId ? (
        <Suspense fallback={<Spinner />}>
          <CrmPipelineBoard workspaceId={workspaceId} />
        </Suspense>
      ) : (
        <Spinner />
      )}
    </AppPage>
  );
}
