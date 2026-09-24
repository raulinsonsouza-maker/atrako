import "server-only";

import { prisma } from "@/lib/db";
import { decryptCredentials, encryptCredentials } from "@/lib/atrako/credentials-crypto";
import { PLATFORM_APP_CATALOG } from "@/lib/config/platformAppCatalog";
import {
  PLATFORM_APP_PROVIDERS,
  isPlatformAppProvider,
  type PlatformAppProvider,
} from "@/lib/config/platformAppProviders";

export {
  PLATFORM_APP_PROVIDERS,
  isPlatformAppProvider,
  type PlatformAppProvider,
};

export type PlatformAppCredentials = {
  clientId?: string;
  clientSecret?: string;
  developerToken?: string;
  loginConfigId?: string;
  redirectUri?: string;
  webhookSecret?: string;
  webhookVerifyToken?: string;
  /** GA4 service account JSON string */
  serviceAccountJson?: string;
  refreshToken?: string;
  loginCustomerId?: string;
  [key: string]: unknown;
};

const ENV_SEED: Partial<
  Record<PlatformAppProvider, () => PlatformAppCredentials & { label?: string }>
> = {
  META: () => ({
    label: "Meta",
    clientId:
      process.env.META_APP_ID?.trim() ||
      process.env.SYMBIUS_META_APP_ID?.trim() ||
      process.env.SYMBIUS_IG_APP_ID?.trim() ||
      undefined,
    clientSecret:
      process.env.META_APP_SECRET?.trim() ||
      process.env.SYMBIUS_META_APP_SECRET?.trim() ||
      process.env.SYMBIUS_IG_APP_SECRET?.trim() ||
      undefined,
    loginConfigId: process.env.META_LOGIN_CONFIG_ID?.trim() || undefined,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || undefined,
    webhookSecret:
      process.env.META_APP_SECRET?.trim() ||
      process.env.SYMBIUS_IG_APP_SECRET?.trim() ||
      undefined,
  }),
  GOOGLE: () => ({
    label: "Google OAuth",
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
  }),
  GOOGLE_ADS: () => ({
    label: "Google Ads",
    clientId:
      process.env.GOOGLE_ADS_CLIENT_ID?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      undefined,
    clientSecret:
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() ||
      process.env.GOOGLE_CLIENT_SECRET?.trim() ||
      undefined,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || undefined,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || undefined,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || undefined,
  }),
  GOOGLE_CALENDAR: () => ({
    label: "Google Calendar",
    // Prefer Ads / shared Google client — Calendar herda o Client Web do Ads.
    clientId:
      process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
      process.env.GOOGLE_ADS_CLIENT_ID?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      undefined,
    clientSecret:
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() ||
      process.env.GOOGLE_CLIENT_SECRET?.trim() ||
      undefined,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() || undefined,
  }),
  GOOGLE_ANALYTICS: () => ({
    label: "Google Analytics",
    serviceAccountJson: process.env.GOOGLE_ANALYTICS_CREDENTIALS?.trim() || undefined,
  }),
  MERCADO_PAGO: () => ({
    label: "Mercado Pago",
    clientId: process.env.MP_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.MP_CLIENT_SECRET?.trim() || undefined,
    redirectUri: process.env.MP_REDIRECT_URI?.trim() || undefined,
    webhookSecret: process.env.MP_WEBHOOK_SECRET?.trim() || undefined,
  }),
  MERCADO_LIVRE: () => ({
    label: "Mercado Livre",
    clientId: process.env.ML_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.ML_CLIENT_SECRET?.trim() || undefined,
    redirectUri: process.env.ML_REDIRECT_URI?.trim() || undefined,
  }),
  LINKEDIN: () => ({
    label: "LinkedIn Ads",
    clientId: process.env.LINKEDIN_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET?.trim() || undefined,
  }),
  TIKTOK: () => ({
    label: "TikTok",
    clientId: process.env.TIKTOK_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim() || undefined,
  }),
  WOOCOMMERCE: () => ({
    label: "WooCommerce",
  }),
};

function hasAnyCredential(creds: PlatformAppCredentials): boolean {
  return Object.values(creds).some((v) => typeof v === "string" && v.trim().length > 0);
}

export async function seedPlatformAppFromEnv(provider: PlatformAppProvider): Promise<void> {
  const existing = await prisma.platformApp.findUnique({ where: { provider } });
  if (existing) return;
  const seeder = ENV_SEED[provider];
  if (!seeder) return;
  const seeded = seeder();
  const { label, ...credentials } = seeded;
  if (!hasAnyCredential(credentials) && provider !== "WOOCOMMERCE" && provider !== "TIKTOK") {
    await prisma.platformApp.create({
      data: {
        provider,
        enabled: provider === "WOOCOMMERCE",
        label: label ?? provider,
        credentialsEnc: encryptCredentials({}),
      },
    });
    return;
  }
  await prisma.platformApp.create({
    data: {
      provider,
      enabled: true,
      label: label ?? provider,
      credentialsEnc: encryptCredentials(credentials),
    },
  });
}

export async function ensurePlatformAppsSeeded(): Promise<void> {
  for (const provider of PLATFORM_APP_PROVIDERS) {
    await seedPlatformAppFromEnv(provider);
  }
  await enableCalendarWhenAdsReady();
}

/** Calendar fica pronto automaticamente quando Ads tem Client OAuth. */
async function enableCalendarWhenAdsReady(): Promise<void> {
  const ads = await prisma.platformApp.findUnique({ where: { provider: "GOOGLE_ADS" } });
  if (!ads?.enabled) return;
  const creds = decryptCredentials(ads.credentialsEnc) as PlatformAppCredentials;
  if (!creds.clientId?.trim() || !creds.clientSecret?.trim()) return;

  const cal = await prisma.platformApp.findUnique({ where: { provider: "GOOGLE_CALENDAR" } });
  if (!cal) return;

  const calCreds = decryptCredentials(cal.credentialsEnc) as PlatformAppCredentials;
  const redirectUri =
    calCreds.redirectUri?.trim() ||
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    "https://atrako.com.br/api/atrako/oauth/google-calendar/callback";

  const needsUpdate =
    !cal.enabled ||
    calCreds.redirectUri?.trim() !== redirectUri;

  if (!needsUpdate) return;

  await prisma.platformApp.update({
    where: { provider: "GOOGLE_CALENDAR" },
    data: {
      enabled: true,
      label: cal.label || "Google Calendar",
      credentialsEnc: encryptCredentials({
        ...calCreds,
        redirectUri,
      }),
    },
  });
}

async function inheritOAuthCredentials(
  provider: PlatformAppProvider,
  credentials: PlatformAppCredentials,
): Promise<PlatformAppCredentials> {
  const inheritFrom = PLATFORM_APP_CATALOG[provider]?.inheritsOAuthFrom;
  if (!inheritFrom) return credentials;
  if (credentials.clientId?.trim() && credentials.clientSecret?.trim()) return credentials;

  const parent = await resolvePlatformApp(inheritFrom);
  if (!parent?.enabled) return credentials;

  return {
    ...credentials,
    clientId: credentials.clientId?.trim() || parent.credentials.clientId,
    clientSecret: credentials.clientSecret?.trim() || parent.credentials.clientSecret,
  };
}

export async function resolvePlatformApp(provider: PlatformAppProvider): Promise<{
  provider: PlatformAppProvider;
  enabled: boolean;
  label: string | null;
  credentials: PlatformAppCredentials;
  metadata: unknown;
} | null> {
  await seedPlatformAppFromEnv(provider);
  const row = await prisma.platformApp.findUnique({ where: { provider } });
  if (!row) {
    const seeder = ENV_SEED[provider];
    if (!seeder) return null;
    const seeded = seeder();
    const { label, ...credentials } = seeded;
    if (!hasAnyCredential(credentials) && provider !== "WOOCOMMERCE") return null;
    return {
      provider,
      enabled: true,
      label: label ?? provider,
      credentials: await inheritOAuthCredentials(provider, credentials),
      metadata: null,
    };
  }
  const credentials = decryptCredentials(row.credentialsEnc) as PlatformAppCredentials;
  return {
    provider,
    enabled: row.enabled,
    label: row.label,
    credentials: await inheritOAuthCredentials(provider, credentials),
    metadata: row.metadata,
  };
}

export async function upsertPlatformApp(input: {
  provider: PlatformAppProvider;
  enabled?: boolean;
  label?: string | null;
  credentials?: PlatformAppCredentials;
  metadata?: Record<string, unknown> | null;
}) {
  const existing = await prisma.platformApp.findUnique({ where: { provider: input.provider } });
  const prev = existing
    ? (decryptCredentials(existing.credentialsEnc) as PlatformAppCredentials)
    : {};
  const nextCreds = { ...prev, ...(input.credentials ?? {}) };
  // Don't overwrite secrets with empty strings from the UI
  for (const [k, v] of Object.entries(nextCreds)) {
    if (typeof v === "string" && v.trim() === "" && prev[k]) {
      nextCreds[k] = prev[k];
    }
  }
  return prisma.platformApp.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      enabled: input.enabled ?? true,
      label: input.label ?? input.provider,
      credentialsEnc: encryptCredentials(nextCreds),
      metadata: input.metadata ?? undefined,
    },
    update: {
      enabled: input.enabled,
      label: input.label === undefined ? undefined : input.label,
      credentialsEnc: encryptCredentials(nextCreds),
      metadata: input.metadata === undefined ? undefined : input.metadata,
    },
  });
}

export async function listPlatformAppsMasked() {
  await ensurePlatformAppsSeeded();
  const rows = await prisma.platformApp.findMany({ orderBy: { provider: "asc" } });
  return rows.map((row) => {
    const creds = decryptCredentials(row.credentialsEnc) as PlatformAppCredentials;
    return {
      id: row.id,
      provider: row.provider,
      enabled: row.enabled,
      label: row.label,
      hasClientId: Boolean(creds.clientId),
      hasClientSecret: Boolean(creds.clientSecret),
      hasDeveloperToken: Boolean(creds.developerToken),
      hasLoginConfigId: Boolean(creds.loginConfigId),
      hasWebhookSecret: Boolean(creds.webhookSecret || creds.webhookVerifyToken),
      hasServiceAccount: Boolean(creds.serviceAccountJson),
      hasRefreshToken: Boolean(creds.refreshToken),
      hasRedirectUri: Boolean(creds.redirectUri),
      hasLoginCustomerId: Boolean(creds.loginCustomerId),
      clientIdPreview: creds.clientId ? `${creds.clientId.slice(0, 6)}…` : null,
      metadata: row.metadata,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}
