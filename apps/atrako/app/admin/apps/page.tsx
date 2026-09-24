"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import {
  PLATFORM_APP_CATALOG,
  platformAppCatalogList,
  platformAppStatus,
  platformAppStatusLabel,
  type PlatformAppFieldKey,
  type PlatformAppReadinessFlags,
} from "@/lib/config/platformAppCatalog";
import { type PlatformAppProvider } from "@/lib/config/platformAppProviders";
import { cn } from "@/lib/utils";

type AppRow = {
  provider: string;
  enabled: boolean;
  label: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasDeveloperToken: boolean;
  hasLoginConfigId: boolean;
  hasWhatsappLoginConfigId?: boolean;
  hasWebhookSecret: boolean;
  hasServiceAccount: boolean;
  hasRefreshToken: boolean;
  hasRedirectUri?: boolean;
  hasLoginCustomerId?: boolean;
  clientIdPreview: string | null;
  partnerKeyExpiresAt?: string | null;
  updatedAt: string;
};

function partnerKeyExpiryBanner(apps: AppRow[] | undefined): string | null {
  const shopee = apps?.find((a) => a.provider === "SHOPEE");
  const raw = shopee?.partnerKeyExpiresAt?.trim();
  if (!raw) return null;
  const expires = new Date(raw);
  if (Number.isNaN(expires.getTime())) return null;
  const days = Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days > 30) return null;
  if (days < 0) return "Partner Key da Shopee expirada — renove em /admin/apps.";
  return `Partner Key da Shopee expira em ${days} dia${days === 1 ? "" : "s"}.`;
}

const fieldClass =
  "h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 type-body text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted-48)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)]";

function rowFlags(row: AppRow | undefined): PlatformAppReadinessFlags {
  return {
    enabled: row?.enabled ?? false,
    hasClientId: Boolean(row?.hasClientId),
    hasClientSecret: Boolean(row?.hasClientSecret),
    hasDeveloperToken: Boolean(row?.hasDeveloperToken),
    hasLoginConfigId: Boolean(row?.hasLoginConfigId),
    hasWhatsappLoginConfigId: Boolean(row?.hasWhatsappLoginConfigId),
    hasWebhookSecret: Boolean(row?.hasWebhookSecret),
    hasServiceAccount: Boolean(row?.hasServiceAccount),
    hasRefreshToken: Boolean(row?.hasRefreshToken),
    hasRedirectUri: Boolean(row?.hasRedirectUri),
    hasLoginCustomerId: Boolean(row?.hasLoginCustomerId),
  };
}

function statusTone(status: ReturnType<typeof platformAppStatus>) {
  switch (status) {
    case "ready":
      return "text-[var(--success)]";
    case "incomplete":
      return "text-[var(--primary)]";
    case "n_a":
    case "disabled":
    default:
      return "text-[var(--ink-muted-48)]";
  }
}

export default function AdminAppsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-platform-apps"],
    queryFn: async () => {
      const r = await fetch("/api/admin/apps");
      if (!r.ok) throw new Error("Não foi possível carregar os apps.");
      return r.json() as Promise<{ apps: AppRow[] }>;
    },
  });

  const [editing, setEditing] = useState<PlatformAppProvider | null>(null);
  const [form, setForm] = useState<Partial<Record<PlatformAppFieldKey | "enabled", string>>>({});
  const [formError, setFormError] = useState("");

  const appsByProvider = useMemo(() => {
    const map = new Map<string, AppRow>();
    for (const row of data?.apps ?? []) map.set(row.provider, row);
    return map;
  }, [data?.apps]);

  const siblings = useMemo(() => {
    const map: Partial<Record<PlatformAppProvider, PlatformAppReadinessFlags>> = {};
    for (const row of data?.apps ?? []) {
      map[row.provider as PlatformAppProvider] = rowFlags(row);
    }
    return map;
  }, [data?.apps]);

  const ordered = useMemo(() => {
    return platformAppCatalogList().map((catalog) => ({
      provider: catalog.provider,
      catalog,
      row: appsByProvider.get(catalog.provider),
    }));
  }, [appsByProvider]);

  const save = useMutation({
    mutationFn: async (provider: PlatformAppProvider) => {
      const payload: Record<string, unknown> = { provider };
      for (const [k, v] of Object.entries(form)) {
        if (k === "enabled") {
          payload.enabled = v === "true";
          continue;
        }
        if (typeof v === "string" && v.trim()) payload[k] = v.trim();
      }
      const r = await fetch("/api/admin/apps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error || "Falha ao salvar.");
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-platform-apps"] });
      setEditing(null);
      setForm({});
      setFormError("");
    },
  });

  function openEditor(provider: PlatformAppProvider, row: AppRow | undefined) {
    const catalog = PLATFORM_APP_CATALOG[provider];
    setEditing(provider);
    setFormError("");
    setForm({
      label: row?.label ?? catalog.title,
      enabled: row?.enabled === false ? "false" : "true",
      ...(row?.partnerKeyExpiresAt
        ? { partnerKeyExpiresAt: row.partnerKeyExpiresAt }
        : {}),
    });
  }

  function closeEditor() {
    setEditing(null);
    setForm({});
    setFormError("");
  }

  function validateBeforeSave(provider: PlatformAppProvider, row: AppRow | undefined): string | null {
    const catalog = PLATFORM_APP_CATALOG[provider];
    const enabling = form.enabled !== "false";
    if (!enabling || provider === "WOOCOMMERCE") return null;

    const inheritFrom = catalog.inheritsOAuthFrom;
    const parent = inheritFrom ? siblings[inheritFrom] : undefined;
    const inherited = Boolean(parent?.enabled && parent.hasClientId && parent.hasClientSecret);

    const flags = {
      enabled: true,
      hasClientId: Boolean(form.clientId?.trim()) || Boolean(row?.hasClientId) || inherited,
      hasClientSecret:
        Boolean(form.clientSecret?.trim()) || Boolean(row?.hasClientSecret) || inherited,
      hasDeveloperToken: Boolean(form.developerToken?.trim()) || Boolean(row?.hasDeveloperToken),
      hasLoginConfigId: Boolean(form.loginConfigId?.trim()) || Boolean(row?.hasLoginConfigId),
      hasWhatsappLoginConfigId:
        Boolean(form.whatsappLoginConfigId?.trim()) || Boolean(row?.hasWhatsappLoginConfigId),
      hasWebhookSecret:
        Boolean(form.webhookSecret?.trim() || form.webhookVerifyToken?.trim()) ||
        Boolean(row?.hasWebhookSecret),
      hasServiceAccount: Boolean(form.serviceAccountJson?.trim()) || Boolean(row?.hasServiceAccount),
      hasRefreshToken: Boolean(form.refreshToken?.trim()) || Boolean(row?.hasRefreshToken),
      hasRedirectUri: Boolean(form.redirectUri?.trim()) || Boolean(row?.hasRedirectUri),
      hasLoginCustomerId: Boolean(form.loginCustomerId?.trim()) || Boolean(row?.hasLoginCustomerId),
    };

    if (inheritFrom && inherited) {
      const missingOwn = catalog.fields
        .filter((f) => f.requiredForReady)
        .filter((f) => f.key !== "clientId" && f.key !== "clientSecret")
        .filter((f) => {
          if (f.key === "serviceAccountJson") return !flags.hasServiceAccount;
          if (f.key === "webhookSecret" || f.key === "webhookVerifyToken")
            return !flags.hasWebhookSecret;
          return false;
        })
        .map((f) => f.label);
      if (missingOwn.length) {
        return `Para habilitar, preencha: ${missingOwn.join(", ")}.`;
      }
      return null;
    }

    const missing = catalog.fields
      .filter((f) => f.requiredForReady)
      .filter((f) => {
        switch (f.key) {
          case "clientId":
            return !flags.hasClientId;
          case "clientSecret":
            return !flags.hasClientSecret;
          case "developerToken":
            return !flags.hasDeveloperToken;
          case "webhookSecret":
          case "webhookVerifyToken":
            return !flags.hasWebhookSecret;
          case "serviceAccountJson":
            return !flags.hasServiceAccount;
          case "redirectUri":
            return !flags.hasRedirectUri;
          default:
            return false;
        }
      })
      .map((f) => f.label);

    if (missing.length) {
      if (inheritFrom) {
        return `Configure o Client em ${PLATFORM_APP_CATALOG[inheritFrom].title}, ou preencha: ${missing.join(", ")}.`;
      }
      return `Para habilitar, preencha: ${missing.join(", ")}.`;
    }
    return null;
  }

  const shopeeKeyBanner = partnerKeyExpiryBanner(data?.apps);

  return (
    <AppPage title="Apps">
      {shopeeKeyBanner ? (
        <p className="mb-4 rounded-[var(--radius-xs)] border border-amber-200 bg-amber-50 px-4 py-3 type-fine-print text-amber-950">
          {shopeeKeyBanner}
        </p>
      ) : null}
      {isLoading ? (
        <p className="type-body text-[var(--ink-muted-48)]">Carregando…</p>
      ) : isError ? (
        <p className="type-body text-[var(--danger)]">
          {(error as Error)?.message || "Erro ao carregar."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map(({ provider, catalog, row }) => {
            const flags = rowFlags(row);
            const status = platformAppStatus(provider, flags, siblings);
            const isOpen = editing === provider;

            return (
              <li
                key={provider}
                className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <h2 className="type-nav-link truncate text-[var(--ink)]">
                      {row?.label?.trim() || catalog.title}
                    </h2>
                    <span className={cn("type-fine-print shrink-0", statusTone(status))}>
                      {platformAppStatusLabel(status)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!shrink-0 !px-3 !py-1.5 type-button-utility"
                    onClick={() => (isOpen ? closeEditor() : openEditor(provider, row))}
                  >
                    {isOpen ? "Fechar" : "Configurar"}
                  </Button>
                </div>

                {isOpen ? (
                  <form
                    className="mt-4 flex flex-col gap-4 border-t border-[var(--hairline)] pt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const err = validateBeforeSave(provider, row);
                      if (err) {
                        setFormError(err);
                        return;
                      }
                      setFormError("");
                      save.mutate(provider);
                    }}
                  >
                    {catalog.fields.map((field) => {
                      if (field.key === "label") {
                        return (
                          <label key={field.key} className="flex flex-col gap-1.5">
                            <span className="type-fine-print text-[var(--ink-muted-48)]">
                              {field.label}
                            </span>
                            <input
                              className={fieldClass}
                              value={form.label ?? ""}
                              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                            />
                          </label>
                        );
                      }

                      const already =
                        field.key === "clientId"
                          ? row?.hasClientId
                          : field.key === "clientSecret"
                            ? row?.hasClientSecret
                            : field.key === "developerToken"
                              ? row?.hasDeveloperToken
                              : field.key === "loginConfigId"
                                ? row?.hasLoginConfigId
                                : field.key === "whatsappLoginConfigId"
                                  ? row?.hasWhatsappLoginConfigId
                                : field.key === "webhookSecret" || field.key === "webhookVerifyToken"
                                  ? row?.hasWebhookSecret
                                  : field.key === "serviceAccountJson"
                                    ? row?.hasServiceAccount
                                    : field.key === "redirectUri"
                                      ? row?.hasRedirectUri
                                      : field.key === "refreshToken"
                                        ? row?.hasRefreshToken
                                        : field.key === "loginCustomerId"
                                          ? row?.hasLoginCustomerId
                                          : false;

                      const inheritHint =
                        catalog.inheritsOAuthFrom &&
                        (field.key === "clientId" || field.key === "clientSecret")
                          ? "Opcional — herda do Google Ads se vazio"
                          : undefined;

                      const placeholder = field.secret
                        ? already
                          ? "Salvo — deixe em branco para manter"
                          : inheritHint || "Informe o valor"
                        : already
                          ? "Salvo — deixe em branco para manter"
                          : inheritHint;

                      return (
                        <label key={field.key} className="flex flex-col gap-1.5">
                          <span className="type-fine-print text-[var(--ink-muted-48)]">
                            {field.label}
                            {field.requiredForReady ? " *" : ""}
                          </span>
                          {field.multiline ? (
                            <textarea
                              className={`${fieldClass} min-h-[120px] py-2`}
                              value={form[field.key] ?? ""}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, [field.key]: e.target.value }))
                              }
                              placeholder={placeholder}
                              autoComplete="off"
                              spellCheck={false}
                            />
                          ) : (
                            <input
                              type={field.secret ? "password" : "text"}
                              className={fieldClass}
                              value={form[field.key] ?? ""}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, [field.key]: e.target.value }))
                              }
                              placeholder={placeholder}
                              autoComplete={field.secret ? "new-password" : "off"}
                            />
                          )}
                        </label>
                      );
                    })}

                    <div className="flex flex-col gap-1.5">
                      <span className="type-fine-print text-[var(--ink-muted-48)]">Status</span>
                      <PillSelect
                        size="field"
                        value={form.enabled !== "false" ? "true" : "false"}
                        onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                        options={[
                          { value: "true", label: "Habilitado" },
                          { value: "false", label: "Desabilitado" },
                        ]}
                        aria-label="Status"
                      />
                    </div>

                    {formError || save.error ? (
                      <p className="type-fine-print text-[var(--danger)]" role="alert">
                        {formError || (save.error as Error).message}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={save.isPending}>
                        {save.isPending ? "Salvando…" : "Salvar"}
                      </Button>
                      <Button type="button" variant="outline" onClick={closeEditor}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppPage>
  );
}
