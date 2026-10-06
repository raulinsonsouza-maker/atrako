"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppPage } from "@/components/layout/AppPage";
import { DateRangeFilter } from "@/components/ui";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { LEGACY_TABS, PERIOD_TABS, REL_TABS, relHref, type RelTab } from "@/components/relacionamento/nav";
import { useRelPeriod } from "@/components/relacionamento/period";
import { RelLoading } from "@/components/relacionamento/ui";
import { InicioTab } from "@/components/relacionamento/InicioTab";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { CampaignsTab } from "@/components/relacionamento/CampaignsTab";
import { ConteudoTab } from "@/components/relacionamento/ConteudoTab";
import { ContatosTab } from "@/components/relacionamento/ContatosTab";
import { DesempenhoTab } from "@/components/relacionamento/DesempenhoTab";

function Body({ workspaceId }: { workspaceId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { value, change, period } = useRelPeriod();
  const raw = sp.get("tab") ?? "";
  const legacy = LEGACY_TABS[raw];
  const tab: RelTab = legacy?.tab ?? REL_TABS.find((t) => t.key === raw)?.key ?? "inicio";
  const sub = sp.get("sub") ?? legacy?.sub;

  useEffect(() => {
    if (legacy) router.replace(relHref(legacy.tab, legacy.sub), { scroll: false });
  }, [legacy, router]);

  const go = (key: RelTab, nextSub?: string) => router.replace(relHref(key, nextSub), { scroll: false });

  return (
    <AppPage
      title="Relacionamento"
      actions={PERIOD_TABS.has(tab) ? <DateRangeFilter value={value} onChange={change} /> : undefined}
    >
      <nav className="lp-detail-tabs" aria-label="Seções de relacionamento">
        {REL_TABS.map((t) => (
          <button key={t.key} type="button" className="lp-detail-tab" data-active={tab === t.key} onClick={() => go(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-4">
        {tab === "inicio" ? <InicioTab workspaceId={workspaceId} period={period} onGo={go} /> : null}
        {tab === "fluxos" ? <FlowsTab workspaceId={workspaceId} period={period} /> : null}
        {tab === "campanhas" ? <CampaignsTab workspaceId={workspaceId} /> : null}
        {tab === "conteudo" ? <ConteudoTab workspaceId={workspaceId} sub={sub} onSub={(s) => go("conteudo", s)} /> : null}
        {tab === "contatos" ? <ContatosTab workspaceId={workspaceId} period={period} /> : null}
        {tab === "desempenho" ? <DesempenhoTab workspaceId={workspaceId} period={period} sub={sub} onSub={(s) => go("desempenho", s)} /> : null}
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
