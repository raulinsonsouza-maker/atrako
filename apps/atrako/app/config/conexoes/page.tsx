"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { TextField } from "@/components/ui/text-field";
import {
  ResendConnectionCard,
  fetchResendStatus,
  resendStatusKey,
} from "@/components/relacionamento/ResendConnectionCard";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";
import { useModules } from "@/hooks/useModules";
import { moduleForConnection } from "@/lib/modules/registry";
import type { AtrakoOAuthMessage } from "@/lib/oauth/openOAuthPopup";
import { parseGoogleAdsConnectionMetadata } from "@/lib/googleAds/types";
import { ConfigPage } from "../_components";

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

type Category = "loja" | "marketplace" | "pagamentos" | "anuncios" | "comunicacao" | "agenda";
type ItemState = "on" | "attention" | "off";

type Item = {
  provider: string;
  title: string;
  category: Category;
  /** Uma linha: o que a integração faz (só aparece quando desconectada). */
  hint: string;
  state: ItemState;
  detail?: string | null;
  /** Conexão direta (OAuth). Sem isso, "Conectar" abre o painel. */
  onConnect?: () => void;
  onReconnect?: () => void;
  panel?: React.ReactNode;
  actions?: React.ReactNode;
  disconnectable?: boolean;
  /** Painel aberto sem clique (ex.: escolher conta de anúncio). */
  forceOpen?: boolean;
};

const CATEGORIES: Array<{ id: Category; title: string }> = [
  { id: "loja", title: "Loja própria" },
  { id: "marketplace", title: "Marketplaces" },
  { id: "pagamentos", title: "Pagamentos" },
  { id: "anuncios", title: "Anúncios" },
  { id: "comunicacao", title: "Comunicação" },
  { id: "agenda", title: "Agenda" },
];

const STATE_ORDER: Record<ItemState, number> = { attention: 0, on: 1, off: 2 };

const PROVIDER_ORDER = [
  "SHOPIFY",
  "NUVEMSHOP",
  "TRAY",
  "WOOCOMMERCE",
  "MERCADO_LIVRE",
  "SHOPEE",
  "TIKTOK_SHOP",
  "MERCADO_PAGO",
  "META_ADS",
  "GOOGLE_ADS",
  "LINKEDIN_ADS",
  "WHATSAPP",
  "INSTAGRAM",
  "RESEND",
  "GOOGLE_CALENDAR",
];

function compareItems(a: Item, b: Item) {
  return (
    STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
    PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider)
  );
}

const OAUTH: Array<{ provider: string; title: string; category: Category; hint: string; start: string }> = [
  { provider: "INSTAGRAM", title: "Instagram", category: "comunicacao", hint: "Direct e automações", start: "instagram" },
  { provider: "MERCADO_PAGO", title: "Mercado Pago", category: "pagamentos", hint: "Checkout e cobranças", start: "mercadopago" },
  { provider: "GOOGLE_CALENDAR", title: "Google Calendar", category: "agenda", hint: "Agenda e reservas", start: "google-calendar" },
  { provider: "MERCADO_LIVRE", title: "Mercado Livre", category: "marketplace", hint: "Pedidos do marketplace", start: "mercadolivre" },
  { provider: "SHOPEE", title: "Shopee", category: "marketplace", hint: "Pedidos do marketplace", start: "shopee" },
  { provider: "TIKTOK_SHOP", title: "TikTok Shop", category: "marketplace", hint: "Pedidos do marketplace", start: "tiktok-shop" },
  { provider: "LINKEDIN_ADS", title: "LinkedIn Ads", category: "anuncios", hint: "Campanhas e investimento", start: "linkedin" },
];

const SYNC_PATHS: Record<string, string> = {
  SHOPIFY: "/api/atrako/shopify/sync",
  TRAY: "/api/atrako/tray/sync",
  NUVEMSHOP: "/api/atrako/nuvemshop/sync",
  SHOPEE: "/api/atrako/shopee/sync",
  TIKTOK_SHOP: "/api/atrako/tiktok-shop/sync",
};

const smallPrimary = "!px-4 !py-1.5 type-button-utility";
const smallOutline = "!px-4 !py-1.5 type-button-utility";

function rowState(row: ConnectionRow | undefined): ItemState {
  if (!row?.hasCredentials) return "off";
  if (row.status === "NEEDS_REAUTH" || row.status === "SYNC_ERROR" || row.status === "ERROR") {
    return "attention";
  }
  return row.status === "ACTIVE" || row.status === "SYNCING" ? "on" : "off";
}

function metaOf(row: ConnectionRow | undefined): Record<string, unknown> {
  return row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function Notice({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-4 type-fine-print text-[var(--ink)]">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
      )}
      <span>{children}</span>
    </div>
  );
}

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

function formatGadsCid(id: string): string {
  const d = id.replace(/\D/g, "");
  if (d.length !== 10) return d || id;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function gadsAccountOptionLabel(a: { id: string; name: string; manager?: boolean }): string {
  const cid = formatGadsCid(a.id);
  const name = a.name.trim();
  const nameIsCid = name.replace(/\D/g, "") === a.id.replace(/\D/g, "");
  const mcc = a.manager ? " (MCC)" : "";
  if (nameIsCid || !name) return `${cid}${mcc}`;
  return `${name}${mcc} · ${cid}`;
}

function IntegrationRow({
  item,
  open,
  first,
  pending,
  onToggle,
  onDisconnect,
}: {
  item: Item;
  open: boolean;
  first: boolean;
  pending: boolean;
  onToggle: () => void;
  onDisconnect: () => void;
}) {
  const connected = item.state !== "off";
  const expanded = open || Boolean(item.forceOpen);
  const showFooter = connected && (item.actions || item.onReconnect || item.disconnectable);

  return (
    <li className={first ? "" : "border-t border-[var(--divider-soft)]"}>
      <div className="flex items-center gap-3 px-4 py-3">
        <BrandLogo provider={item.provider} />
        <div className="min-w-0 flex-1">
          <p className="type-caption-strong text-[var(--ink)]">{item.title}</p>
          {item.state === "off" ? (
            <p className="truncate type-fine-print text-[var(--ink-muted-48)]">{item.hint}</p>
          ) : (
            <p className="flex min-w-0 items-center gap-1.5 type-fine-print text-[var(--ink-muted-80)]">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  item.state === "on" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
                }`}
                aria-hidden
              />
              <span className="truncate">
                {(item.detail && item.detail !== item.title ? item.detail : null) ||
                  (item.state === "on" ? "Conectado" : "Precisa de atenção")}
              </span>
            </p>
          )}
        </div>
        {item.state === "off" && item.onConnect ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={item.onConnect}>
            Conectar
          </Button>
        ) : item.state === "off" ? (
          <Button type="button" variant="ghost" onClick={onToggle}>
            {open ? "Cancelar" : "Conectar"}
          </Button>
        ) : item.forceOpen ? null : (
          <Button type="button" variant="ghost" onClick={onToggle}>
            {open ? "Fechar" : "Gerenciar"}
          </Button>
        )}
      </div>

      {expanded && (item.panel || showFooter) ? (
        <div className="space-y-3 border-t border-[var(--divider-soft)] bg-[var(--canvas-parchment)] px-4 py-4">
          {item.panel}
          {showFooter ? (
            <div className="flex flex-wrap items-center gap-2">
              {item.actions}
              {item.onReconnect ? (
                <Button
                  type="button"
                  variant="outline"
                  className={smallOutline}
                  disabled={pending}
                  onClick={item.onReconnect}
                >
                  Reconectar
                </Button>
              ) : null}
              {item.disconnectable ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="!text-[var(--danger)]"
                  onClick={onDisconnect}
                >
                  Desconectar
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ConexoesHubInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { workspaceId, setWorkspaceId, isLoading: loadingClientes } = useActiveWorkspace();
  const { isEnabled: isModuleEnabled } = useModules();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [selectingAd, setSelectingAd] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [selectedGadsCid, setSelectedGadsCid] = useState("");
  const [selectingGads, setSelectingGads] = useState(false);
  const [gadsPickError, setGadsPickError] = useState<string | null>(null);
  const [forceGadsPick, setForceGadsPick] = useState(false);
  const gadsNamesRefreshTried = useRef(false);

  const [wooUrl, setWooUrl] = useState("");
  const [wooKey, setWooKey] = useState("");
  const [wooSecret, setWooSecret] = useState("");
  const [wooWebhookSecret, setWooWebhookSecret] = useState("");
  const [wooSaving, setWooSaving] = useState(false);
  const [wooError, setWooError] = useState<string | null>(null);

  const [shopifyShop, setShopifyShop] = useState("");
  const [trayStore, setTrayStore] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);
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
      if (!("workspaceId" in msg)) return;
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

  const { data: resendStatus } = useQuery({
    queryKey: resendStatusKey(effectiveWorkspace ?? ""),
    queryFn: () => fetchResendStatus(effectiveWorkspace ?? ""),
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
    const meta = parseGoogleAdsConnectionMetadata(row?.metadata);
    return {
      ...meta,
      accounts: meta.accessibleCustomers,
      customerId: meta.customerId ?? "",
      loginCustomerId: meta.loginCustomerId ?? "",
    };
  }, [byProvider]);

  useEffect(() => {
    if (googleAdsMeta.customerId) {
      setSelectedGadsCid(googleAdsMeta.customerId);
    } else if (googleAdsMeta.accessibleCustomerIds.length === 1) {
      setSelectedGadsCid(googleAdsMeta.accessibleCustomerIds[0]);
    }
  }, [googleAdsMeta.customerId, googleAdsMeta.accessibleCustomerIds]);

  // Metadata antigo / query sem MCC → nomes = CID. Re-busca descriptive_name sem novo OAuth.
  useEffect(() => {
    gadsNamesRefreshTried.current = false;
  }, [effectiveWorkspace]);

  useEffect(() => {
    if (!effectiveWorkspace || gadsNamesRefreshTried.current) return;
    if (!byProvider.get("GOOGLE_ADS")?.hasCredentials) return;
    if (googleAdsMeta.accounts.length === 0) return;
    const needsNames = googleAdsMeta.accounts.some(
      (a) => a.name.replace(/\D/g, "") === a.id.replace(/\D/g, ""),
    );
    if (!needsNames) return;
    gadsNamesRefreshTried.current = true;
    void (async () => {
      try {
        const r = await fetch("/api/atrako/oauth/google-ads/refresh-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: effectiveWorkspace }),
        });
        if (r.ok) {
          qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
        }
      } catch {
        /* silencioso — usuário ainda vê CIDs */
      }
    })();
  }, [effectiveWorkspace, byProvider, googleAdsMeta.accounts, qc]);

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
      const picked = googleAdsMeta.accounts.find((a) => a.id === selectedGadsCid);
      const r = await fetch("/api/atrako/oauth/google-ads/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: effectiveWorkspace,
          customerId: selectedGadsCid,
          loginCustomerId: picked?.loginCustomerId || googleAdsMeta.loginCustomerId || undefined,
          customerName: picked?.name || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível salvar a conta.");
      setForceGadsPick(false);
      const syncError = typeof j.error === "string" ? j.error : null;
      setOauthFlash(
        syncError
          ? `Google Ads conectado, mas a sincronização falhou: ${syncError}`
          : `Google Ads conectado. ${Number(j.daysProcessed ?? 0)} dias e ${Number(j.campaignsProcessed ?? 0)} campanhas sincronizados.`,
      );
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
      const imported = Number(j.initialSync?.processed ?? 0);
      const syncMessage = j.syncError
        ? `Falha na carga inicial: ${j.syncError}`
        : `${imported} pedidos importados na carga inicial.`;
      const webhookMessage = j.webhookError
        ? `Webhooks não registrados: ${j.webhookError}`
        : "Webhooks de novos pedidos ativos.";
      const hasConnectionWarnings = Boolean(j.syncError || j.webhookError);
      setOauthFlash(
        hasConnectionWarnings
          ? `WooCommerce conectado com pendências. ${syncMessage} ${webhookMessage}`
          : `WooCommerce conectado. ${syncMessage} ${webhookMessage}`,
      );
      setOpenKey(null);
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

  async function syncProvider(provider: string, title: string) {
    if (!effectiveWorkspace) return;
    setSyncing(provider);
    try {
      const r = await fetch(SYNC_PATHS[provider], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspace }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao sincronizar");
      setOauthFlash(`${title} sincronizado.`);
      qc.invalidateQueries({ queryKey: ["workspace-connections", effectiveWorkspace] });
    } catch (err) {
      setOauthFlash(err instanceof Error ? err.message : `Erro ao sincronizar ${title}`);
    } finally {
      setSyncing(null);
    }
  }

  function startShopifyOAuth(shop: string) {
    if (!effectiveWorkspace || !shop.trim()) return;
    const q = new URLSearchParams({ workspaceId: effectiveWorkspace, shop: shop.trim() });
    startOAuth(`/api/atrako/oauth/shopify/start?${q}`);
  }

  function startTrayOAuth(store: string) {
    if (!effectiveWorkspace || !store.trim()) return;
    const q = new URLSearchParams({ workspaceId: effectiveWorkspace, store: store.trim() });
    startOAuth(`/api/atrako/oauth/tray/start?${q}`);
  }

  function oauthHref(start: string) {
    return `/api/atrako/oauth/${start}/start?workspaceId=${encodeURIComponent(effectiveWorkspace ?? "")}`;
  }

  async function confirmDisconnect(item: Item) {
    if (!confirm(`Desconectar ${item.title}?`)) return;
    await disconnect(item.provider);
    setOpenKey(null);
  }

  const banner = metaBannerMessage(metaParam, metaErrorParam);
  const showMetaSelect =
    metaStatus?.connected &&
    (metaStatus.health === "connected_pending_account" ||
      metaParam === "select_account" ||
      (metaStatus.adAccountsCount > 1 && !metaStatus.selectedAdAccountId));

  const gadsRow = byProvider.get("GOOGLE_ADS");
  const showGadsSelect =
    Boolean(gadsRow?.hasCredentials) &&
    googleAdsMeta.accounts.length > 0 &&
    (forceGadsPick || googleAdsMeta.needsAccountPick || !googleAdsMeta.customerId);

  const gadsPickUnavailable =
    Boolean(gadsRow?.hasCredentials) &&
    !googleAdsMeta.customerId &&
    googleAdsMeta.accessibleCustomerIds.length === 0;

  function syncButton(provider: string, title: string) {
    return (
      <Button
        type="button"
        variant="outline"
        className={smallOutline}
        disabled={syncing !== null}
        onClick={() => void syncProvider(provider, title)}
      >
        {syncing === provider ? "Sincronizando…" : "Sincronizar"}
      </Button>
    );
  }

  function storeDomainPanel(opts: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    cta: string;
    onSubmit: () => void;
  }) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          opts.onSubmit();
        }}
      >
        <TextField
          label={opts.label}
          placeholder={opts.placeholder}
          value={opts.value}
          onChange={(e) => opts.onChange(e.target.value)}
          autoFocus
        />
        <Button
          type="submit"
          variant="primary"
          className={smallPrimary}
          disabled={oauthPending || !opts.value.trim()}
        >
          {oauthPending ? "Abrindo…" : opts.cta}
        </Button>
      </form>
    );
  }

  const items: Item[] = [];

  {
    const row = byProvider.get("WHATSAPP");
    items.push({
      provider: "WHATSAPP",
      title: "WhatsApp",
      category: "comunicacao",
      hint: "Atendimento e mensagens",
      state: rowState(row),
      detail: row?.label,
      onConnect: () => startOAuth(`/config/conexoes/whatsapp-auth?workspaceId=${effectiveWorkspace}`),
      onReconnect: () => startOAuth(`/config/conexoes/whatsapp-auth?workspaceId=${effectiveWorkspace}`),
      disconnectable: true,
    });
  }

  for (const p of OAUTH) {
    const row = byProvider.get(p.provider);
    items.push({
      provider: p.provider,
      title: p.title,
      category: p.category,
      hint: p.hint,
      state: rowState(row),
      detail: row?.label,
      onConnect: () => startOAuth(oauthHref(p.start)),
      onReconnect: () => startOAuth(oauthHref(p.start)),
      actions: SYNC_PATHS[p.provider] ? syncButton(p.provider, p.title) : undefined,
      disconnectable: true,
    });
  }

  {
    const connected = Boolean(resendStatus?.connected);
    const verified = resendStatus?.domainStatus === "verified";
    items.push({
      provider: "RESEND",
      title: "Resend",
      category: "comunicacao",
      hint: "E-mails com o domínio da loja",
      state: !connected ? "off" : verified ? "on" : "attention",
      detail: connected
        ? verified
          ? resendStatus?.fromEmail || "Pronto para enviar"
          : "Domínio pendente de verificação"
        : null,
      panel: effectiveWorkspace ? (
        <ResendConnectionCard workspaceId={effectiveWorkspace} embedded />
      ) : null,
    });
  }

  {
    const row = byProvider.get("SHOPIFY");
    const meta = metaOf(row);
    const savedShop = str(meta.shop);
    const state = rowState(row);
    items.push({
      provider: "SHOPIFY",
      title: "Shopify",
      category: "loja",
      hint: "Pedidos, clientes e produtos",
      state,
      detail: str(meta.shopName) || savedShop || row?.label,
      panel:
        state === "off"
          ? storeDomainPanel({
              label: "Domínio da loja",
              placeholder: "loja.myshopify.com",
              value: shopifyShop,
              onChange: setShopifyShop,
              cta: "Autorizar no Shopify",
              onSubmit: () => startShopifyOAuth(shopifyShop),
            })
          : null,
      onReconnect: savedShop ? () => startShopifyOAuth(savedShop) : undefined,
      actions: syncButton("SHOPIFY", "Shopify"),
      disconnectable: true,
    });
  }

  {
    const row = byProvider.get("TRAY");
    const meta = metaOf(row);
    const savedStore = str(meta.storeHost);
    const state = rowState(row);
    items.push({
      provider: "TRAY",
      title: "Tray",
      category: "loja",
      hint: "Pedidos, clientes e produtos",
      state,
      detail: str(meta.storeName) || savedStore || row?.label,
      panel:
        state === "off"
          ? storeDomainPanel({
              label: "Domínio da loja",
              placeholder: "minhaloja.com.br",
              value: trayStore,
              onChange: setTrayStore,
              cta: "Autorizar na Tray",
              onSubmit: () => startTrayOAuth(trayStore),
            })
          : null,
      onReconnect: savedStore ? () => startTrayOAuth(savedStore) : undefined,
      actions: syncButton("TRAY", "Tray"),
      disconnectable: true,
    });
  }

  {
    const row = byProvider.get("NUVEMSHOP");
    const meta = metaOf(row);
    items.push({
      provider: "NUVEMSHOP",
      title: "Nuvemshop",
      category: "loja",
      hint: "Pedidos, clientes e produtos",
      state: rowState(row),
      detail: str(meta.storeName) || str(meta.domain) || row?.label,
      onConnect: () => startOAuth(oauthHref("nuvemshop")),
      onReconnect: () => startOAuth(oauthHref("nuvemshop")),
      actions: syncButton("NUVEMSHOP", "Nuvemshop"),
      disconnectable: true,
    });
  }

  {
    const row = byProvider.get("WOOCOMMERCE");
    const state = rowState(row);
    items.push({
      provider: "WOOCOMMERCE",
      title: "WooCommerce",
      category: "loja",
      hint: "Pedidos, clientes e produtos",
      state,
      detail: row?.label,
      panel: (
        <form onSubmit={saveWoo} className="space-y-3">
          {state !== "off" ? (
            <p className="type-caption-strong text-[var(--ink)]">Atualizar credenciais</p>
          ) : null}
          <TextField
            label="URL da loja"
            placeholder="https://loja.com"
            value={wooUrl}
            onChange={(e) => setWooUrl(e.target.value)}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Consumer Key"
              value={wooKey}
              onChange={(e) => setWooKey(e.target.value)}
              required
            />
            <TextField
              label="Consumer Secret"
              type="password"
              autoComplete="off"
              value={wooSecret}
              onChange={(e) => setWooSecret(e.target.value)}
              required
            />
          </div>
          <TextField
            label="Webhook Secret (opcional)"
            type="password"
            autoComplete="off"
            value={wooWebhookSecret}
            onChange={(e) => setWooWebhookSecret(e.target.value)}
            hint={
              <>
                URL do webhook:{" "}
                <code className="break-all">/api/webhooks/woocommerce/{effectiveWorkspace}</code>
              </>
            }
          />
          {wooError ? <p className="type-fine-print text-[var(--danger)]">{wooError}</p> : null}
          <Button type="submit" variant="primary" className={smallPrimary} disabled={wooSaving}>
            {wooSaving ? "Validando…" : state === "off" ? "Conectar loja" : "Salvar"}
          </Button>
        </form>
      ),
      disconnectable: true,
    });
  }

  {
    const row = byProvider.get("META_ADS");
    const connected = Boolean(metaStatus?.connected);
    const needsReauth = metaStatus?.health === "needs_reauth" || row?.status === "NEEDS_REAUTH";
    const account = metaStatus?.selectedAdAccountId
      ? `act_${metaStatus.selectedAdAccountId.replace(/^act_/, "")}`
      : null;
    items.push({
      provider: "META_ADS",
      title: "Meta Ads",
      category: "anuncios",
      hint: "Campanhas e investimento",
      state: !connected ? "off" : needsReauth || showMetaSelect ? "attention" : "on",
      detail: needsReauth
        ? "Reconecte a conta"
        : showMetaSelect
          ? "Escolha a conta de anúncio"
          : [metaStatus?.businessName, account].filter(Boolean).join(" · ") || null,
      onConnect: () => startOAuth(oauthHref("meta")),
      onReconnect: () => startOAuth(oauthHref("meta")),
      forceOpen: Boolean(showMetaSelect),
      panel:
        showMetaSelect && metaStatus ? (
          <div className="space-y-3">
            <PillSelect
              size="field"
              className="w-full"
              value={selectedAdAccount}
              onChange={setSelectedAdAccount}
              options={[
                { value: "", label: "Selecione a conta de anúncio" },
                ...metaStatus.adAccounts.map((a) => ({ value: a.id, label: a.name || a.id })),
              ]}
              aria-label="Conta de anúncio Meta"
            />
            {selectError ? (
              <p className="type-fine-print text-[var(--danger)]">{selectError}</p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className={smallPrimary}
              disabled={!selectedAdAccount || selectingAd}
              onClick={confirmMetaAdAccount}
            >
              {selectingAd ? "Salvando…" : "Usar esta conta"}
            </Button>
          </div>
        ) : null,
      disconnectable: true,
    });
  }

  {
    const row = gadsRow;
    const connected = Boolean(row?.hasCredentials);
    const syncError = googleAdsMeta.lastSyncError;
    const attention =
      showGadsSelect || gadsPickUnavailable || Boolean(syncError) || row?.status === "SYNC_ERROR";
    const name =
      googleAdsMeta.customerName &&
      googleAdsMeta.customerName.replace(/\D/g, "") !== googleAdsMeta.customerId
        ? googleAdsMeta.customerName
        : null;
    items.push({
      provider: "GOOGLE_ADS",
      title: "Google Ads",
      category: "anuncios",
      hint: "Campanhas e investimento",
      state: !connected ? "off" : attention ? "attention" : "on",
      detail: showGadsSelect
        ? "Escolha a conta (CID)"
        : gadsPickUnavailable
          ? "Nenhuma conta encontrada"
          : syncError
            ? "Falha na sincronização"
            : row?.status === "SYNCING"
              ? "Sincronizando…"
              : googleAdsMeta.customerId
                ? [name, formatGadsCid(googleAdsMeta.customerId)].filter(Boolean).join(" · ")
                : null,
      onConnect: () => startOAuth(oauthHref("google-ads")),
      onReconnect: () => startOAuth(oauthHref("google-ads")),
      forceOpen: showGadsSelect,
      panel:
        showGadsSelect || gadsPickUnavailable || syncError ? (
          <div className="space-y-3">
            {showGadsSelect ? (
              <>
                <PillSelect
                  size="field"
                  className="w-full"
                  value={selectedGadsCid}
                  onChange={setSelectedGadsCid}
                  options={[
                    { value: "", label: "Selecione a conta" },
                    ...googleAdsMeta.accounts
                      .filter((a) => !a.manager)
                      .map((a) => ({ value: a.id, label: gadsAccountOptionLabel(a) })),
                  ]}
                  aria-label="Conta Google Ads"
                />
                {gadsPickError ? (
                  <p className="type-fine-print text-[var(--danger)]">{gadsPickError}</p>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  className={smallPrimary}
                  disabled={!selectedGadsCid || selectingGads}
                  onClick={confirmGoogleAdsCid}
                >
                  {selectingGads ? "Salvando…" : "Usar esta conta"}
                </Button>
              </>
            ) : null}
            {gadsPickUnavailable ? (
              <p className="type-fine-print text-[var(--ink-muted-80)]">
                Autorizado, mas nenhuma conta Ads foi listada
                {googleAdsMeta.listError ? ` (${googleAdsMeta.listError})` : ""}. Reconecte após
                liberar o Google Ads API no Cloud project.
              </p>
            ) : null}
            {syncError ? (
              <p className="type-fine-print text-[var(--danger)]">{syncError}</p>
            ) : null}
          </div>
        ) : null,
      actions:
        googleAdsMeta.customerId && row?.status === "SYNC_ERROR" ? (
          <Button
            type="button"
            variant="outline"
            className={smallOutline}
            disabled={selectingGads}
            onClick={confirmGoogleAdsCid}
          >
            {selectingGads ? "Sincronizando…" : "Tentar de novo"}
          </Button>
        ) : undefined,
      disconnectable: true,
    });
  }

  function renderList(list: Item[]) {
    return (
      <ul className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--canvas)]">
        {list.map((item, i) => (
          <IntegrationRow
            key={item.provider}
            item={item}
            first={i === 0}
            open={openKey === item.provider}
            pending={oauthPending || !effectiveWorkspace}
            onToggle={() => setOpenKey((k) => (k === item.provider ? null : item.provider))}
            onDisconnect={() => void confirmDisconnect(item)}
          />
        ))}
      </ul>
    );
  }

  return (
    <ConfigPage title="Integrações" loading={loadingClientes || (loadingConn && !connectionsData)}>
      {banner ? (
        <Notice
          ok={!(metaParam === "error" || metaParam === "cancelled" || metaParam === "no_ad_account")}
        >
          {banner}
        </Notice>
      ) : null}

      {oauthFlash && !banner ? (
        <Notice ok={oauthFlash.includes("conectado") && !oauthFlash.includes("pendências")}>
          {oauthFlash}
        </Notice>
      ) : null}

      {!effectiveWorkspace ? (
        <Notice ok={false}>Crie uma empresa em Configuração para gerenciar integrações.</Notice>
      ) : (
        <>
          {CATEGORIES.map((cat) => {
            const list = items
              .filter((i) => i.category === cat.id)
              .filter((i) => {
                const mod = moduleForConnection(i.category, i.provider);
                return !mod || isModuleEnabled(mod.key);
              })
              .sort(compareItems);
            if (!list.length) return null;
            const active = list.filter((i) => i.state !== "off").length;
            return (
              <section key={cat.id} className="space-y-2">
                <h2 className="flex items-baseline justify-between px-1">
                  <span className="type-caption-strong text-[var(--ink-muted-80)]">{cat.title}</span>
                  {active ? (
                    <span className="type-fine-print text-[var(--ink-muted-48)]">
                      {active === 1 ? "1 conectada" : `${active} conectadas`}
                    </span>
                  ) : null}
                </h2>
                {renderList(list)}
              </section>
            );
          })}
        </>
      )}

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
            <Button type="button" variant="outline" onClick={cancelOAuth} className="mt-4">
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </ConfigPage>
  );
}

export default function ConexoesHubPage() {
  return (
    <Suspense
      fallback={
        <ConfigPage title="Integrações" loading>
          {null}
        </ConfigPage>
      }
    >
      <ConexoesHubInner />
    </Suspense>
  );
}
