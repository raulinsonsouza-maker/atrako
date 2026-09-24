import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { ML_OAUTH_TOKEN } from "@/lib/integrations/mercadolivre/oauth";
import { getPublicOrigin } from "@/lib/http/public-origin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const hub = new URL("/config/conexoes/oauth-complete", getPublicOrigin(request));

  if (!code || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "MERCADO_LIVRE") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("MERCADO_LIVRE");
  const clientId = app?.credentials.clientId?.trim() || process.env.ML_CLIENT_ID?.trim();
  const clientSecret =
    app?.credentials.clientSecret?.trim() || process.env.ML_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || !pending.codeVerifier) {
    hub.searchParams.set("error", "ml_not_configured");
    return NextResponse.redirect(hub);
  }

  const redirectUri =
    pending.redirectUri ||
    `${getPublicOrigin(request)}/api/atrako/oauth/mercadolivre/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: pending.codeVerifier,
  });

  const res = await fetch(ML_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!res.ok) {
    hub.searchParams.set("error", "ml_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const token = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    user_id?: number;
    expires_in?: number;
    scope?: string;
  };

  const expiresAt =
    typeof token.expires_in === "number"
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "MERCADO_LIVRE",
    label: token.user_id ? `ML #${token.user_id}` : "Mercado Livre",
    credentials: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      userId: token.user_id ?? null,
      expiresIn: token.expires_in ?? null,
      expiresAt,
      scope: token.scope ?? null,
    },
    metadata: {
      connectedAt: new Date().toISOString(),
      meliUserId: token.user_id ?? null,
    },
  });

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "MERCADO_LIVRE");
  return NextResponse.redirect(hub);
}
