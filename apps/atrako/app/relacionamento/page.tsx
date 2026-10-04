"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { OverviewTab } from "@/components/relacionamento/OverviewTab";
import { FlowsTab } from "@/components/relacionamento/FlowsTab";
import { CampaignsTab } from "@/components/relacionamento/CampaignsTab";
import { TemplatesTab } from "@/components/relacionamento/TemplatesTab";
import { AudiencesTab } from "@/components/relacionamento/AudiencesTab";
import { ResultsTab } from "@/components/relacionamento/ResultsTab";
import { DeliveriesTab } from "@/components/relacionamento/DeliveriesTab";
import { ThemeTab } from "@/components/relacionamento/ThemeTab";

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "fluxos", label: "Fluxos" },
  { key: "campanhas", label: "Campanhas" },
  { key: "modelos", label: "Modelos WhatsApp" },
  { key: "publicos", label: "Públicos" },
  { key: "resultados", label: "Resultados" },
  { key: "envios", label: "Envios" },
  { key: "tema", label: "Tema do e-mail" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Body({ workspaceId }: { workspaceId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.key === sp.get("tab"))?.key ?? "visao") as TabKey;
  const go = (key: TabKey) => router.replace(`/relacionamento?tab=${key}`, { scroll: false });

  return (
    <>
      <nav className="lp-detail-tabs" aria-label="Seções de relacionamento">
        {TABS.map((t) => (
          <button key={t.key} type="button" className="lp-detail-tab" data-active={tab === t.key} onClick={() => go(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-4">
        {tab === "visao" ? <OverviewTab workspaceId={workspaceId} onGo={go} /> : null}
        {tab === "fluxos" ? <FlowsTab workspaceId={workspaceId} /> : null}
        {tab === "campanhas" ? <CampaignsTab workspaceId={workspaceId} /> : null}
        {tab === "modelos" ? <TemplatesTab workspaceId={workspaceId} /> : null}
        {tab === "publicos" ? <AudiencesTab workspaceId={workspaceId} /> : null}
        {tab === "resultados" ? <ResultsTab workspaceId={workspaceId} /> : null}
        {tab === "envios" ? <DeliveriesTab workspaceId={workspaceId} /> : null}
        {tab === "tema" ? <ThemeTab workspaceId={workspaceId} /> : null}
      </div>
    </>
  );
}

export default function RelacionamentoPage() {
  const { workspaceId, isLoading } = useActiveWorkspace();
  const spinner = (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
    </div>
  );
  return (
    <AppPage title="Relacionamento">
      {isLoading ? (
        spinner
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
        <Suspense fallback={spinner}>
          <Body workspaceId={workspaceId} />
        </Suspense>
      )}
    </AppPage>
  );
}
