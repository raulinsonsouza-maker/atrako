import { NextRequest, NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/internalAccess";
import {
  ensurePlatformAppsSeeded,
  isPlatformAppProvider,
  listPlatformAppsMasked,
  upsertPlatformApp,
  type PlatformAppCredentials,
} from "@/lib/config/platformApps";

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
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
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

  await upsertPlatformApp({
    provider,
    enabled:
      typeof body.enabled === "boolean"
        ? body.enabled
        : body.enabled === "true"
          ? true
          : body.enabled === "false"
            ? false
            : undefined,
    label: typeof body.label === "string" ? body.label : undefined,
    credentials: Object.keys(credentials).length ? credentials : undefined,
  });

  const apps = await listPlatformAppsMasked();
  return NextResponse.json({ ok: true, apps });
}
