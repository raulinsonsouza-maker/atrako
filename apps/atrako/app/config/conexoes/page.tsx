"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  Loader2,
  Instagram,
  CreditCard,
  Megaphone,
  AlertCircle,
  MessageCircle,
  CalendarDays,
  ShoppingBag,
  Store,
} from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";
import type { AtrakoOAuthMessage } from "@/lib/oauth/openOAuthPopup";

type ConnectionRow = {
  id: string;
  provider: string;
  status: string;
  label: string | null;
  hasCredentials: boolean;
  lastSyncedAt: string | null;
  metadata?: unknown;
};

type MetaConnectionStatus = {
  connected: boolean;
  health: string;
  businessName: string | null;
  businessId: string | null;
  adAccounts: Array<{ id: string; name: string; ownershipType?: string }>;
  selectedAdAccountId: string | null;
  pagesCount: number;
  adAccountsCount: number;
  lastError: string | null;
};

const PROVIDER_CARDS: Array<{
  provider: string;
  title: string;
  icon: typeof Instagram;
  connectHref?: (workspaceId: string) => string;
  adsHref?: string;
  /** WhatsApp Embedded Signup (Facebook) */
  facebookSignup?: boolean;
}> = [
  {
    provider: "META_ADS",
    title: "Meta Ads",
    icon: Megaphone,
    connectHref: (id) => `/api/atrako/oauth/meta/start?workspaceId=${id}`,
  },
  {
    provider: "GOOGLE_ADS",
    title: "Google Ads",
    icon: Megaphone,
    connectHref: (id) => `/api/atrako/oauth/google-ads/start?workspaceId=${id}`,
  },
  {
    provider: "LINKEDIN_ADS",
    title: "LinkedIn Ads",
    icon: Megaphone,
    connectHref: (id) => `/api/atrako/oauth/linkedin/start?workspaceId=${id}`,
  },
  {
    provider: "INSTAGRAM",
    title: "Instagram",
    icon: Instagram,
    connectHref: (id) => `/api/atrako/oauth/instagram/start?workspaceId=${id}`,
  },
  {
    provider: "MERCADO_PAGO",
    title: "Mercado Pago",
    icon: CreditCard,
    connectHref: (id) => `/api/atrako/oauth/mercadopago/start?workspaceId=${id}`,
  },
  {
    provider: "MERCADO_LIVRE",
    title: "Mercado Livre",
    icon: ShoppingBag,
    connectHref: (id) => `/api/atrako/oauth/mercadolivre/start?workspaceId=${id}`,
  },
  {
    provider: "SHOPEE",
    title: "Shopee",
    icon: ShoppingBag,
    connectHref: (id) => `/api/atrako/oauth/shopee/start?workspaceId=${id}`,
  },
  {
    provider: "GOOGLE_CALENDAR",
    title: "Google Calendar",
    icon: CalendarDays,
    connectHref: (id) =>
      `/api/atrako/oauth/google-calendar/start?workspaceId=${id}`,
  },
  {
    provider: "WHATSAPP",
    title: "WhatsApp",
    icon: MessageCircle,
    facebookSignup: true,
  },
];

const ECOMM_CARDS: Array<{
  key: "woocommerce";
  title: string;
}> = [{ key: "woocommerce", title: "WooCommerce" }];

function metaBannerMessage(meta: string | null, metaError: string | null): string | null {
  if (!meta) return null;
  if (meta === "cancelled") return "Conexão Meta cancelada.";
  if (meta === "ready") return "Meta conectada. Conta de anúncio selecionada — sync em andamento.";
  if (meta === "select_account") return "Meta autorizada. Selecione a conta de anúncio abaixo.";
  if (meta === "no_ad_account") {
    return "Nenhuma conta de anúncio disponível para este usuário Meta.";
  }
  if (meta === "error") return metaError || "Falha ao conectar Meta. Tente novamente.";
  return null;
}

function ConexoesHubInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const {
    workspaceId,
    setWorkspaceId,
    workspaces,
    isLoading: loadingClientes,
  } = useActiveWorkspace();
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [selectingAd, setSelectingAd] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [selectedGadsCid, setSelectedGadsCid] = useState("");
  const [selectingGads, setSelectingGads] = useState(false);
  const [gadsPickError, setGadsPickError] = useState<string | null>(null);
  const [forceGadsPick, setForceGadsPick] = useState(false);

  const [wooOpen, setWooOpen] = useState(false);
  const [wooUrl, setWooUrl] = useState("");
  const [wooKey, setWooKey] = useState("");
  const [wooSecret, setWooSecret] = useState("");
  const [wooWebhookSecret, setWooWebhookSecret] = useState("");
  const [wooSaving, setWooSaving] = useState(false);
  const [wooError, setWooError] = useState<string | null>(null);

  const [shopifyShop, setShopifyShop] = useState("");
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const [shopifySyncing, setShopifySyncing] = useState(false);
  const [trayStore, setTrayStore] = useState("");
  const [trayOpen, setTrayOpen] = useState(false);
  const [traySyncing, setTraySyncing] = useState(false);
  const [nuvemshopSyncing, setNuvemshopSyncing] = useState(false);
  const [shopeeSyncing, setShopeeSyncing] = useState(false);
  const [oauthFlash, setOauthFlash] = useState<string | null>(null);
  const [oauthMetaOverride, setOauthMetaOverride] = useState<{
    meta: string | null;
    metaError: string | null;
  } | null>(null);

  const metaParam = oauthMetaOverride?.meta ?? searchParams.get("meta");
  const metaErrorParam = oauthMetaOverride?.metaError ?? searchParams.get("metaError");
  const workspaceFromUrl = searchParams.get("workspaceId");

  useEffect(() => {
    if (workspaceFromUrl) setWorkspaceId(workspaceFromUrl);
  }, [workspaceFromUrl, setWorkspaceId]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    const pick = searchParams.get("pick");
    if (pick === "GOOGLE_ADS") setForceGadsPick(true);
    if (connected) {
      setOauthFlash(
        pick === "GOOGLE_ADS"
          ? "Google Ads autorizado. Escolha a conta (CID) abaixo."
          : `${connected.replace(/_/g, " ")} conectado.`,
      );
    } else if (err) setOauthFlash(err);
  }, [searchParams]);

  const effectiveWorkspace = workspaceId;

  const onOAuthDone = useCallback(
    (msg: AtrakoOAuthMessage | { ok: false; cancelled: true }) => {
      void qc.invalidateQueries({ queryKey: ["workspace-connections"] });
      void qc.invalidateQueries({ queryKey: ["meta-connection-status"] });
      if ("cancelled" in msg && msg.cancelled) {
        return;
      }
      if (msg.workspaceId) setWorkspaceId(msg.workspaceId);
      if (msg.pick === "GOOGLE_ADS") setForceGadsPick(true);
      if (msg.meta) {
        setOauthMetaOverride({ meta: msg.meta, metaError: msg.metaError });
        setOauthFlash(null);
      } else if (msg.ok && msg.connected) {
        setOauthFlash(
          msg.pick === "GOOGLE_ADS"
            ? "Google Ads autorizado. Escolha a conta (CID) abaixo."
            : `${msg.connected.replace(/_/g, " ")} conectado.`,
        );
      } else if (msg.error) {
        setOauthFlash(msg.error);
      }
    },
    [qc, setWorkspaceId],
  );

  const { open: openOAuth, cancel: cancelOAuth, pending: oauthPending } = useOAuthPopup({
    onDone: onOAuthDone,
  });

  const startOAuth = useCallback(
    (href: string) => {
      if (!effectiveWorkspace) return;
      setOauthFlash(null);
      openOAuth(href);
    },
    [effectiveWorkspace, openOAuth],
  );

  const { data: connectionsData, isLoading: loadingConn } = useQuery({
    queryKey: ["workspace-connections", effectiveWorkspace],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/connections?workspaceId=${effectiveWorkspace}`);
      if (!r.ok) throw new Error("Não foi possível carregar as integrações");
      return r.json() as Promise<{ connections: ConnectionRow[] }>;
    },
    enabled: Boolean(effectiveWorkspace),
  });

  const { data: metaStatus } = useQuery({
    queryKey: ["meta-connection-status", effectiveWorkspace],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/meta/connection?workspaceId=${effectiveWorkspace}`);
      if (!r.ok) return null;
      return r.json() as Promise<MetaConnectionStatus>;
    },
    enabled: Boolean(effectiveWorkspace),
  });

  useEffect(() => {
    if (metaStatus?.selectedAdAccountId) {
      setSelectedAdAccount(metaStatus.selectedAdAccountId);
    } else if (metaStatus?.adAccounts?.length === 1) {
      setSelectedAdAccount(metaStatus.adAccounts[0].id);
    }
  }, [metaStatus?.selectedAdAccountId, metaStatus?.adAccounts]);

  const byProvider = useMemo(() => {
    const map = new Map<string, ConnectionRow>();
    for (const c of connectionsData?.connections ?? []) map.set(c.provider, c);
    return map;
  }, [connectionsData]);

  const googleAdsMeta = useMemo(() => {
    const row = byProvider.get("GOOGLE_ADS");
    const meta =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const ids = Array.isArray(meta.accessibleCustomerIds)
      ? meta.accessibleCustomerIds
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.replace(/\D/g, ""))
          .filter(Boolean)
      : [];
    const customerId =
      typeof meta.customerId === "string" ? meta.customerId.replace(/\D/g, "") : "";
    return {
      accessibleCustomerIds: ids,
      customerId,
      needsAccountPick: meta.needsAccountPick === true || (ids.length > 1 && !customerId),
    };
  }, [byProvider]);

  useEffect(() => {
    if (googleAdsMeta.customerId) {
      setSelectedGadsCid(googleAdsMeta.customerId);
    } else if (googleAdsMeta.accessibleCustomerIds.length === 1) {
      setSelectedGadsCid(googleAdsMeta.accessibleCustomerIds[0]);
    }
  }, [googleAdsMeta.customerId, googleAdsMeta.accessibleCustomerIds]);

  const wooRow = byProvider.get("WOOCOMMERCE");
  const wooConnected = wooRow?.status === "ACTIVE" && wooRow.hasCredentials;

  const disconnect = useCallback(
    async (provider: string) => {
      if (provider === "WHATSAPP") {
        await fetch("/api/atrako/whatsapp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: effectiveWorkspace,
            action: "disconnect",
          }),
        }).catch(() => null);
      } else if (provider === "WOOCOMMERCE") {
        await fetch("/api/atrako/woocommerce/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: effectiveWorkspace,
            action: "disconnect",
          }),
        }).catch(() => null);
      } else {
        await fetch("/api/atrako/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: effectiveWorkspace,
            provider,
            action: "disconnect",
            credentials: {},
          }),
        }).catch(() => null);
      }
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
      qc.invalidateQueries({ queryKey: ["meta-connection-status", effectiveWorkspace] });
    },
    [effectiveWorkspace, qc],
  );

  async function confirmMetaAdAccount() {
    if (!effectiveWorkspace || !selectedAdAccount) return;
    setSelectingAd(true);
    setSelectError(null);
    try {
      const r = await fetch("/api/atrako/meta/select-ad-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspace,
          adAccountId: selectedAdAccount,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível selecionar a conta.");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
      qc.invalidateQueries({ queryKey: ["meta-connection-status", effectiveWorkspace] });
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : "Erro ao selecionar conta");
    } finally {
      setSelectingAd(false);
    }
  }

  async function confirmGoogleAdsCid() {
    if (!effectiveWorkspace || !selectedGadsCid) return;
    setSelectingGads(true);
    setGadsPickError(null);
    try {
      const r = await fetch("/api/atrako/oauth/google-ads/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspace,
          customerId: selectedGadsCid,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível salvar a conta.");
      setForceGadsPick(false);
      setOauthFlash("Google Ads conectado.");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setGadsPickError(err instanceof Error ? err.message : "Erro ao selecionar conta");
    } finally {
      setSelectingGads(false);
    }
  }

  async function saveWoo(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveWorkspace || !wooUrl.trim() || !wooKey.trim() || !wooSecret.trim()) return;
    setWooSaving(true);
    setWooError(null);
    try {
      const r = await fetch("/api/atrako/woocommerce/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspace,
          credentials: {
            storeUrl: wooUrl.trim(),
            consumerKey: wooKey.trim(),
            consumerSecret: wooSecret.trim(),
            webhookSecret: wooWebhookSecret.trim() || undefined,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível conectar a loja.");
      setWooOpen(false);
      setWooUrl("");
      setWooKey("");
      setWooSecret("");
      setWooWebhookSecret("");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setWooError(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setWooSaving(false);
    }
  }

  async function syncShopify() {
    if (!effectiveWorkspace) return;
    setShopifySyncing(true);
    try {
      const r = await fetch("/api/atrako/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspace }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao sincronizar");
      setOauthFlash("Shopify sincronizado.");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setOauthFlash(err instanceof Error ? err.message : "Erro ao sincronizar Shopify");
    } finally {
      setShopifySyncing(false);
    }
  }

  async function syncTray() {
    if (!effectiveWorkspace) return;
    setTraySyncing(true);
    try {
      const r = await fetch("/api/atrako/tray/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspace }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao sincronizar");
      setOauthFlash("Tray sincronizado.");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setOauthFlash(err instanceof Error ? err.message : "Erro ao sincronizar Tray");
    } finally {
      setTraySyncing(false);
    }
  }

  async function syncNuvemshop() {
    if (!effectiveWorkspace) return;
    setNuvemshopSyncing(true);
    try {
      const r = await fetch("/api/atrako/nuvemshop/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspace }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao sincronizar");
      setOauthFlash("Nuvemshop sincronizado.");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setOauthFlash(err instanceof Error ? err.message : "Erro ao sincronizar Nuvemshop");
    } finally {
      setNuvemshopSyncing(false);
    }
  }

  async function syncShopee() {
    if (!effectiveWorkspace) return;
    setShopeeSyncing(true);
    try {
      const r = await fetch("/api/atrako/shopee/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspace }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao sincronizar");
      setOauthFlash("Shopee sincronizado.");
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setOauthFlash(err instanceof Error ? err.message : "Erro ao sincronizar Shopee");
    } finally {
      setShopeeSyncing(false);
    }
  }

  function startShopifyOAuth() {
    if (!effectiveWorkspace || !shopifyShop.trim()) return;
    const q = new URLSearchParams({
      workspaceId: effectiveWorkspace,
      shop: shopifyShop.trim(),
    });
    startOAuth(`/api/atrako/oauth/shopify/start?${q}`);
  }

  function startTrayOAuth() {
    if (!effectiveWorkspace || !trayStore.trim()) return;
    const q = new URLSearchParams({
      workspaceId: effectiveWorkspace,
      store: trayStore.trim(),
    });
    startOAuth(`/api/atrako/oauth/tray/start?${q}`);
  }

  function startNuvemshopOAuth() {
    if (!effectiveWorkspace) return;
    startOAuth(
      `/api/atrako/oauth/nuvemshop/start?workspaceId=${encodeURIComponent(effectiveWorkspace)}`,
    );
  }

  const banner = metaBannerMessage(metaParam, metaErrorParam);
  const showMetaSelect =
    metaStatus?.connected &&
    (metaStatus.health === "connected_pending_account" ||
      metaParam === "select_account" ||
      (metaStatus.adAccountsCount > 1 && !metaStatus.selectedAdAccountId));

  const showGadsSelect =
    Boolean(byProvider.get("GOOGLE_ADS")?.hasCredentials) &&
    googleAdsMeta.accessibleCustomerIds.length > 0 &&
    (forceGadsPick || googleAdsMeta.needsAccountPick);

  const gadsPickUnavailable =
    forceGadsPick &&
    Boolean(byProvider.get("GOOGLE_ADS")?.hasCredentials) &&
    googleAdsMeta.accessibleCustomerIds.length === 0;

  function metaStatusLabel(row: ConnectionRow | undefined): string {
    if (metaStatus?.health === "needs_reauth" || row?.status === "NEEDS_REAUTH") {
      return "Reconectar";
    }
    if (metaStatus?.health === "ready") return "Pronto";
    if (metaStatus?.connected) return "Conectado";
    return "Não conectado";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/config"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hairline)] text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="type-tagline text-[var(--ink)]">Integrações</h1>
      </div>

      {banner ? (
        <div
          className={`flex items-start gap-2 rounded-xl border p-4 type-fine-print ${
            metaParam === "error" || metaParam === "cancelled" || metaParam === "no_ad_account"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {banner}
        </div>
      ) : null}

      {oauthFlash && !banner ? (
        <div
          className={`flex items-start gap-2 rounded-xl border p-4 type-fine-print ${
            oauthFlash.includes("conectado")
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {oauthFlash.includes("conectado") ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {oauthFlash}
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--hairline)] bg-white p-4">
        <label className="type-fine-print text-[var(--ink-muted-48)]">Empresa</label>
        {loadingClientes ? (
          <div className="mt-2 flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <PillSelect
            className="mt-1 w-full"
            size="field"
            value={effectiveWorkspace}
            onChange={setWorkspaceId}
            options={
              workspaces.length === 0
                ? [{ value: "", label: "Nenhuma empresa — crie em Configurações" }]
                : workspaces.map((c) => ({ value: c.id, label: c.nome }))
            }
            aria-label="Empresa"
          />
        )}
      </div>

      {showMetaSelect && metaStatus ? (
        <div className="rounded-xl border border-[var(--hairline)] bg-white p-4 space-y-3">
          <h2 className="type-caption-strong text-[var(--ink)]">Conta de anúncio Meta</h2>
          <p className="type-fine-print text-[var(--ink-muted-80)]">
            {metaStatus.businessName
              ? `Portfólio: ${metaStatus.businessName}`
              : "Escolha a conta que o dashboard vai usar."}
          </p>
          <PillSelect
            size="field"
            className="w-full"
            value={selectedAdAccount}
            onChange={setSelectedAdAccount}
            options={[
              { value: "", label: "Selecione a conta" },
              ...metaStatus.adAccounts.map((a) => ({
                value: a.id,
                label: a.name || a.id,
              })),
            ]}
            aria-label="Conta de anúncio Meta"
          />
          {selectError ? <p className="type-fine-print text-red-600">{selectError}</p> : null}
          <button
            type="button"
            disabled={!selectedAdAccount || selectingAd}
            onClick={confirmMetaAdAccount}
            className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
          >
            {selectingAd ? "Salvando…" : "Continuar"}
          </button>
        </div>
      ) : null}

      {showGadsSelect ? (
        <div className="rounded-xl border border-[var(--hairline)] bg-white p-4 space-y-3">
          <h2 className="type-caption-strong text-[var(--ink)]">Conta Google Ads</h2>
          <p className="type-fine-print text-[var(--ink-muted-80)]">
            Escolha o CID que o dashboard vai usar.
          </p>
          <PillSelect
            size="field"
            className="w-full"
            value={selectedGadsCid}
            onChange={setSelectedGadsCid}
            options={[
              { value: "", label: "Selecione a conta" },
              ...googleAdsMeta.accessibleCustomerIds.map((id) => ({
                value: id,
                label: id.replace(/(\d{3})(?=\d)/g, "$1-"),
              })),
            ]}
            aria-label="Conta Google Ads"
          />
          {gadsPickError ? (
            <p className="type-fine-print text-red-600">{gadsPickError}</p>
          ) : null}
          <button
            type="button"
            disabled={!selectedGadsCid || selectingGads}
            onClick={confirmGoogleAdsCid}
            className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
          >
            {selectingGads ? "Salvando…" : "Continuar"}
          </button>
        </div>
      ) : null}

      {gadsPickUnavailable ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 type-fine-print text-amber-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Google Ads autorizado, mas nenhuma conta (CID) foi listada. Reconecte e confirme as
          permissões da conta.
        </div>
      ) : null}

      {!effectiveWorkspace ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Crie uma empresa em Configurações para gerenciar integrações.
        </div>
      ) : (
        <>
          <div>
            <h2 className="mb-3 type-caption-strong text-[var(--ink-muted-80)]">
              Canais e ferramentas
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROVIDER_CARDS.map((card) => {
                const Icon = card.icon;
                const row = byProvider.get(card.provider);
                const connected =
                  card.provider === "META_ADS"
                    ? Boolean(metaStatus?.connected)
                    : row?.status === "ACTIVE" && row.hasCredentials;
                const isMeta = card.provider === "META_ADS";
                const needsReauth =
                  isMeta &&
                  (metaStatus?.health === "needs_reauth" || row?.status === "NEEDS_REAUTH");
                return (
                  <div
                    key={card.provider}
                    className="flex flex-col rounded-xl border border-[var(--hairline)] bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--canvas-parchment)] text-[var(--ink)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="type-caption-strong text-[var(--ink)]">{card.title}</h2>
                          {connected && !needsReauth ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 type-micro-legal text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />{" "}
                              {isMeta ? metaStatusLabel(row) : "Conectado"}
                            </span>
                          ) : needsReauth ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 type-micro-legal text-amber-800">
                              Reconectar
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                              Não conectado
                            </span>
                          )}
                        </div>
                        {isMeta && metaStatus?.businessName ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            {metaStatus.businessName}
                            {metaStatus.selectedAdAccountId
                              ? ` · act_${metaStatus.selectedAdAccountId.replace(/^act_/, "")}`
                              : ""}
                          </p>
                        ) : card.provider === "GOOGLE_ADS" && googleAdsMeta.customerId ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            CID{" "}
                            {googleAdsMeta.customerId.replace(/(\d{3})(?=\d)/g, "$1-")}
                          </p>
                        ) : row?.label ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            {row.label}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {card.facebookSignup ? (
                        <button
                          type="button"
                          onClick={() =>
                            startOAuth(
                              `/config/conexoes/whatsapp-auth?workspaceId=${effectiveWorkspace}`,
                            )
                          }
                          disabled={oauthPending || !effectiveWorkspace}
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {connected ? "Reconectar" : "Conectar com Facebook"}
                        </button>
                      ) : card.connectHref ? (
                        <button
                          type="button"
                          onClick={() => startOAuth(card.connectHref!(effectiveWorkspace))}
                          disabled={oauthPending || !effectiveWorkspace}
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {needsReauth ? "Reconectar" : connected ? "Reconectar" : "Conectar"}
                        </button>
                      ) : (
                        <span className="type-fine-print text-[var(--ink-secondary)]">
                          Em breve
                        </span>
                      )}
                      {connected && card.provider === "SHOPEE" ? (
                        <button
                          type="button"
                          onClick={() => syncShopee()}
                          disabled={shopeeSyncing}
                          className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)] disabled:opacity-50"
                        >
                          {shopeeSyncing ? "Sincronizando…" : "Sincronizar"}
                        </button>
                      ) : null}
                      {connected && (card.connectHref || card.facebookSignup) ? (
                        <button
                          type="button"
                          onClick={() => disconnect(card.provider)}
                          className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)]"
                        >
                          Desconectar
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-1 type-caption-strong text-[var(--ink-muted-80)]">E-commerce</h2>
            <p className="mb-3 type-fine-print text-[var(--ink-muted-48)]">
              Conecte a loja do cliente. Pedidos Shopify, Tray, Nuvemshop e WooCommerce aparecem
              na aba E-commerce, no CRM e no financeiro.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(() => {
                const shopifyRow = byProvider.get("SHOPIFY");
                const shopifyConnected =
                  shopifyRow?.status === "ACTIVE" && shopifyRow.hasCredentials;
                const shopifyMeta =
                  shopifyRow?.metadata &&
                  typeof shopifyRow.metadata === "object" &&
                  !Array.isArray(shopifyRow.metadata)
                    ? (shopifyRow.metadata as Record<string, unknown>)
                    : {};
                const shopifyLabel =
                  (typeof shopifyMeta.shopName === "string" && shopifyMeta.shopName) ||
                  (typeof shopifyMeta.shop === "string" && shopifyMeta.shop) ||
                  shopifyRow?.label ||
                  null;
                return (
                  <div className="flex flex-col rounded-xl border border-[var(--hairline)] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--canvas-parchment)] text-[var(--ink)]">
                        <Store className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="type-caption-strong text-[var(--ink)]">Shopify</h3>
                          {shopifyConnected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 type-micro-legal text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Conectado
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                              Não conectado
                            </span>
                          )}
                        </div>
                        {shopifyLabel ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            {shopifyLabel}
                          </p>
                        ) : (
                          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                            OAuth Admin API — pedidos, clientes e produtos
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShopifyOpen((v) => !v);
                          setWooOpen(false);
                          setTrayOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {shopifyConnected ? "Reconectar" : "Conectar"}
                      </button>
                      {shopifyConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => syncShopify()}
                            disabled={shopifySyncing}
                            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)] disabled:opacity-50"
                          >
                            {shopifySyncing ? "Sincronizando…" : "Sincronizar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => disconnect("SHOPIFY")}
                            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)]"
                          >
                            Desconectar
                          </button>
                        </>
                      ) : null}
                    </div>
                    {shopifyOpen ? (
                      <div className="mt-4 space-y-2 border-t border-[var(--hairline)] pt-3">
                        <input
                          className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-fine-print"
                          placeholder="loja.myshopify.com"
                          value={shopifyShop}
                          onChange={(e) => setShopifyShop(e.target.value)}
                          aria-label="Domínio Shopify"
                        />
                        <p className="type-micro-legal text-[var(--ink-muted-48)]">
                          Informe o domínio da loja e autorize o app. Pedidos entram no CRM,
                          dashboard e financeiro.
                        </p>
                        <button
                          type="button"
                          onClick={startShopifyOAuth}
                          disabled={oauthPending || !shopifyShop.trim() || !effectiveWorkspace}
                          className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
                        >
                          {oauthPending ? "Abrindo…" : "Autorizar no Shopify"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {(() => {
                const trayRow = byProvider.get("TRAY");
                const trayConnected =
                  trayRow?.status === "ACTIVE" && trayRow.hasCredentials;
                const trayMeta =
                  trayRow?.metadata &&
                  typeof trayRow.metadata === "object" &&
                  !Array.isArray(trayRow.metadata)
                    ? (trayRow.metadata as Record<string, unknown>)
                    : {};
                const trayLabel =
                  (typeof trayMeta.storeName === "string" && trayMeta.storeName) ||
                  (typeof trayMeta.storeHost === "string" && trayMeta.storeHost) ||
                  trayRow?.label ||
                  null;
                return (
                  <div className="flex flex-col rounded-xl border border-[var(--hairline)] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--canvas-parchment)] text-[var(--ink)]">
                        <Store className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="type-caption-strong text-[var(--ink)]">Tray</h3>
                          {trayConnected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 type-micro-legal text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Conectado
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                              Não conectado
                            </span>
                          )}
                        </div>
                        {trayLabel ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            {trayLabel}
                          </p>
                        ) : (
                          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                            OAuth Tray Commerce — pedidos no CRM e financeiro
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTrayOpen((v) => !v);
                          setWooOpen(false);
                          setShopifyOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {trayConnected ? "Reconectar" : "Conectar"}
                      </button>
                      {trayConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => syncTray()}
                            disabled={traySyncing}
                            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)] disabled:opacity-50"
                          >
                            {traySyncing ? "Sincronizando…" : "Sincronizar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => disconnect("TRAY")}
                            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)]"
                          >
                            Desconectar
                          </button>
                        </>
                      ) : null}
                    </div>
                    {trayOpen ? (
                      <div className="mt-4 space-y-2 border-t border-[var(--hairline)] pt-3">
                        <input
                          className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-fine-print"
                          placeholder="minhaloja.com.br"
                          value={trayStore}
                          onChange={(e) => setTrayStore(e.target.value)}
                          aria-label="Domínio da loja Tray"
                        />
                        <p className="type-micro-legal text-[var(--ink-muted-48)]">
                          Informe o domínio da loja Tray e autorize o aplicativo.
                        </p>
                        <button
                          type="button"
                          onClick={startTrayOAuth}
                          disabled={oauthPending || !trayStore.trim() || !effectiveWorkspace}
                          className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
                        >
                          {oauthPending ? "Abrindo…" : "Autorizar na Tray"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {(() => {
                const nsRow = byProvider.get("NUVEMSHOP");
                const nsConnected =
                  nsRow?.status === "ACTIVE" && nsRow.hasCredentials;
                const nsMeta =
                  nsRow?.metadata &&
                  typeof nsRow.metadata === "object" &&
                  !Array.isArray(nsRow.metadata)
                    ? (nsRow.metadata as Record<string, unknown>)
                    : {};
                const nsLabel =
                  (typeof nsMeta.storeName === "string" && nsMeta.storeName) ||
                  (typeof nsMeta.domain === "string" && nsMeta.domain) ||
                  nsRow?.label ||
                  null;
                return (
                  <div className="flex flex-col rounded-xl border border-[var(--hairline)] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--canvas-parchment)] text-[var(--ink)]">
                        <Store className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="type-caption-strong text-[var(--ink)]">Nuvemshop</h3>
                          {nsConnected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 type-micro-legal text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Conectado
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                              Não conectado
                            </span>
                          )}
                        </div>
                        {nsLabel ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            {nsLabel}
                          </p>
                        ) : (
                          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                            OAuth Nuvemshop — pedidos no CRM e financeiro
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWooOpen(false);
                          setShopifyOpen(false);
                          setTrayOpen(false);
                          startNuvemshopOAuth();
                        }}
                        disabled={oauthPending || !effectiveWorkspace}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {oauthPending
                          ? "Abrindo…"
                          : nsConnected
                            ? "Reconectar"
                            : "Conectar"}
                      </button>
                      {nsConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => syncNuvemshop()}
                            disabled={nuvemshopSyncing}
                            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)] disabled:opacity-50"
                          >
                            {nuvemshopSyncing ? "Sincronizando…" : "Sincronizar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => disconnect("NUVEMSHOP")}
                            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)]"
                          >
                            Desconectar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })()}

              {ECOMM_CARDS.map((card) => {
                const connected = wooConnected;
                const open = wooOpen;

                return (
                  <div
                    key={card.key}
                    className="flex flex-col rounded-xl border border-[var(--hairline)] bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--canvas-parchment)] text-[var(--ink)]">
                        <Store className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="type-caption-strong text-[var(--ink)]">{card.title}</h3>
                          {connected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 type-micro-legal text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Conectado
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--canvas-parchment)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-48)]">
                              Não conectado
                            </span>
                          )}
                        </div>
                        {wooRow?.label ? (
                          <p className="mt-1 truncate type-fine-print text-[var(--ink-muted-80)]">
                            {wooRow.label}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWooOpen((v) => !v);
                          setShopifyOpen(false);
                          setTrayOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {connected ? "Atualizar" : "Conectar"}
                      </button>
                      {connected ? (
                        <button
                          type="button"
                          onClick={() => disconnect("WOOCOMMERCE")}
                          className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] hover:bg-[var(--surface-pearl)]"
                        >
                          Desconectar
                        </button>
                      ) : null}
                    </div>

                    {open ? (
                      <form
                        onSubmit={saveWoo}
                        className="mt-4 space-y-2 border-t border-[var(--hairline)] pt-3"
                      >
                        <input
                          className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-fine-print"
                          placeholder="URL da loja (https://loja.com)"
                          value={wooUrl}
                          onChange={(e) => setWooUrl(e.target.value)}
                          required
                        />
                        <input
                          className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-fine-print"
                          placeholder="Consumer Key"
                          value={wooKey}
                          onChange={(e) => setWooKey(e.target.value)}
                          required
                        />
                        <input
                          className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-fine-print"
                          placeholder="Consumer Secret"
                          value={wooSecret}
                          onChange={(e) => setWooSecret(e.target.value)}
                          required
                        />
                        <input
                          className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-fine-print"
                          placeholder="Webhook Secret (HMAC)"
                          value={wooWebhookSecret}
                          onChange={(e) => setWooWebhookSecret(e.target.value)}
                        />
                        {wooError ? <p className="text-xs text-red-600">{wooError}</p> : null}
                        <p className="type-micro-legal text-[var(--ink-muted-48)]">
                          Webhook Delivery URL:{" "}
                          <code className="type-micro-legal break-all">
                            /api/webhooks/woocommerce/{effectiveWorkspace}
                          </code>
                        </p>
                        <button
                          type="submit"
                          disabled={wooSaving}
                          className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
                        >
                          {wooSaving ? "Validando…" : "Salvar WooCommerce"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {loadingConn && effectiveWorkspace ? (
        <div className="flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Atualizando status…
        </div>
      ) : null}

      {oauthPending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="oauth-pending-title"
        >
          <div className="w-full max-w-sm rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-5">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
              <h2 id="oauth-pending-title" className="type-nav-link text-[var(--ink)]">
                Autorização em andamento
              </h2>
            </div>
            <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
              Conclua o login na janela do provedor. Esta página permanece aberta.
            </p>
            <button
              type="button"
              onClick={cancelOAuth}
              className="mt-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ConexoesHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-6 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando integrações…
        </div>
      }
    >
      <ConexoesHubInner />
    </Suspense>
  );
}
