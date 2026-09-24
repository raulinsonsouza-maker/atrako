import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import {
  exchangeTrayCode,
  normalizeTrayApiAddress,
  normalizeTrayStoreHost,
  parseTrayDateTime,
} from "@/lib/integrations/tray/oauth";
import { syncTrayWorkspace } from "@/lib/integrations/tray/sync";
import { getPublicOrigin } from "@/lib/http/public-origin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const store = request.nextUrl.searchParams.get("store");
  const apiAddressRaw = request.nextUrl.searchParams.get("api_address");
  const state = request.nextUrl.searchParams.get("state");
  const hub = new URL("/config/conexoes/oauth-complete", getPublicOrigin(request));

  if (!code || !apiAddressRaw || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "TRAY") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const storeHost =
    normalizeTrayStoreHost(pending.codeVerifier || "") ||
    (state.includes(".")
      ? normalizeTrayStoreHost(state.slice(state.indexOf(".") + 1))
      : null);

  const apiAddress = normalizeTrayApiAddress(apiAddressRaw);
  if (!apiAddress) {
    hub.searchParams.set("error", "tray_api_address_invalid");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("TRAY");
  const consumerKey =
    app?.credentials.clientId?.trim() || process.env.TRAY_CONSUMER_KEY?.trim();
  const consumerSecret =
    app?.credentials.clientSecret?.trim() ||
    process.env.TRAY_CONSUMER_SECRET?.trim();

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!consumerKey || !consumerSecret) {
    hub.searchParams.set("error", "tray_not_configured");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  let token: Awaited<ReturnType<typeof exchangeTrayCode>>;
  try {
    token = await exchangeTrayCode({
      apiAddress,
      consumerKey,
      consumerSecret,
      code,
    });
  } catch {
    hub.searchParams.set("error", "tray_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const storeId = String(store || token.store_id || "");

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "TRAY",
    label: storeHost || `Tray #${storeId}`,
    status: "ACTIVE",
    credentials: {
      storeId,
      storeHost,
      apiAddress,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: parseTrayDateTime(token.date_expiration_access_token),
      refreshTokenExpiresAt: parseTrayDateTime(token.date_expiration_refresh_token),
    },
    metadata: {
      storeId,
      storeHost,
      apiAddress,
      connectedAt: new Date().toISOString(),
    },
  });

  try {
    await syncTrayWorkspace(pending.clienteId, { daysBack: 90, maxPages: 4 });
  } catch (err) {
    console.error(
      "[tray-oauth] initial sync",
      err instanceof Error ? err.message : err,
    );
  }

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "TRAY");
  return NextResponse.redirect(hub);
}
