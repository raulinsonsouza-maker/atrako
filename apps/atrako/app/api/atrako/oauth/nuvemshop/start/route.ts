import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { buildNuvemshopAuthorizeUrl } from "@/lib/integrations/nuvemshop/oauth";

/** Inicia OAuth Nuvemshop (authorize por app id — sem domínio da loja). */
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
  const app = await resolvePlatformApp("NUVEMSHOP");
  const clientId =
    app?.credentials.clientId?.trim() || process.env.NUVEMSHOP_CLIENT_ID?.trim();
  if (!app?.enabled || !clientId) {
    return NextResponse.json(
      {
        error: "Nuvemshop app não configurado",
        hint: "Configure Client ID/Secret em /admin/apps (NUVEMSHOP)",
      },
      { status: 503 },
    );
  }

  const redirectUri =
    app.credentials.redirectUri?.trim() ||
    process.env.NUVEMSHOP_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/api/atrako/oauth/nuvemshop/callback`;

  const state = randomBytes(16).toString("hex");
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "NUVEMSHOP",
      clienteId: workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const url = buildNuvemshopAuthorizeUrl({ clientId, state });
  return NextResponse.redirect(url);
}
