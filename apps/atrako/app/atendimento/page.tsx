"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InsideSalesGeral } from "@/components/clientes/InsideSalesGeral";
import { SocialMediaPanel } from "@/components/clientes/SocialMediaPanel";
import { AnunciosPanel } from "@/components/atendimento/AnunciosPanel";
import { LeadQualityPanel } from "@/components/atendimento/LeadQualityPanel";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { AppPage } from "@/components/layout/AppPage";
import { PillSelect } from "@/components/ui";

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

type Aba = "geral" | "anuncios" | "instagram";

const ABAS: Array<{ value: Aba; label: string; channel?: "meta" | "instagram" }> = [
  { value: "geral", label: "Geral" },
  { value: "anuncios", label: "Anúncios", channel: "meta" },
  { value: "instagram", label: "Instagram", channel: "instagram" },
];

const tabClass = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 -mb-px border-b-2 px-1 pb-3 pt-2 type-nav-link ${
    active ? "border-[var(--primary)] text-[var(--ink)]" : "border-transparent text-[var(--muted-foreground)]"
  }`;

function AtendimentoHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId, info } = useAtendimentoInfo();
  const [periodo, setPeriodo] = useState("30");

  const abas = ABAS.filter((aba) => !aba.channel || info?.channels?.[aba.channel]);
  const requested = searchParams.get("aba") as Aba | null;
  const aba: Aba = abas.some((a) => a.value === requested) ? (requested as Aba) : "geral";
  const query = `periodo=${periodo}`;

  function selectAba(next: Aba) {
    router.replace(next === "geral" ? pathname : `${pathname}?aba=${next}`, { scroll: false });
  }

  return (
    <AppPage
      title="Início"
      className="md:pt-5"
      actions={<PillSelect value={periodo} onChange={setPeriodo} options={PERIODS} aria-label="Período" />}
    >
      {abas.length > 1 ? (
        <nav
          aria-label="Visões do início"
          className="channel-tabs mobile-scroll-strip flex shrink-0 items-end gap-6 overflow-x-auto border-b border-[var(--hairline)]"
        >
          {abas.map((a) => (
            <button
              key={a.value}
              type="button"
              data-active={aba === a.value}
              aria-current={aba === a.value ? "page" : undefined}
              onClick={() => selectAba(a.value)}
              className={tabClass(aba === a.value)}
            >
              {a.label}
            </button>
          ))}
        </nav>
      ) : null}

      {!workspaceId ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      ) : aba === "anuncios" ? (
        <AnunciosPanel workspaceId={workspaceId} periodo={periodo} />
      ) : aba === "instagram" ? (
        <SocialMediaPanel clienteId={workspaceId} dateFilter={{ periodo }} />
      ) : (
        <div className="space-y-8">
          <InsideSalesGeral workspaceId={workspaceId} query={query} />
          <LeadQualityPanel workspaceId={workspaceId} query={query} />
        </div>
      )}
    </AppPage>
  );
}

export default function AtendimentoHomePage() {
  return (
    <Suspense fallback={null}>
      <AtendimentoHome />
    </Suspense>
  );
}
