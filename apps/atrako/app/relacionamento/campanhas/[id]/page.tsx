"use client";

import { use } from "react";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { CampaignDetail } from "@/components/relacionamento/CampaignDetail";

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { workspaceId, isLoading } = useActiveWorkspace();
  if (isLoading || !workspaceId) {
    return (
      <AppPage title="Campanha">
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      </AppPage>
    );
  }
  return <CampaignDetail workspaceId={workspaceId} id={id} />;
}
