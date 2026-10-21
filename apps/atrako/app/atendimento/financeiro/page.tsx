"use client";

import { Suspense } from "react";
import { AppPage } from "@/components/layout/AppPage";
import { DateRangeFilter } from "@/components/ui";
import { FinanceiroPanel } from "@/components/atendimento/FinanceiroPanel";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { useAtendimentoPeriod } from "@/components/atendimento/useAtendimentoPeriod";

function Financeiro() {
  const { workspaceId } = useAtendimentoInfo();
  const period = useAtendimentoPeriod();
  return (
    <AppPage
      title="Financeiro"
      className="md:pt-5"
      actions={<DateRangeFilter value={period.value} onChange={period.change} />}
    >
      {workspaceId ? (
        <FinanceiroPanel workspaceId={workspaceId} query={period.query} periodLabel={period.resolved.label} />
      ) : (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      )}
    </AppPage>
  );
}

export default function FinanceiroPage() {
  return (
    <Suspense fallback={null}>
      <Financeiro />
    </Suspense>
  );
}
