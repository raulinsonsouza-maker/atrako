import { NextRequest, NextResponse } from "next/server";
import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { PLATAFORMA_GOOGLE_ADS, upsertContaPlataforma } from "@/lib/repositories/contasRepository";
import { getPublicOrigin } from "@/lib/http/public-origin";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Callback OAuth Google Ads.
 * Grava refresh token na WC; se só houver 1 CID acessível, espelha em Conta.
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

  let accessibleCustomerIds: string[] = [];
  try {
    const client = new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: app?.credentials.developerToken?.trim() || "",
    });
    const listed = await client.listAccessibleCustomers(token.refresh_token);
    const resources = (listed as { resource_names?: string[] })?.resource_names ?? [];
    accessibleCustomerIds = resources
      .map((r) => r.replace(/^customers\//, "").replace(/\D/g, ""))
      .filter(Boolean);
  } catch {
    accessibleCustomerIds = [];
  }

  const singleCid =
    accessibleCustomerIds.length === 1 ? accessibleCustomerIds[0] : undefined;

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "GOOGLE_ADS",
    label: "Google Ads",
    status: "ACTIVE",
    credentials: {
      refreshToken: token.refresh_token,
      accessToken: token.access_token ?? null,
      expiresIn: token.expires_in ?? null,
      ...(singleCid ? { customerId: singleCid } : {}),
    },
    metadata: {
      connectedAt: new Date().toISOString(),
      scope: token.scope ?? null,
      accessibleCustomerIds,
      customerId: singleCid ?? null,
      needsAccountPick: accessibleCustomerIds.length > 1,
    },
  });

  if (singleCid) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: pending.clienteId },
      select: { nome: true },
    });
    await upsertContaPlataforma({
      clienteId: pending.clienteId,
      plataforma: PLATAFORMA_GOOGLE_ADS,
      accountIdPlataforma: singleCid,
      googleAdsLoginCustomerId: null,
      nomeConta: cliente?.nome ?? "Google Ads",
      conexaoIntegracaoId: null,
    });
  }

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "GOOGLE_ADS");
  if (accessibleCustomerIds.length > 1) {
    hub.searchParams.set("pick", "GOOGLE_ADS");
  }
  return NextResponse.redirect(hub);
}
