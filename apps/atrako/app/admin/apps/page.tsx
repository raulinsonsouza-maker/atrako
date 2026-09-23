"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";

type AppRow = {
  provider: string;
  enabled: boolean;
  label: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasDeveloperToken: boolean;
  hasLoginConfigId: boolean;
  hasWebhookSecret: boolean;
  hasServiceAccount: boolean;
  hasRefreshToken: boolean;
  clientIdPreview: string | null;
  updatedAt: string;
};

export default function AdminAppsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-platform-apps"],
    queryFn: async () => {
      const r = await fetch("/api/admin/apps");
      if (!r.ok) throw new Error("Falha ao carregar apps");
      return r.json() as Promise<{ apps: AppRow[] }>;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async (provider: string) => {
      const r = await fetch("/api/admin/apps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...form }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error || r.statusText);
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-platform-apps"] });
      setEditing(null);
      setForm({});
    },
  });

  return (
    <AppPage title="Apps da plataforma">
      <p className="type-body text-[var(--ink-secondary)] max-w-2xl">
        Credenciais de app OAuth/HMAC (Meta, Google, MP, ML, LinkedIn…). Os dealers conectam as
        contas deles em Config → Conexões.
      </p>

      {isLoading ? (
        <p className="type-body text-[var(--ink-secondary)]">Carregando…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(data?.apps ?? []).map((app) => (
            <li
              key={app.provider}
              className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="type-nav-link text-[var(--ink)]">
                    {app.label ?? app.provider}
                  </h2>
                  <p className="type-fine-print text-[var(--ink-secondary)]">
                    {app.provider}
                    {app.enabled ? " · habilitado" : " · desabilitado"}
                    {app.clientIdPreview ? ` · ${app.clientIdPreview}` : ""}
                    {" · "}
                    {[
                      app.hasClientSecret && "secret",
                      app.hasDeveloperToken && "dev token",
                      app.hasWebhookSecret && "webhook",
                      app.hasServiceAccount && "SA",
                      app.hasRefreshToken && "refresh",
                    ]
                      .filter(Boolean)
                      .join(", ") || "sem secrets"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(app.provider);
                    setForm({
                      label: app.label ?? "",
                      enabled: app.enabled ? "true" : "false",
                    });
                  }}
                >
                  Configurar
                </Button>
              </div>

              {editing === app.provider ? (
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate(app.provider);
                  }}
                >
                  <label className="type-fine-print flex flex-col gap-1">
                    Label
                    <input
                      className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                      value={form.label ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    />
                  </label>
                  <label className="type-fine-print flex flex-col gap-1">
                    Client ID
                    <input
                      className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                      value={form.clientId ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                      placeholder="deixe vazio para manter"
                      autoComplete="off"
                    />
                  </label>
                  <label className="type-fine-print flex flex-col gap-1">
                    Client Secret
                    <input
                      type="password"
                      className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                      value={form.clientSecret ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                      placeholder="deixe vazio para manter"
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="type-fine-print flex flex-col gap-1">
                    Developer token / Login Config / Webhook secret
                    <input
                      className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                      value={form.developerToken ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, developerToken: e.target.value }))
                      }
                      placeholder="developerToken (Google Ads)"
                    />
                    <input
                      className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                      value={form.loginConfigId ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, loginConfigId: e.target.value }))
                      }
                      placeholder="loginConfigId (Meta)"
                    />
                    <input
                      className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                      value={form.webhookSecret ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, webhookSecret: e.target.value }))
                      }
                      placeholder="webhookSecret"
                    />
                  </label>
                  <label className="type-fine-print flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enabled !== "false"}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          enabled: e.target.checked ? "true" : "false",
                        }))
                      }
                    />
                    Habilitado no hub
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={save.isPending}>
                      Salvar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                  {save.error ? (
                    <p className="type-fine-print text-[var(--danger)]">
                      {(save.error as Error).message}
                    </p>
                  ) : null}
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="type-fine-print text-[var(--ink-secondary)]">
        Também:{" "}
        <Link href="/admin/configuracoes" className="text-[var(--primary)]">
          Ops / alertas
        </Link>
        {" · "}
        <Link href="/admin/usuarios" className="text-[var(--primary)]">
          Usuários internos
        </Link>
      </p>
    </AppPage>
  );
}
