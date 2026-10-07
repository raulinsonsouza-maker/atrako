"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  Crosshair,
  LayoutGrid,
  Link2,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  AI_CONNECTION_PROVIDER,
  aiModelLabel,
  type AiConnectionMetadata,
} from "@/lib/atrako-agent/providers";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useWorkspaceConfig, type WorkspaceConfig } from "./_components";

type HubLink = {
  href: string;
  label: string;
  desc: string;
  icon: typeof Building2;
  status: (ctx: { config?: WorkspaceConfig; memberCount: number | null }) => string | null;
};

const GROUPS: Array<{ title: string; links: HubLink[] }> = [
  {
    title: "Negócio",
    links: [
      {
        href: "/config/empresa",
        label: "Empresa",
        desc: "Nome, cor, fuso e contato",
        icon: Building2,
        status: ({ config }) =>
          [formatTimezone(config?.settings?.timezone), config?.settings?.currency]
            .filter(Boolean)
            .join(" · ") || null,
      },
      {
        href: "/config/membros",
        label: "Equipe",
        desc: "Quem acessa e o que pode fazer",
        icon: Users,
        status: ({ memberCount }) =>
          memberCount == null
            ? null
            : memberCount === 1
              ? "1 pessoa"
              : `${memberCount} pessoas`,
      },
      {
        href: "/config/modulos",
        label: "Módulos",
        desc: "O que aparece no menu do workspace",
        icon: LayoutGrid,
        status: ({ config }) => {
          if (!config?.modules) return null;
          const n = Object.values(config.modules).filter((m) => m.enabled && !m.locked).length;
          if (n === 0) return "Só o núcleo";
          return n === 1 ? "1 ativo" : `${n} ativos`;
        },
      },
    ],
  },
  {
    title: "Conexões",
    links: [
      {
        href: "/config/conexoes",
        label: "Integrações",
        desc: "WhatsApp, Instagram, e-mail, loja e anúncios",
        icon: Link2,
        status: ({ config }) => {
          if (!config) return null;
          const n = config.connections.filter(
            (c) => c.hasCredentials && c.provider !== AI_CONNECTION_PROVIDER,
          ).length;
          if (n === 0) return "Nenhuma ativa";
          return n === 1 ? "1 ativa" : `${n} ativas`;
        },
      },
      {
        href: "/config/rastreamento",
        label: "Rastreamento",
        desc: "Meta Pixel e Google Analytics",
        icon: Crosshair,
        status: ({ config }) => {
          if (!config) return null;
          const t = config.settings.tracking ?? {};
          const active = [t.pixelId ? "Pixel" : null, t.ga4MeasurementId ? "GA4" : null].filter(
            Boolean,
          );
          return active.length ? `${active.join(" + ")} ativo` : "Não configurado";
        },
      },
      {
        href: "/config/ia",
        label: "IA",
        desc: "Modelo e chave de API que o Atrako usa",
        icon: Sparkles,
        status: ({ config }) => {
          if (!config) return null;
          const row = config.connections.find((c) => c.provider === AI_CONNECTION_PROVIDER);
          if (!row?.hasCredentials || row.status !== "ACTIVE") return "Sem IA própria";
          const meta = (row.metadata ?? {}) as AiConnectionMetadata;
          const model = aiModelLabel(meta.provider, meta.model);
          return model ? `Conectada · ${model}` : "Conectada";
        },
      },
    ],
  },
];

function formatTimezone(tz: string | undefined) {
  if (!tz) return null;
  return tz.replace("America/", "").replace(/_/g, " ");
}

export default function ConfigHomePage() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    workspaceId,
    workspaces,
    isLoading,
    isReady,
    isError: workspaceError,
    error: workspaceLoadError,
    retry: retryWorkspaces,
  } = useActiveWorkspace();

  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
  } = useWorkspaceConfig();

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/members?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ members: unknown[] }>;
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });
  const memberCount = membersData ? membersData.members.length : null;

  const workspaceName =
    config?.workspace?.name ||
    workspaces.find((w) => w.id === workspaceId)?.nome ||
    null;

  async function createEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch("/api/atrako/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível criar");
      setNome("");
      await qc.invalidateQueries({ queryKey: ["my-workspaces"] });
      await qc.invalidateQueries({ queryKey: ["config-clientes"] });
      await qc.invalidateQueries({ queryKey: ["admin-clientes-nav"] });
      window.location.assign("/config/empresa");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Não foi possível criar");
    } finally {
      setCreating(false);
    }
  }

  const showCreate = isReady && !workspaceError && workspaces.length === 0;
  const sessionExpired =
    workspaceLoadError instanceof Error &&
    "status" in workspaceLoadError &&
    workspaceLoadError.status === 401;
  const showHub = Boolean(workspaceId);
  const showSpinner =
    isLoading || !isReady || (showHub && configLoading && !config && !configError);

  return (
    <AppPage title="Configuração" narrow>
      {showSpinner ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : showHub ? (
        <div className="flex flex-col gap-6">
          <header className="space-y-1">
            <p className="type-body-strong text-[var(--ink)]">{workspaceName || "Empresa"}</p>
            {configError && !config ? (
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                Não foi possível carregar todos os detalhes — os atalhos abaixo seguem
                disponíveis.
              </p>
            ) : null}
          </header>

          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h2 className="px-1 type-caption-strong text-[var(--ink-muted-80)]">
                {group.title}
              </h2>
              <nav
                className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--canvas)]"
                aria-label={group.title}
              >
                {group.links.map((l, i) => {
                  const Icon = l.icon;
                  const status = l.status({ config, memberCount });
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-[var(--surface-pearl)] active:scale-[0.995] ${
                        i > 0 ? "border-t border-[var(--divider-soft)]" : ""
                      }`}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-glow)] text-[var(--primary)]">
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block type-caption-strong text-[var(--ink)]">
                          {l.label}
                        </span>
                        <span className="mt-0.5 block type-fine-print text-[var(--ink-muted-48)]">
                          {l.desc}
                        </span>
                      </span>
                      {status ? (
                        <span className="shrink-0 type-fine-print text-[var(--ink-muted-48)] phone:hidden">
                          {status}
                        </span>
                      ) : null}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--ink-muted-48)]"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </Link>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>
      ) : showCreate ? (
        <form onSubmit={createEmpresa} className="utility-card space-y-5 !p-5">
          <div>
            <h2 className="type-body-strong text-[var(--ink)]">Criar empresa</h2>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              É o workspace onde você publica e opera.
            </p>
          </div>
          <TextField
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Sua empresa"
            required
            autoFocus
          />
          {createError ? (
            <p className="type-caption text-[var(--danger)]">{createError}</p>
          ) : null}
          <Button type="submit" variant="primary" disabled={creating || !nome.trim()}>
            {creating ? "Criando…" : "Continuar"}
          </Button>
        </form>
      ) : workspaceError ? (
        <div className="utility-card space-y-4 !p-5">
          <div>
            <h2 className="type-body-strong text-[var(--ink)]">
              {sessionExpired ? "Sua sessão expirou" : "Não foi possível carregar sua empresa"}
            </h2>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              {sessionExpired
                ? "Entre novamente para continuar."
                : "Ocorreu uma falha ao consultar seus workspaces. Tente novamente."}
            </p>
          </div>
          {sessionExpired ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => window.location.assign("/sign-in?next=%2Fconfig")}
            >
              Entrar novamente
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={() => void retryWorkspaces()}>
              Tentar novamente
            </Button>
          )}
        </div>
      ) : (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      )}
    </AppPage>
  );
}
