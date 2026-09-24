import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { exchangeShopeeCode } from "@/lib/integrations/shopee/oauth";
import { syncShopeeWorkspace } from "@/lib/integrations/shopee/sync";
import { getPublicOrigin } from "@/lib/http/public-origin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const shopId = request.nextUrl.searchParams.get("shop_id");
  const state = request.nextUrl.searchParams.get("state");
  const hub = new URL("/config/conexoes/oauth-complete", getPublicOrigin(request));

  if (!code || !shopId || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "SHOPEE") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("SHOPEE");
  const partnerId =
    app?.credentials.clientId?.trim() || process.env.SHOPEE_PARTNER_ID?.trim();
  const partnerKey =
    app?.credentials.clientSecret?.trim() || process.env.SHOPEE_PARTNER_KEY?.trim();

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!partnerId || !partnerKey) {
    hub.searchParams.set("error", "shopee_not_configured");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  let token: Awaited<ReturnType<typeof exchangeShopeeCode>>;
  try {
    token = await exchangeShopeeCode({
      apiBaseUrl:
        (typeof app?.credentials.apiBaseUrl === "string" && app.credentials.apiBaseUrl) ||
        process.env.SHOPEE_API_BASE_URL,
      partnerId,
      partnerKey,
      code,
      shopId,
    });
  } catch {
    hub.searchParams.set("error", "shopee_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const tokenExpiresAt =
    typeof token.expire_in === "number"
      ? new Date(Date.now() + token.expire_in * 1000).toISOString()
      : null;

  const resolvedShopId = String(token.shop_id ?? shopId);

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "SHOPEE",
    label: `Shopee #${resolvedShopId}`,
    status: "ACTIVE",
    credentials: {
      shopId: resolvedShopId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expireIn: token.expire_in ?? null,
      tokenExpiresAt,
    },
    metadata: {
      shopId: resolvedShopId,
      connectedAt: new Date().toISOString(),
      merchantIdList: token.merchant_id_list ?? null,
    },
  });

  try {
    await syncShopeeWorkspace(pending.clienteId, { daysBack: 90, maxPages: 4 });
  } catch (err) {
    console.error(
      "[shopee-oauth] initial sync",
      err instanceof Error ? err.message : err,
    );
  }

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "SHOPEE");
  return NextResponse.redirect(hub);
}
