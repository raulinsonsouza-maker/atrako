import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPublicOrigin } from "@/lib/http/public-origin";

/** Inicia OAuth Instagram (Meta) centralizado no Atrako. */
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
  const app = await resolvePlatformApp("META");
  const appId =
    app?.credentials.clientId?.trim() ||
    process.env.SYMBIUS_IG_APP_ID?.trim() ||
    process.env.META_APP_ID?.trim() ||
    process.env.SYMBIUS_META_APP_ID?.trim();
  const redirectUri =
    app?.credentials.redirectUri?.trim() ||
    process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
    `${getPublicOrigin(request)}/api/atrako/oauth/instagram/callback`;

  if (!appId) {
    return NextResponse.json(
      {
        error: "Instagram app id not configured",
        hint: "Configure Meta em /admin/apps",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "INSTAGRAM",
      clienteId: workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const scopes = [
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "pages_show_list",
    "pages_manage_metadata",
    "business_management",
  ].join(",");

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url.toString());
}
