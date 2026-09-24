import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { exchangeNuvemshopCode } from "@/lib/integrations/nuvemshop/oauth";
import { registerNuvemshopWebhooks } from "@/lib/integrations/nuvemshop/webhooks";
import { syncNuvemshopWorkspace } from "@/lib/integrations/nuvemshop/sync";
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
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "NUVEMSHOP") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("NUVEMSHOP");
  const clientId =
    app?.credentials.clientId?.trim() || process.env.NUVEMSHOP_CLIENT_ID?.trim();
  const clientSecret =
    app?.credentials.clientSecret?.trim() ||
    process.env.NUVEMSHOP_CLIENT_SECRET?.trim();

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!clientId || !clientSecret) {
    hub.searchParams.set("error", "nuvemshop_not_configured");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  let token: Awaited<ReturnType<typeof exchangeNuvemshopCode>>;
  try {
    token = await exchangeNuvemshopCode({
      clientId,
      clientSecret,
      code,
    });
  } catch {
    hub.searchParams.set("error", "nuvemshop_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const storeId = String(token.user_id ?? "");
  if (!storeId) {
    hub.searchParams.set("error", "nuvemshop_no_store");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "NUVEMSHOP",
    label: `Nuvemshop #${storeId}`,
    status: "ACTIVE",
    credentials: {
      storeId,
      accessToken: token.access_token,
      scope: token.scope ?? null,
      tokenType: token.token_type ?? "bearer",
    },
    metadata: {
      storeId,
      connectedAt: new Date().toISOString(),
      scope: token.scope ?? null,
    },
  });

  try {
    await registerNuvemshopWebhooks({
      storeId,
      accessToken: token.access_token,
      clientId,
      callbackBaseUrl: getPublicOrigin(request),
      workspaceId: pending.clienteId,
    });
  } catch (err) {
    console.error(
      "[nuvemshop-oauth] webhook register",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    await syncNuvemshopWorkspace(pending.clienteId, { daysBack: 90, maxPages: 4 });
  } catch (err) {
    console.error(
      "[nuvemshop-oauth] initial sync",
      err instanceof Error ? err.message : err,
    );
  }

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "NUVEMSHOP");
  return NextResponse.redirect(hub);
}
