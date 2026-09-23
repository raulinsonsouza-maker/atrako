import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const err = request.nextUrl.searchParams.get("error");

  const hub = new URL("/config/conexoes", request.nextUrl.origin);

  if (err || !code || !state) {
    hub.searchParams.set("error", "google_oauth");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({
    where: { state },
  });
  if (
    !pending ||
    pending.provider !== "GOOGLE_CALENDAR" ||
    pending.expiresAt < new Date()
  ) {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const calApp = await resolvePlatformApp("GOOGLE_CALENDAR");
  const googleApp = await resolvePlatformApp("GOOGLE");
  const clientId =
    calApp?.credentials.clientId?.trim() ||
    googleApp?.credentials.clientId?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    calApp?.credentials.clientSecret?.trim() ||
    googleApp?.credentials.clientSecret?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    hub.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(hub);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: pending.codeVerifier || "",
      grant_type: "authorization_code",
      redirect_uri: pending.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    await prisma.workspaceOAuthPending.delete({ where: { state } }).catch(() => {});
    hub.searchParams.set("error", "google_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  await prisma.workspaceConnection.upsert({
    where: {
      clienteId_provider: {
        clienteId: pending.clienteId,
        provider: "GOOGLE_CALENDAR",
      },
    },
    create: {
      clienteId: pending.clienteId,
      provider: "GOOGLE_CALENDAR",
      status: "ACTIVE",
      label: "Google Calendar",
      credentialsEnc: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        calendarId: "primary",
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
    },
    update: {
      status: "ACTIVE",
      credentialsEnc: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        calendarId: "primary",
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
    },
  });

  await prisma.workspaceOAuthPending.delete({ where: { state } }).catch(() => {});

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "GOOGLE_CALENDAR");
  return NextResponse.redirect(hub);
}
