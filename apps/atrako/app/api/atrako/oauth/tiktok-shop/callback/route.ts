import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import {
  exchangeTiktokShopCode,
  resolveTiktokShopApp,
  tiktokShopTimestampToIso,
} from "@/lib/integrations/tiktok-shop/oauth";
import { listTiktokShopAuthorizedShops } from "@/lib/integrations/tiktok-shop/orders";
import { syncTiktokShopWorkspace } from "@/lib/integrations/tiktok-shop/sync";
import { getPublicOrigin } from "@/lib/http/public-origin";

/** Callback TikTok Shop: `code` + `state` (+ `shop_region`, `locale`). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const origin = getPublicOrigin(request);
  const hub = new URL("/config/conexoes/oauth-complete", origin);

  if (!code || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "TIKTOK_SHOP") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }
  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);
  hub.searchParams.set("workspaceId", pending.clienteId);

  const app = await resolveTiktokShopApp(origin);
  if (!app.appKey || !app.appSecret) {
    hub.searchParams.set("error", "tiktok_shop_not_configured");
    return NextResponse.redirect(hub);
  }

  let token: Awaited<ReturnType<typeof exchangeTiktokShopCode>>;
  try {
    token = await exchangeTiktokShopCode({
      appKey: app.appKey,
      appSecret: app.appSecret,
      code,
    });
  } catch (err) {
    console.error("[tiktok-shop-oauth] token", err instanceof Error ? err.message : err);
    hub.searchParams.set("error", "tiktok_shop_token_failed");
    return NextResponse.redirect(hub);
  }

  let shops: Awaited<ReturnType<typeof listTiktokShopAuthorizedShops>> = [];
  try {
    shops = await listTiktokShopAuthorizedShops({
      appKey: app.appKey,
      appSecret: app.appSecret,
      accessToken: token.access_token,
    });
  } catch (err) {
    console.error("[tiktok-shop-oauth] shops", err instanceof Error ? err.message : err);
  }
  const region = sp.get("shop_region")?.toUpperCase();
  const shop = shops.find((s) => region && s.region?.toUpperCase() === region) ?? shops[0];
  if (!shop?.cipher) {
    hub.searchParams.set("error", "tiktok_shop_no_shop");
    return NextResponse.redirect(hub);
  }

  const shopId = shop.id ? String(shop.id) : null;
  const shopName = shop.name || token.seller_name || "TikTok Shop";

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "TIKTOK_SHOP",
    label: shopName,
    status: "ACTIVE",
    credentials: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: tiktokShopTimestampToIso(token.access_token_expire_in),
      refreshTokenExpiresAt: tiktokShopTimestampToIso(token.refresh_token_expire_in),
      openId: token.open_id ?? null,
      shopId,
      shopCipher: shop.cipher,
    },
    metadata: {
      shopId,
      shopName,
      region: shop.region ?? token.seller_base_region ?? null,
      sellerType: shop.seller_type ?? null,
      sellerName: token.seller_name ?? null,
      openId: token.open_id ?? null,
      grantedScopes: token.granted_scopes ?? null,
      shops: shops.map((s) => ({ id: s.id, name: s.name, region: s.region })),
      connectedAt: new Date().toISOString(),
    },
  });

  try {
    await syncTiktokShopWorkspace(pending.clienteId, { daysBack: 90, maxPages: 4 });
  } catch (err) {
    console.error("[tiktok-shop-oauth] initial sync", err instanceof Error ? err.message : err);
  }

  hub.searchParams.set("connected", "TIKTOK_SHOP");
  return NextResponse.redirect(hub);
}
