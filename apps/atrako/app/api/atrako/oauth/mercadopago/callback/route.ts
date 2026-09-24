import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const hub = new URL("/config/conexoes/oauth-complete", request.nextUrl.origin);

  if (!code || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "MERCADO_PAGO") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("MERCADO_PAGO");
  const clientId = app?.credentials.clientId?.trim() || process.env.MP_CLIENT_ID?.trim();
  const clientSecret =
    app?.credentials.clientSecret?.trim() || process.env.MP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || !pending.codeVerifier) {
    hub.searchParams.set("error", "mp_not_configured");
    return NextResponse.redirect(hub);
  }

  const redirectUri =
    pending.redirectUri ||
    `${request.nextUrl.origin}/api/atrako/oauth/mercadopago/callback`;

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: pending.codeVerifier,
    }),
  });

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!res.ok) {
    hub.searchParams.set("error", "mp_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const token = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    public_key?: string;
    user_id?: number;
    expires_in?: number;
    live_mode?: boolean;
  };

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "MERCADO_PAGO",
    label: token.user_id ? `MP #${token.user_id}` : "Mercado Pago",
    credentials: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      publicKey: token.public_key ?? null,
      userId: token.user_id ?? null,
      expiresIn: token.expires_in ?? null,
      liveMode: token.live_mode ?? null,
    },
    metadata: { connectedAt: new Date().toISOString() },
  });

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "MERCADO_PAGO");
  return NextResponse.redirect(hub);
}
