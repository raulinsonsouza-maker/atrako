import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeLinkedinCode } from "@/lib/linkedin/linkedinClient";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const err = request.nextUrl.searchParams.get("error");
  const origin = request.nextUrl.origin;

  if (err || !code || !state) {
    return NextResponse.redirect(
      `${origin}/config/conexoes?error=${encodeURIComponent(err || "oauth_denied")}`,
    );
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.provider !== "LINKEDIN_ADS" || pending.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/config/conexoes?error=invalid_state`);
  }

  try {
    const tokens = await exchangeLinkedinCode(code, pending.redirectUri || `${origin}/api/atrako/oauth/linkedin/callback`);
    const now = Date.now();
    await upsertWorkspaceConnection({
      clienteId: pending.clienteId,
      provider: "LINKEDIN_ADS",
      label: "LinkedIn Ads",
      credentials: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(now + tokens.expires_in * 1000).toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);
    return NextResponse.redirect(`${origin}/config/conexoes?error=${encodeURIComponent(msg)}`);
  }

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);
  return NextResponse.redirect(`${origin}/config/conexoes?connected=LINKEDIN_ADS`);
}
