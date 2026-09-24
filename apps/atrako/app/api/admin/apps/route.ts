import { NextRequest, NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/internalAccess";
import {
  ensurePlatformAppsSeeded,
  isPlatformAppProvider,
  listPlatformAppsMasked,
  upsertPlatformApp,
  type PlatformAppCredentials,
} from "@/lib/config/platformApps";
import { PLATFORM_APP_CATALOG } from "@/lib/config/platformAppCatalog";

export async function GET() {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  await ensurePlatformAppsSeeded();
  const apps = await listPlatformAppsMasked();
  return NextResponse.json({ apps });
}

export async function PATCH(request: NextRequest) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider : "";
  if (!isPlatformAppProvider(provider)) {
    return NextResponse.json({ error: "Provider inválido." }, { status: 400 });
  }

  const credentials: PlatformAppCredentials = {};
  const fields = [
    "clientId",
    "clientSecret",
    "developerToken",
    "loginConfigId",
    "redirectUri",
    "webhookSecret",
    "webhookVerifyToken",
    "serviceAccountJson",
    "refreshToken",
    "loginCustomerId",
  ] as const;
  for (const f of fields) {
    if (typeof body[f] === "string" && body[f].trim()) {
      credentials[f] = (body[f] as string).trim();
    }
  }

  const enabled =
    typeof body.enabled === "boolean"
      ? body.enabled
      : body.enabled === "true"
        ? true
        : body.enabled === "false"
          ? false
          : undefined;

  if (enabled === true && provider !== "WOOCOMMERCE") {
    const current = (await listPlatformAppsMasked()).find((a) => a.provider === provider);
    const merged = {
      hasClientId: Boolean(credentials.clientId) || Boolean(current?.hasClientId),
      hasClientSecret: Boolean(credentials.clientSecret) || Boolean(current?.hasClientSecret),
      hasDeveloperToken: Boolean(credentials.developerToken) || Boolean(current?.hasDeveloperToken),
      hasWebhookSecret:
        Boolean(credentials.webhookSecret || credentials.webhookVerifyToken) ||
        Boolean(current?.hasWebhookSecret),
      hasServiceAccount:
        Boolean(credentials.serviceAccountJson) || Boolean(current?.hasServiceAccount),
      hasRedirectUri: Boolean(credentials.redirectUri) || Boolean(current?.hasRedirectUri),
    };
    const missing = PLATFORM_APP_CATALOG[provider].fields
      .filter((f) => f.requiredForReady)
      .filter((f) => {
        if (f.key === "clientId") return !merged.hasClientId;
        if (f.key === "clientSecret") return !merged.hasClientSecret;
        if (f.key === "developerToken") return !merged.hasDeveloperToken;
        if (f.key === "webhookSecret" || f.key === "webhookVerifyToken") {
          return !merged.hasWebhookSecret;
        }
        if (f.key === "serviceAccountJson") return !merged.hasServiceAccount;
        if (f.key === "redirectUri") return !merged.hasRedirectUri;
        return false;
      })
      .map((f) => f.label);
    if (missing.length) {
      return NextResponse.json(
        {
          error: `Para habilitar ${PLATFORM_APP_CATALOG[provider].title}, preencha: ${missing.join(", ")}.`,
        },
        { status: 400 },
      );
    }
  }

  await upsertPlatformApp({
    provider,
    enabled,
    label: typeof body.label === "string" ? body.label : undefined,
    credentials: Object.keys(credentials).length ? credentials : undefined,
  });

  const apps = await listPlatformAppsMasked();
  return NextResponse.json({ ok: true, apps });
}
