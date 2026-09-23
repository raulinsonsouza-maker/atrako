"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { CopyLinkButton } from "@/components/criar/CopyLinkButton";
import {
  CRIAR_PLATFORMS,
  platformCounts,
  platformHref,
} from "@/lib/criar/catalog";

type RecentItem = {
  id: string;
  kind: string;
  name: string;
  slug: string;
  status: string;
  path: string;
  metricLabel: string;
  metricValue: number | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  oferta: "Oferta",
  formulario: "Formulário",
  automacao: "Automação",
  servico: "Serviço",
  cupom: "Cupom",
  upsell: "Upsell",
  campanha_meta: "Campanha Meta",
};

function CriarHomeInner() {
  const sp = useSearchParams();
  const assistente = sp.get("assistente") === "1";

  const { data: clientes = [], isLoading: loadingWs } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["criar-recent", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/criar/recent?workspaceId=${workspaceId}`);
      if (!r.ok) return { items: [] as RecentItem[] };
      return r.json() as Promise<{ items: RecentItem[] }>;
    },
    enabled: Boolean(workspaceId),
  });

  const items = data?.items ?? [];

  return (
    <AppPage title="Criar">
      <div className="criar-home">
        <Link
          href={assistente ? "/criar" : "/criar?assistente=1"}
          className="criar-assistente-banner"
          data-active={assistente ? "true" : "false"}
        >
          <span className="criar-assistente-icon">
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="type-caption-strong text-[var(--ink)]">
              Criar com o Assistente
            </span>
            <span className="mt-0.5 block type-fine-print text-[var(--ink-muted-48)]">
              {assistente
                ? "Modo ativo — escolha a plataforma abaixo e descreva o que quer."
                : "Escolha a plataforma e descreva o que quer — o Atrako monta."}
            </span>
          </span>
          <span className="criar-recipe-badge" data-tone="recommended">
            {assistente ? "Ativo" : "Mais usado"}
          </span>
        </Link>

        <section>
          <h2 className="mb-3 type-fine-print uppercase tracking-[0.14em] text-[var(--ink-muted-48)]">
            Plataformas
          </h2>
          <div className="criar-platform-grid">
            {CRIAR_PLATFORMS.map((p) => {
              const Icon = p.icon;
              const counts = platformCounts(p.id);
              const href = assistente
                ? platformHref(p.id, "ai")
                : platformHref(p.id);
              return (
                <Link key={p.id} href={href} className="criar-platform-card">
                  <span className="criar-platform-icon">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-caption-strong text-[var(--ink)]">
                      {p.title}
                    </span>
                    <span className="mt-1 block type-fine-print text-[var(--ink-muted-48)]">
                      {p.desc}
                    </span>
                    <span className="mt-2 block type-micro-legal text-[var(--ink-muted-48)]">
                      {counts.available} disponíve
                      {counts.available === 1 ? "l" : "is"}
                      {counts.soon > 0 ? ` · ${counts.soon} em breve` : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="criar-recent">
          <h2 className="type-fine-print uppercase tracking-[0.14em] text-[var(--ink-muted-48)]">
            Suas criações
          </h2>

          {loadingWs || isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          ) : !workspaceId ? (
            <p className="type-caption text-[var(--ink-muted-48)]">
              Configure a empresa em{" "}
              <Link href="/config" className="text-[var(--primary)]">
                Config
              </Link>
            </p>
          ) : items.length === 0 ? (
            <p className="type-caption text-[var(--ink-muted-48)]">
              Nada publicado ainda
            </p>
          ) : (
            <ul className="criar-recent-list">
              {items.map((item) => {
                const origin =
                  typeof window !== "undefined" ? window.location.origin : "";
                const fullUrl = `${origin}${item.path}`;
                const canCopy =
                  item.path.startsWith("/p/") ||
                  item.path.startsWith("/f/") ||
                  item.path.startsWith("/b/");
                return (
                  <li key={`${item.kind}-${item.id}`} className="criar-recent-row">
                    <div className="min-w-0">
                      <p className="truncate type-caption-strong text-[var(--ink)]">
                        {item.name}
                      </p>
                      <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-48)]">
                        {KIND_LABEL[item.kind] ?? item.kind}
                        {canCopy ? ` · ${item.path}` : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {canCopy ? (
                        <CopyLinkButton
                          url={fullUrl}
                          label="Copiar"
                          className="!px-3.5 !py-1.5 type-button-utility"
                        />
                      ) : null}
                      <a
                        href={item.path}
                        target="_blank"
                        rel="noreferrer"
                        className="lp-pages-btn-secondary !min-h-0 !px-3.5 !py-1.5 type-button-utility"
                      >
                        Abrir
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppPage>
  );
}

export default function CriarHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CriarHomeInner />
    </Suspense>
  );
}
