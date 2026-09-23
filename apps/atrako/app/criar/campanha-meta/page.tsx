"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CampanhaMetaWizard } from "@/components/criar/campanha-meta/CampanhaMetaWizard";

function CampanhaMetaGate() {
  const router = useRouter();
  const sp = useSearchParams();
  const mode = sp.get("mode");
  const draftId = sp.get("draftId");
  const workspaceId = sp.get("workspaceId");

  // Drafts e deep-links com workspace abrem direto; criação nova exige mode do wizard.
  const skipModeGate = Boolean(draftId || workspaceId);

  useEffect(() => {
    if (skipModeGate) return;
    if (mode !== "ai" && mode !== "manual") {
      router.replace("/criar/p/anuncios");
    }
  }, [mode, router, skipModeGate]);

  if (!skipModeGate && mode !== "ai" && mode !== "manual") {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return <CampanhaMetaWizard />;
}

export default function CampanhaMetaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CampanhaMetaGate />
    </Suspense>
  );
}
