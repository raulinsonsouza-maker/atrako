"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { LEGACY_TABS, REL_TABS, relHref, relResultsHref, type RelTab } from "@/components/relacionamento/nav";
import { RelLoading } from "@/components/relacionamento/ui";
import { InicioTab } from "@/components/relacionamento/InicioTab";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { CampaignsTab } from "@/components/relacionamento/CampaignsTab";
import { AjustesTab } from "@/components/relacionamento/AjustesTab";

function Body({ workspaceId }: { workspaceId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("tab") ?? "";
  const legacy = LEGACY_TABS[raw];
  const legacyTab = legacy && "tab" in legacy ? legacy : null;
  const tab: RelTab = legacyTab?.tab ?? (raw === "ajustes" ? "ajustes" : REL_TABS.find((t) => t.key === raw)?.key ?? "inicio");
  const sub = sp.get("sub") ?? legacyTab?.sub;

  useEffect(() => {
    if (!legacy) return;
    if ("dashboard" in legacy) router.replace(relResultsHref(workspaceId));
    else router.replace(relHref(legacy.tab, sp.get("sub") ?? legacy.sub), { scroll: false });
  }, [legacy, router, sp, workspaceId]);

  const go = (key: RelTab, nextSub?: string) => router.replace(relHref(key, nextSub), { scroll: false });

  return (
    <AppPage title="Relacionamento">
      <nav className="lp-detail-tabs" aria-label="Seções de relacionamento">
        {REL_TABS.map((t) => (
          <button key={t.key} type="button" className="lp-detail-tab" data-active={tab === t.key} onClick={() => go(t.key)}>
            {t.label}
          </button>
        ))}
        <button type="button" className="lp-detail-tab ml-auto" data-active={tab === "ajustes"} onClick={() => go("ajustes")}>
          <Settings2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Ajustes
        </button>
      </nav>
      <div className="flex flex-col gap-4">
        {tab === "inicio" ? <InicioTab workspaceId={workspaceId} onGo={go} /> : null}
        {tab === "fluxos" ? <FlowsTab workspaceId={workspaceId} /> : null}
        {tab === "campanhas" ? <CampaignsTab workspaceId={workspaceId} /> : null}
        {tab === "ajustes" ? <AjustesTab workspaceId={workspaceId} sub={sub} onSub={(s) => go("ajustes", s)} /> : null}
      </div>
    </AppPage>
  );
}

export default function RelacionamentoPage() {
  const { workspaceId, isLoading } = useActiveWorkspace();
  if (isLoading) {
    return (
      <AppPage title="Relacionamento">
        <RelLoading />
      </AppPage>
    );
  }
  if (!workspaceId) {
    return (
      <AppPage title="Relacionamento">
        <div className="flex flex-1 items-center justify-center py-20">
          <Link
            href="/config"
            className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-5 py-2.5 type-caption-strong text-[var(--on-primary)] active:scale-95"
          >
            Criar empresa
          </Link>
        </div>
      </AppPage>
    );
  }
  return (
    <Suspense
      fallback={
        <AppPage title="Relacionamento">
          <RelLoading />
        </AppPage>
      }
    >
      <Body workspaceId={workspaceId} />
    </Suspense>
  );
}
