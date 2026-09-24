import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getPublicOrigin } from "@/lib/http/public-origin";

const GOOGLE_OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

/** Inicia OAuth Google Ads — cada dealer autoriza a própria conta (sem MCC Atrako). */
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
  const app = await resolvePlatformApp("GOOGLE_ADS");
  if (!app?.enabled) {
    return NextResponse.json(
      { error: "Google Ads app desabilitado em /admin/apps" },
      { status: 503 },
    );
  }
  const clientId =
    app.credentials.clientId?.trim() ||
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri =
    app.credentials.redirectUri?.trim() ||
    process.env.GOOGLE_ADS_REDIRECT_URI?.trim() ||
    `${getPublicOrigin(request)}/api/atrako/oauth/google-ads/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Google Ads Client ID não configurado",
        hint: "Configure Google Ads em /admin/apps",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "GOOGLE_ADS",
      clienteId: workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const url = new URL(GOOGLE_OAUTH_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ADS_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
