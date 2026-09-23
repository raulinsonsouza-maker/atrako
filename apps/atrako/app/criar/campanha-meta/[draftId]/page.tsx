"use client";

import { Suspense, use } from "react";
import { Loader2 } from "lucide-react";
import { CampanhaMetaWizard } from "@/components/criar/campanha-meta/CampanhaMetaWizard";

export default function CampanhaMetaDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CampanhaMetaWizard initialDraftId={draftId} />
    </Suspense>
  );
}
