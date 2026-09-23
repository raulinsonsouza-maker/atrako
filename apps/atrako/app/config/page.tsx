"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ChevronRight,
  Crosshair,
  FileText,
  Link2,
  Loader2,
  Puzzle,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppPage } from "@/components/layout/AppPage";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

const LINKS = [
  {
    href: "/config/empresa",
    label: "Empresa",
    desc: "Nome, fuso, moeda e cor da marca",
    icon: Building2,
  },
  {
    href: "/config/membros",
    label: "Equipe",
    desc: "Quem acessa o workspace",
    icon: Users,
  },
  {
    href: "/config/conexoes",
    label: "Integrações",
    desc: "Mercado Pago, Mercado Livre, Instagram e Meta Ads",
    icon: Link2,
  },
  {
    href: "/config/modulos",
    label: "Módulos",
    desc: "O que está ativo na operação",
    icon: Puzzle,
  },
  {
    href: "/config/financeiro",
    label: "Financeiro",
    desc: "Preferências do caixa",
    icon: Wallet,
  },
  {
    href: "/config/rastreamento",
    label: "Rastreamento",
    desc: "Pixels e eventos",
    icon: Crosshair,
  },
  {
    href: "/config/forms",
    label: "Formulários",
    desc: "Origem padrão dos leads",
    icon: FileText,
  },
  {
    href: "/config/notificacoes",
    label: "Notificações",
    desc: "Alertas da equipe",
    icon: Bell,
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

  const { workspaceId, isLoading } = useActiveWorkspace();

  const { data: config } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("Não foi possível carregar");
      return r.json();
    },
    enabled: Boolean(workspaceId),
  });

  const activeConnections =
    config?.connections?.filter((c: { hasCredentials: boolean }) => c.hasCredentials)
      .length ?? 0;

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

  const meta = [
    formatTimezone(config?.settings?.timezone),
    config?.settings?.currency,
    activeConnections > 0
      ? `${activeConnections} integração${activeConnections === 1 ? "" : "ões"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppPage title="Configuração" narrow>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : config ? (
        <div className="flex flex-col gap-8">
          <header className="space-y-1">
            <p className="type-body-strong text-[var(--ink)]">
              {config.workspace?.name}
            </p>
            {meta ? (
              <p className="type-fine-print text-[var(--ink-muted-48)]">{meta}</p>
            ) : null}
          </header>

          <nav
            className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--canvas)]"
            aria-label="Ajustes"
          >
            {LINKS.map((l, i) => {
              const Icon = l.icon;
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
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--ink-muted-48)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      ) : (
        <form onSubmit={createEmpresa} className="utility-card space-y-5 !p-5">
          <div>
            <h2 className="type-body-strong text-[var(--ink)]">Criar empresa</h2>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              É o workspace onde você publica e opera.
            </p>
          </div>
          <label className="block">
            <span className="type-caption-strong text-[var(--ink)]">Nome</span>
            <input
              className="mt-2 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Sua empresa"
              required
              autoFocus
            />
          </label>
          {createError ? (
            <p className="type-caption text-[var(--danger)]">{createError}</p>
          ) : null}
          <Button type="submit" variant="primary" disabled={creating || !nome.trim()}>
            {creating ? "Criando…" : "Continuar"}
          </Button>
        </form>
      )}
    </AppPage>
  );
}
