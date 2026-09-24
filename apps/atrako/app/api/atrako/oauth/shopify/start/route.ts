import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  buildShopifyAuthorizeUrl,
  DEFAULT_SHOPIFY_SCOPES,
  normalizeShopifyShop,
} from "@/lib/integrations/shopify/oauth";
import { getPublicOrigin } from "@/lib/http/public-origin";

/**
 * Inicia OAuth Shopify.
 * Query: workspaceId + shop (ex.: loja ou loja.myshopify.com)
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const shopRaw = request.nextUrl.searchParams.get("shop")?.trim() || "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const shop = normalizeShopifyShop(shopRaw);
  if (!shop) {
    return NextResponse.json(
      { error: "Informe o domínio da loja (ex.: minha-loja.myshopify.com)" },
      { status: 400 },
    );
  }

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;

  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("SHOPIFY");
  const clientId =
    app?.credentials.clientId?.trim() ||
    process.env.SHOPIFY_API_KEY?.trim() ||
    process.env.SHOPIFY_CLIENT_ID?.trim();
  if (!app?.enabled || !clientId) {
    return NextResponse.json(
      {
        error: "Shopify app não configurado",
        hint: "Configure Client ID/Secret em /admin/apps (SHOPIFY)",
      },
      { status: 503 },
    );
  }

  const redirectUri =
    app.credentials.redirectUri?.trim() ||
    process.env.SHOPIFY_REDIRECT_URI?.trim() ||
    `${getPublicOrigin(request)}/api/atrako/oauth/shopify/callback`;

  const scopes =
    (typeof app.credentials.scopes === "string" && app.credentials.scopes.trim()) ||
    DEFAULT_SHOPIFY_SCOPES;

  const nonce = randomBytes(16).toString("hex");
  // state carrega shop para o callback (sem coluna extra no pending)
  const state = `${nonce}.${shop}`;

  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "SHOPIFY",
      clienteId: workspaceId,
      codeVerifier: shop,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const url = buildShopifyAuthorizeUrl({
    shop,
    clientId,
    scopes,
    redirectUri,
    state,
  });

  return NextResponse.redirect(url);
}
