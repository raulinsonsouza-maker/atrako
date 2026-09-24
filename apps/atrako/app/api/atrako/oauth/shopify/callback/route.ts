import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import {
  DEFAULT_SHOPIFY_API_VERSION,
  exchangeShopifyAccessToken,
  normalizeShopifyShop,
} from "@/lib/integrations/shopify/oauth";
import { registerShopifyWebhooks } from "@/lib/integrations/shopify/webhooks";
import { syncShopifyWorkspace } from "@/lib/integrations/shopify/sync";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const shopParam = request.nextUrl.searchParams.get("shop");
  const hub = new URL("/config/conexoes/oauth-complete", request.nextUrl.origin);

  if (!code || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "SHOPIFY") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const shopFromState = state.includes(".")
    ? normalizeShopifyShop(state.slice(state.indexOf(".") + 1))
    : null;
  const shop =
    normalizeShopifyShop(shopParam || "") ||
    normalizeShopifyShop(pending.codeVerifier || "") ||
    shopFromState;

  if (!shop) {
    hub.searchParams.set("error", "shopify_shop_invalid");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("SHOPIFY");
  const clientId =
    app?.credentials.clientId?.trim() ||
    process.env.SHOPIFY_API_KEY?.trim() ||
    process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret =
    app?.credentials.clientSecret?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim() ||
    process.env.SHOPIFY_CLIENT_SECRET?.trim();

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!clientId || !clientSecret) {
    hub.searchParams.set("error", "shopify_not_configured");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  let token: { accessToken: string; scope: string };
  try {
    token = await exchangeShopifyAccessToken({
      shop,
      clientId,
      clientSecret,
      code,
    });
  } catch {
    hub.searchParams.set("error", "shopify_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const apiVersion =
    (typeof app?.credentials.apiVersion === "string" &&
      app.credentials.apiVersion.trim()) ||
    DEFAULT_SHOPIFY_API_VERSION;

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "SHOPIFY",
    label: shop.replace(".myshopify.com", ""),
    status: "ACTIVE",
    credentials: {
      shop,
      accessToken: token.accessToken,
      scope: token.scope,
    },
    metadata: {
      shop,
      connectedAt: new Date().toISOString(),
      scope: token.scope,
      apiVersion,
    },
  });

  // Webhooks + sync em background-ish (await curto; erros não bloqueiam connect)
  try {
    await registerShopifyWebhooks({
      shop,
      accessToken: token.accessToken,
      apiVersion,
      callbackBaseUrl: request.nextUrl.origin,
      workspaceId: pending.clienteId,
    });
  } catch (err) {
    console.error(
      "[shopify-oauth] webhook register",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    await syncShopifyWorkspace(pending.clienteId, { daysBack: 90, maxPages: 5 });
  } catch (err) {
    console.error(
      "[shopify-oauth] initial sync",
      err instanceof Error ? err.message : err,
    );
  }

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "SHOPIFY");
  return NextResponse.redirect(hub);
}
