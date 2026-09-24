import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { buildShopeeAuthPartnerUrl } from "@/lib/integrations/shopee/oauth";

/** Inicia OAuth Shopee (auth_partner assinado). */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("SHOPEE");
  const partnerId =
    app?.credentials.clientId?.trim() || process.env.SHOPEE_PARTNER_ID?.trim();
  const partnerKey =
    app?.credentials.clientSecret?.trim() || process.env.SHOPEE_PARTNER_KEY?.trim();
  const redirectUri =
    app?.credentials.redirectUri?.trim() ||
    process.env.SHOPEE_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/atrako/oauth/shopee/callback`;

  if (!app?.enabled || !partnerId || !partnerKey) {
    return NextResponse.json(
      {
        error: "Shopee app não configurado",
        hint: "Configure Partner ID/Key em /admin/apps (SHOPEE)",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "SHOPEE",
      clienteId: workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // redirect inclui state via query no redirect URI
  const redirectWithState = new URL(redirectUri);
  redirectWithState.searchParams.set("state", state);

  const url = buildShopeeAuthPartnerUrl({
    apiBaseUrl:
      (typeof app.credentials.apiBaseUrl === "string" && app.credentials.apiBaseUrl) ||
      process.env.SHOPEE_API_BASE_URL,
    partnerId,
    partnerKey,
    redirectUri: redirectWithState.toString(),
  });

  return NextResponse.redirect(url);
}
