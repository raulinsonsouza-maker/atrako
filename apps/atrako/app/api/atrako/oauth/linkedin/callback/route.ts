import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeLinkedinCode } from "@/lib/linkedin/linkedinClient";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { oauthCompleteRedirect } from "@/lib/oauth/oauthCompleteRedirect";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const err = request.nextUrl.searchParams.get("error");
  const origin = request.nextUrl.origin;

  if (err || !code || !state) {
    return oauthCompleteRedirect(origin, {
      error: err || "oauth_denied",
      ok: "0",
    });
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.provider !== "LINKEDIN_ADS" || pending.expiresAt < new Date()) {
    return oauthCompleteRedirect(origin, { error: "invalid_state", ok: "0" });
  }

  try {
    const tokens = await exchangeLinkedinCode(
      code,
      pending.redirectUri || `${origin}/api/atrako/oauth/linkedin/callback`,
    );
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
    return oauthCompleteRedirect(origin, {
      error: msg,
      workspaceId: pending.clienteId,
      ok: "0",
    });
  }

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);
  return oauthCompleteRedirect(origin, {
    connected: "LINKEDIN_ADS",
    workspaceId: pending.clienteId,
    ok: "1",
  });
}
