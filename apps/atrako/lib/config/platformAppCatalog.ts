/** Catálogo UI dos PlatformApps — seguro no client (sem secrets). */

import type { PlatformAppProvider } from "@/lib/config/platformAppProviders";
import { PLATFORM_APP_PROVIDERS } from "@/lib/config/platformAppProviders";

export type PlatformAppFieldKey =
  | "label"
  | "clientId"
  | "clientSecret"
  | "developerToken"
  | "loginConfigId"
  | "whatsappLoginConfigId"
  | "redirectUri"
  | "webhookSecret"
  | "webhookVerifyToken"
  | "serviceAccountJson"
  | "refreshToken"
  | "loginCustomerId"
  | "scopes"
  | "apiVersion"
  | "apiBaseUrl"
  | "partnerKeyExpiresAt";

export type PlatformAppField = {
  key: PlatformAppFieldKey;
  label: string;
  hint?: string;
  secret?: boolean;
  /** Obrigatório para considerar o app pronto (quando habilitado). */
  requiredForReady?: boolean;
  multiline?: boolean;
};

export type PlatformAppCatalogEntry = {
  provider: PlatformAppProvider;
  title: string;
  description: string;
  fields: PlatformAppField[];
  /** Não listar em /admin/apps (legado / redundante). */
  hideInAdmin?: boolean;
  /**
   * Client OAuth pode ser herdado deste provider (mesmo Client Web no Google Cloud).
   * Ex.: Calendar usa o Client do Google Ads.
   */
  inheritsOAuthFrom?: PlatformAppProvider;
};

export const PLATFORM_APP_CATALOG: Record<PlatformAppProvider, PlatformAppCatalogEntry> = {
  META: {
    provider: "META",
    title: "Meta",
    description: "Instagram, WhatsApp e Meta Ads — App ID e Secret do app Meta.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "clientId",
        label: "App ID",
        hint: "Identificador do app no Meta for Developers",
        requiredForReady: true,
      },
      {
        key: "clientSecret",
        label: "App Secret",
        secret: true,
        requiredForReady: true,
      },
      {
        key: "loginConfigId",
        label: "Login Config ID (Ads)",
        hint: "Facebook Login for Business — variação Ads / System User",
        requiredForReady: true,
      },
      {
        key: "whatsappLoginConfigId",
        label: "Login Config ID (WhatsApp)",
        hint: "Facebook Login for Business → Embedded Signup (WhatsApp)",
      },
      {
        key: "webhookVerifyToken",
        label: "Token de verificação do webhook",
        hint: "Usado no GET de verificação do webhook Meta",
        secret: true,
      },
      {
        key: "webhookSecret",
        label: "Webhook secret (assinatura)",
        hint: "Geralmente o mesmo App Secret",
        secret: true,
      },
    ],
  },
  GOOGLE: {
    provider: "GOOGLE",
    title: "Google OAuth",
    description: "Legado — use Google Ads como Client OAuth único.",
    hideInAdmin: true,
    fields: [
      { key: "label", label: "Nome de exibição" },
      { key: "clientId", label: "Client ID", requiredForReady: true },
      { key: "clientSecret", label: "Client Secret", secret: true, requiredForReady: true },
    ],
  },
  GOOGLE_ADS: {
    provider: "GOOGLE_ADS",
    title: "Google Ads",
    description: "Client OAuth (Cliente Web).",
    fields: [
      { key: "label", label: "Nome de exibição" },
      { key: "clientId", label: "Client ID", requiredForReady: true },
      { key: "clientSecret", label: "Client Secret", secret: true, requiredForReady: true },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "https://atrako.com.br/api/atrako/oauth/google-ads/callback",
      },
      {
        key: "developerToken",
        label: "Developer Token (legado)",
        hint: "Opcional — Google ignora desde set/2026",
        secret: true,
      },
      {
        key: "loginCustomerId",
        label: "Login Customer ID (MCC)",
        hint: "Opcional — legado; dealers usam a própria conta",
      },
    ],
  },
  GOOGLE_CALENDAR: {
    provider: "GOOGLE_CALENDAR",
    title: "Google Calendar",
    description: "Herda o Client do Google Ads.",
    inheritsOAuthFrom: "GOOGLE_ADS",
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "clientId",
        label: "Client ID (opcional)",
        hint: "Vazio = herda do Google Ads",
      },
      {
        key: "clientSecret",
        label: "Client Secret (opcional)",
        hint: "Vazio = herda do Google Ads",
        secret: true,
      },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "https://atrako.com.br/api/atrako/oauth/google-calendar/callback",
      },
    ],
  },
  GOOGLE_ANALYTICS: {
    provider: "GOOGLE_ANALYTICS",
    title: "Google Analytics",
    description: "Service account JSON (GA4).",
    /** Só mostra quando houver SA ou for habilitado — evita ruído Desabilitado. */
    hideInAdmin: true,
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "serviceAccountJson",
        label: "Service account (JSON)",
        hint: "JSON da conta de serviço com acesso às propriedades GA4",
        secret: true,
        multiline: true,
        requiredForReady: true,
      },
    ],
  },
  MERCADO_PAGO: {
    provider: "MERCADO_PAGO",
    title: "Mercado Pago",
    description: "OAuth e webhooks de pagamento para a loja do dealer.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      { key: "clientId", label: "Client ID (Application ID)", requiredForReady: true },
      { key: "clientSecret", label: "Client Secret", secret: true, requiredForReady: true },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "Ex.: https://atrako.com.br/api/atrako/oauth/mercadopago/callback",
      },
      {
        key: "webhookSecret",
        label: "Webhook secret",
        hint: "Opcional — assinatura das notificações (Webhooks no painel MP)",
        secret: true,
      },
    ],
  },
  MERCADO_LIVRE: {
    provider: "MERCADO_LIVRE",
    title: "Mercado Livre",
    description: "OAuth do marketplace Mercado Livre.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      { key: "clientId", label: "Client ID (App ID)", requiredForReady: true },
      { key: "clientSecret", label: "Client Secret", secret: true, requiredForReady: true },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "URI cadastrada no app ML",
      },
    ],
  },
  LINKEDIN: {
    provider: "LINKEDIN",
    title: "LinkedIn Ads",
    description: "OAuth do app LinkedIn Marketing.",
    hideInAdmin: true,
    fields: [
      { key: "label", label: "Nome de exibição" },
      { key: "clientId", label: "Client ID", requiredForReady: true },
      { key: "clientSecret", label: "Client Secret", secret: true, requiredForReady: true },
    ],
  },
  TIKTOK: {
    provider: "TIKTOK",
    title: "TikTok",
    description: "App TikTok Ads / Marketing (quando ativado).",
    hideInAdmin: true,
    fields: [
      { key: "label", label: "Nome de exibição" },
      { key: "clientId", label: "App ID / Client key", requiredForReady: true },
      { key: "clientSecret", label: "App Secret", secret: true, requiredForReady: true },
    ],
  },
  WOOCOMMERCE: {
    provider: "WOOCOMMERCE",
    title: "WooCommerce",
    description: "Sem app OAuth central — cada dealer informa a loja em Config → Conexões.",
    fields: [{ key: "label", label: "Nome de exibição" }],
  },
  SHOPIFY: {
    provider: "SHOPIFY",
    title: "Shopify",
    description: "OAuth Admin API — pedidos, clientes e produtos no CRM, dashboard e financeiro.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "clientId",
        label: "API key (Client ID)",
        hint: "Shopify Partners → App → Client ID",
        requiredForReady: true,
      },
      {
        key: "clientSecret",
        label: "API secret key",
        hint: "Usado no OAuth e HMAC de webhooks",
        secret: true,
        requiredForReady: true,
      },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "https://atrako.com.br/api/atrako/oauth/shopify/callback",
      },
      {
        key: "scopes",
        label: "Scopes",
        hint: "read_orders,read_products,read_customers,read_fulfillments",
      },
      {
        key: "apiVersion",
        label: "API version",
        hint: "2026-07",
      },
    ],
  },
  SHOPEE: {
    provider: "SHOPEE",
    title: "Shopee",
    description: "OAuth Open Platform V2 — pedidos no CRM, Marketplaces e financeiro.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "clientId",
        label: "Partner ID",
        hint: "Shopee Open Platform → App → Partner ID",
        requiredForReady: true,
      },
      {
        key: "clientSecret",
        label: "Partner Key",
        hint: "HMAC + OAuth — nunca no frontend; validade típica 180 dias",
        secret: true,
        requiredForReady: true,
      },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "https://atrako.com.br/api/atrako/oauth/shopee/callback",
      },
      {
        key: "apiBaseUrl",
        label: "API base URL",
        hint: "https://partner.shopeemobile.com (ou partner.test-stable.shopeemobile.com)",
      },
      {
        key: "partnerKeyExpiresAt",
        label: "Partner Key expira em",
        hint: "ISO date (YYYY-MM-DD) — alerta no admin",
      },
    ],
  },
  TRAY: {
    provider: "TRAY",
    title: "Tray",
    description:
      "OAuth Tray Commerce — pedidos no CRM, E-commerce e financeiro. Webhook app-level cadastrado na Tray.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "clientId",
        label: "Consumer Key",
        hint: "Enviado por e-mail após cadastro do app parceiro",
        requiredForReady: true,
      },
      {
        key: "clientSecret",
        label: "Consumer Secret",
        hint: "Nunca no frontend",
        secret: true,
        requiredForReady: true,
      },
      {
        key: "redirectUri",
        label: "URL de callback",
        hint: "https://atrako.com.br/api/atrako/oauth/tray/callback",
      },
    ],
  },
  NUVEMSHOP: {
    provider: "NUVEMSHOP",
    title: "Nuvemshop",
    description:
      "OAuth Nuvemshop/Tiendanube — pedidos no CRM, E-commerce e financeiro.",
    fields: [
      { key: "label", label: "Nome de exibição" },
      {
        key: "clientId",
        label: "App ID (Client ID)",
        hint: "DevHub Nuvemshop → Meu aplicativo",
        requiredForReady: true,
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        hint: "Nunca no frontend",
        secret: true,
        requiredForReady: true,
      },
      {
        key: "redirectUri",
        label: "Redirect URI",
        hint: "https://atrako.com.br/api/atrako/oauth/nuvemshop/callback",
      },
      {
        key: "scopes",
        label: "Scopes",
        hint: "read_orders,read_products,read_customers",
      },
    ],
  },
};

export function platformAppCatalogList(): PlatformAppCatalogEntry[] {
  return PLATFORM_APP_PROVIDERS.map((p) => PLATFORM_APP_CATALOG[p]).filter((e) => !e.hideInAdmin);
}

export type PlatformAppReadinessFlags = {
  enabled: boolean;
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
};

export type PlatformAppStatus = "ready" | "incomplete" | "disabled" | "n_a";

function oauthReady(flags: PlatformAppReadinessFlags): boolean {
  return flags.hasClientId && flags.hasClientSecret;
}

export function platformAppStatus(
  provider: PlatformAppProvider,
  flags: PlatformAppReadinessFlags,
  /** Flags de outros apps — para herança OAuth (ex.: Calendar ← Ads). */
  siblings?: Partial<Record<PlatformAppProvider, PlatformAppReadinessFlags>>,
): PlatformAppStatus {
  if (provider === "WOOCOMMERCE") {
    return flags.enabled ? "n_a" : "disabled";
  }

  const entry = PLATFORM_APP_CATALOG[provider];
  const inheritFrom = entry.inheritsOAuthFrom;
  const parent = inheritFrom ? siblings?.[inheritFrom] : undefined;
  const inherited =
    Boolean(parent?.enabled && parent.hasClientId && parent.hasClientSecret);
  const ownOauth = oauthReady(flags);

  // Herda OAuth: pronto assim que o parent (Ads) está ok — sem Client/enable próprios.
  if (inheritFrom) {
    if (inherited || ownOauth) return "ready";
    if (!flags.enabled && !inherited) return "disabled";
    return "incomplete";
  }

  if (!flags.enabled) return "disabled";

  const required = entry.fields.filter((f) => f.requiredForReady);
  const ok = required.every((f) => {
    switch (f.key) {
      case "clientId":
        return flags.hasClientId;
      case "clientSecret":
        return flags.hasClientSecret;
      case "developerToken":
        return flags.hasDeveloperToken;
      case "webhookSecret":
      case "webhookVerifyToken":
        return flags.hasWebhookSecret;
      case "serviceAccountJson":
        return flags.hasServiceAccount;
      case "redirectUri":
        return Boolean(flags.hasRedirectUri);
      case "refreshToken":
        return flags.hasRefreshToken;
      case "loginCustomerId":
        return Boolean(flags.hasLoginCustomerId);
      case "loginConfigId":
        return flags.hasLoginConfigId;
      case "scopes":
      case "apiVersion":
      case "apiBaseUrl":
      case "partnerKeyExpiresAt":
        return true;
      default:
        return true;
    }
  });

  return ok ? "ready" : "incomplete";
}

export function platformAppStatusLabel(status: PlatformAppStatus): string {
  switch (status) {
    case "ready":
      return "Pronto";
    case "incomplete":
      return "Incompleto";
    case "disabled":
      return "Desabilitado";
    case "n_a":
      return "Por workspace";
  }
}

export function credentialChecklist(
  provider: PlatformAppProvider,
  flags: PlatformAppReadinessFlags,
): Array<{ label: string; ok: boolean; required: boolean }> {
  const entry = PLATFORM_APP_CATALOG[provider];
  return entry.fields
    .filter((f) => f.key !== "label")
    .map((f) => {
      let ok = false;
      switch (f.key) {
        case "clientId":
          ok = flags.hasClientId;
          break;
        case "clientSecret":
          ok = flags.hasClientSecret;
          break;
        case "developerToken":
          ok = flags.hasDeveloperToken;
          break;
        case "loginConfigId":
          ok = flags.hasLoginConfigId;
          break;
        case "webhookSecret":
        case "webhookVerifyToken":
          ok = flags.hasWebhookSecret;
          break;
        case "serviceAccountJson":
          ok = flags.hasServiceAccount;
          break;
        case "redirectUri":
          ok = Boolean(flags.hasRedirectUri);
          break;
        case "refreshToken":
          ok = flags.hasRefreshToken;
          break;
        case "loginCustomerId":
          ok = Boolean(flags.hasLoginCustomerId);
          break;
        case "scopes":
        case "apiVersion":
        case "apiBaseUrl":
        case "partnerKeyExpiresAt":
          ok = true;
          break;
        default:
          ok = false;
      }
      return {
        label: f.label,
        ok,
        required: Boolean(f.requiredForReady),
      };
    });
}
