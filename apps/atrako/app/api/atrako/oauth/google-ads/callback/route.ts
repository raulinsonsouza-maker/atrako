import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { getPublicOrigin } from "@/lib/http/public-origin";
import { listAccessibleCustomerIds } from "@/lib/googleAds/googleAdsClient";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Callback OAuth Google Ads.
 * Grava refresh token; lista CIDs sem exigir developer token (sunset 9/set/2026 —
 * acesso via Google Cloud project do Client OAuth).
 * @see https://developers.google.com/google-ads/api/docs/api-policy/developer-token
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const hub = new URL("/config/conexoes/oauth-complete", getPublicOrigin(request));

  if (oauthError) {
    hub.searchParams.set("error", oauthError);
    return NextResponse.redirect(hub);
  }

  if (!code || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "GOOGLE_ADS") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("GOOGLE_ADS");
  const clientId =
    app?.credentials.clientId?.trim() ||
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    app?.credentials.clientSecret?.trim() ||
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    pending.redirectUri ||
    `${getPublicOrigin(request)}/api/atrako/oauth/google-ads/callback`;

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!clientId || !clientSecret) {
    hub.searchParams.set("error", "google_ads_not_configured");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    hub.searchParams.set("error", "google_ads_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const token = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!token.refresh_token) {
    hub.searchParams.set("error", "google_ads_no_refresh");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const listed = await listAccessibleCustomerIds({
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    clientId,
    clientSecret,
    developerToken: app?.credentials.developerToken,
  });
  const accessibleCustomerIds = listed.ids;
  const accessibleCustomers = listed.accounts;
  const listError = listed.error;
  const loginCustomerId = listed.loginCustomerId;

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "GOOGLE_ADS",
    label: "Google Ads",
    status: accessibleCustomerIds.length > 0 ? "PENDING_ACCOUNT" : "SYNC_ERROR",
    credentials: {
      refreshToken: token.refresh_token,
      accessToken: token.access_token ?? null,
      expiresIn: token.expires_in ?? null,
    },
    metadata: {
      connectedAt: new Date().toISOString(),
      scope: token.scope ?? null,
      accessibleCustomerIds,
      accessibleCustomers,
      customerId: null,
      customerName: null,
      loginCustomerId: null,
      needsAccountPick: accessibleCustomerIds.length > 0,
      listError,
      lastSyncAt: null,
      lastSyncError: null,
    },
  });

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "GOOGLE_ADS");
  if (accessibleCustomerIds.length > 0) {
    hub.searchParams.set("pick", "GOOGLE_ADS");
  } else if (accessibleCustomerIds.length === 0) {
    hub.searchParams.set("pick", "GOOGLE_ADS");
    hub.searchParams.set("meta", "no_ad_account");
  }
  return NextResponse.redirect(hub);
}
