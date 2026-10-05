import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  buildTiktokShopAuthorizeUrl,
  resolveTiktokShopApp,
} from "@/lib/integrations/tiktok-shop/oauth";
import { getPublicOrigin } from "@/lib/http/public-origin";

/** Inicia OAuth TikTok Shop (services.tiktokshop.com/open/authorize). */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const app = await resolveTiktokShopApp(getPublicOrigin(request));
  if (!app.enabled || !app.appKey || !app.appSecret || !app.serviceId) {
    return NextResponse.json(
      {
        error: "TikTok Shop app não configurado",
        hint: "Configure App Key, App Secret e Service ID em /admin/apps (TIKTOK_SHOP)",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "TIKTOK_SHOP",
      clienteId: workspaceId,
      redirectUri: app.redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  return NextResponse.redirect(
    buildTiktokShopAuthorizeUrl({
      authBaseUrl: app.authBaseUrl,
      serviceId: app.serviceId,
      state,
    }),
  );
}
