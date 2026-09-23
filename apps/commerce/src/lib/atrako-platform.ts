/**
 * Resolve PlatformApp credentials from Atrako (canonical) for child-app OAuth/webhooks.
 * Dealers connect seller accounts at Atrako `/config/conexoes`; app secrets live in `/admin/apps`.
 *
 * Resolution order:
 * 1. Internal API (`ATRAKO_INTERNAL_URL` + Bearer token)
 * 2. Shared env seed (`ATRAKO_PLATFORM_MP_*`)
 * 3. Legacy `MP_*` env (local DX only — production should use Atrako `/admin/apps`)
 */

export type MercadoPagoPlatformCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookSecret?: string;
};

type PlatformAppPayload = {
  credentials?: {
    clientId?: string | null;
    clientSecret?: string | null;
    redirectUri?: string | null;
    webhookSecret?: string | null;
  } | null;
};

function atrakoInternalBaseUrl() {
  return (
    process.env.ATRAKO_INTERNAL_URL?.trim() ||
    process.env.ATRAKO_URL?.trim() ||
    process.env.ATRAKO_SHELL_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}

function internalServiceToken() {
  return (
    process.env.ATRAKO_INTERNAL_TOKEN?.trim() ||
    process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() ||
    process.env.ATRAKO_EVENTS_TOKEN?.trim() ||
    ""
  );
}

async function fetchMercadoPagoFromAtrakoPlatform(): Promise<Partial<MercadoPagoPlatformCredentials> | null> {
  const token = internalServiceToken();
  if (!token) return null;

  const url = `${atrakoInternalBaseUrl()}/api/internal/platform-app/MERCADO_PAGO`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as PlatformAppPayload;
    const c = json.credentials;
    if (!c) return null;
    return {
      clientId: typeof c.clientId === "string" ? c.clientId.trim() : undefined,
      clientSecret: typeof c.clientSecret === "string" ? c.clientSecret.trim() : undefined,
      redirectUri: typeof c.redirectUri === "string" ? c.redirectUri.trim() : undefined,
      webhookSecret:
        typeof c.webhookSecret === "string" ? c.webhookSecret.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function fromSharedEnv(): Partial<MercadoPagoPlatformCredentials> {
  return {
    clientId: process.env.ATRAKO_PLATFORM_MP_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.ATRAKO_PLATFORM_MP_CLIENT_SECRET?.trim() || undefined,
    redirectUri: process.env.ATRAKO_PLATFORM_MP_REDIRECT_URI?.trim() || undefined,
    webhookSecret: process.env.ATRAKO_PLATFORM_MP_WEBHOOK_SECRET?.trim() || undefined,
  };
}

function fromLegacyMpEnv(): Partial<MercadoPagoPlatformCredentials> {
  // Env is seed-only for local DX. Production: configure PlatformApp in Atrako `/admin/apps`.
  return {
    clientId: process.env.MP_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.MP_CLIENT_SECRET?.trim() || undefined,
    redirectUri: process.env.MP_REDIRECT_URI?.trim() || undefined,
    webhookSecret: process.env.MP_WEBHOOK_SECRET?.trim() || undefined,
  };
}

function mergeCreds(
  ...layers: Array<Partial<MercadoPagoPlatformCredentials> | null | undefined>
): Partial<MercadoPagoPlatformCredentials> {
  const out: Partial<MercadoPagoPlatformCredentials> = {};
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.clientId) out.clientId = layer.clientId;
    if (layer.clientSecret) out.clientSecret = layer.clientSecret;
    if (layer.redirectUri) out.redirectUri = layer.redirectUri;
    if (layer.webhookSecret) out.webhookSecret = layer.webhookSecret;
  }
  return out;
}

/** Full OAuth app credentials (throws if client id / secret / redirect missing). */
export async function resolveMercadoPagoPlatformCredentials(): Promise<MercadoPagoPlatformCredentials> {
  const fromHub = await fetchMercadoPagoFromAtrakoPlatform();
  const merged = mergeCreds(fromLegacyMpEnv(), fromSharedEnv(), fromHub);

  const clientId = merged.clientId;
  const clientSecret = merged.clientSecret;
  const redirectUri = merged.redirectUri;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Mercado Pago PlatformApp credentials missing (Atrako /admin/apps or MP_* / ATRAKO_PLATFORM_MP_* env)",
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
    webhookSecret: merged.webhookSecret,
  };
}

/** Webhook HMAC secret — prefer PlatformApp, keep env fallback for local DX. */
export async function resolveMercadoPagoWebhookSecret(): Promise<string | undefined> {
  const fromHub = await fetchMercadoPagoFromAtrakoPlatform();
  const merged = mergeCreds(fromLegacyMpEnv(), fromSharedEnv(), fromHub);
  return merged.webhookSecret || undefined;
}
