"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SocialMediaPanel } from "@/components/clientes/SocialMediaPanel";
import { AnunciosPanel } from "@/components/atendimento/AnunciosPanel";
import { InicioGeral } from "@/components/atendimento/InicioGeral";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";
import { useAtendimentoPeriod } from "@/components/atendimento/useAtendimentoPeriod";
import { AppPage } from "@/components/layout/AppPage";
import { DateRangeFilter } from "@/components/ui";

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
  const period = useAtendimentoPeriod();

  const abas = ABAS.filter((aba) => !aba.channel || info?.channels?.[aba.channel]);
  const requested = searchParams.get("aba") as Aba | null;
  const aba: Aba = abas.some((a) => a.value === requested) ? (requested as Aba) : "geral";
  const { dataInicio, dataFim } = period.resolved;

  function selectAba(next: Aba) {
    router.replace(next === "geral" ? pathname : `${pathname}?aba=${next}`, { scroll: false });
  }

  return (
    <AppPage
      title="Início"
      className="md:pt-5"
      actions={<DateRangeFilter value={period.value} onChange={period.change} />}
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
        <AnunciosPanel workspaceId={workspaceId} periodo={period.periodo} dataInicio={dataInicio} dataFim={dataFim} />
      ) : aba === "instagram" ? (
        <SocialMediaPanel clienteId={workspaceId} dateFilter={{ periodo: period.periodo, dataInicio, dataFim }} />
      ) : (
        <InicioGeral workspaceId={workspaceId} query={period.query} periodLabel={period.resolved.label} />
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
