import { NextRequest, NextResponse } from "next/server";
import {
  isPlatformAppProvider,
  resolvePlatformApp,
} from "@/lib/config/platformApps";

/**
 * Service-to-service: child apps (commerce/agenda) resolve PlatformApp credentials
 * without maintaining a parallel env silo.
 *
 * Auth: Bearer ATRAKO_INTERNAL_TOKEN (fallback: ATRAKO_CONNECTIONS_TOKEN for local DX).
 */
function isServiceAuthorized(request: NextRequest): boolean {
  const expected =
    process.env.ATRAKO_INTERNAL_TOKEN?.trim() ||
    process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() ||
    process.env.ATRAKO_EVENTS_TOKEN?.trim();
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  if (!isServiceAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider: raw } = await context.params;
  const provider = raw?.trim().toUpperCase() ?? "";
  if (!isPlatformAppProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const app = await resolvePlatformApp(provider);
  if (!app) {
    return NextResponse.json({ provider, credentials: null }, { status: 404 });
  }

  const c = app.credentials;
  return NextResponse.json({
    provider: app.provider,
    enabled: app.enabled,
    label: app.label,
    credentials: {
      clientId: c.clientId ?? null,
      clientSecret: c.clientSecret ?? null,
      redirectUri: c.redirectUri ?? null,
      webhookSecret: c.webhookSecret ?? null,
      webhookVerifyToken: c.webhookVerifyToken ?? null,
    },
  });
}
