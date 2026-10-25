import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { getPublicOrigin } from "@/lib/http/public-origin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const hub = new URL("/config/conexoes/oauth-complete", getPublicOrigin(request));

  if (!code || !state) {
    hub.searchParams.set("error", "oauth_missing");
    return NextResponse.redirect(hub);
  }

  const pending = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!pending || pending.expiresAt < new Date() || pending.provider !== "INSTAGRAM") {
    hub.searchParams.set("error", "oauth_expired");
    return NextResponse.redirect(hub);
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("META");
  const appId =
    app?.credentials.clientId?.trim() ||
    process.env.SYMBIUS_IG_APP_ID?.trim() ||
    process.env.META_APP_ID?.trim() ||
    process.env.SYMBIUS_META_APP_ID?.trim();
  const appSecret =
    app?.credentials.clientSecret?.trim() ||
    process.env.SYMBIUS_IG_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    process.env.SYMBIUS_META_APP_SECRET?.trim();
  const redirectUri =
    pending.redirectUri ||
    `${getPublicOrigin(request)}/api/atrako/oauth/instagram/callback`;

  await prisma.workspaceOAuthPending.delete({ where: { id: pending.id } }).catch(() => null);

  if (!appId || !appSecret) {
    hub.searchParams.set("error", "ig_not_configured");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const res = await fetch(tokenUrl.toString());
  if (!res.ok) {
    hub.searchParams.set("error", "ig_token_failed");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  const token = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  if (!token.access_token) {
    hub.searchParams.set("error", "ig_token_empty");
    hub.searchParams.set("workspaceId", pending.clienteId);
    return NextResponse.redirect(hub);
  }

  // Long-lived token
  let accessToken = token.access_token;
  let expiresIn = token.expires_in ?? null;
  try {
    const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", token.access_token);
    const longRes = await fetch(longUrl.toString());
    if (longRes.ok) {
      const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number };
      if (longJson.access_token) {
        accessToken = longJson.access_token;
        expiresIn = longJson.expires_in ?? expiresIn;
      }
    }
  } catch {
    /* keep short-lived */
  }

  await upsertWorkspaceConnection({
    clienteId: pending.clienteId,
    provider: "INSTAGRAM",
    label: "Instagram",
    credentials: {
      accessToken,
      expiresIn,
      tokenType: token.token_type ?? "bearer",
    },
    metadata: { connectedAt: new Date().toISOString() },
  });

  // Resolve IG account via /me/accounts to populate igAccount in db-social
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (pagesRes.ok) {
      const pagesJson = (await pagesRes.json()) as {
        data?: Array<{ id: string; name?: string; instagram_business_account?: { id: string; username?: string } }>;
      };
      for (const page of pagesJson.data ?? []) {
        const ig = page.instagram_business_account;
        if (!ig?.id) continue;
        const { prisma: socialPrisma } = await import("@/lib/db-social");
        let org = await socialPrisma.organization.findFirst({
          where: { centralClienteId: pending.clienteId },
        });
        if (!org) {
          const slug = `ws-${pending.clienteId}`.slice(0, 60);
          org = await socialPrisma.organization.create({
            data: {
              nome: "Workspace",
              slug: `${slug}-${Date.now().toString(36)}`,
              centralClienteId: pending.clienteId,
              onboardingDone: true,
            },
          });
        }
          await socialPrisma.igAccount.upsert({
            where: { organizationId_igUserId: { organizationId: org.id, igUserId: ig.id } },
            create: {
              organizationId: org.id,
              pageName: page.name ?? null,
              accessToken,
              igUserId: ig.id,
              igUsername: ig.username ?? null,
              status: "CONNECTED",
              messagesEnabled: true,
              tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
              webhookSubscribedAt: new Date(),
            },
            update: {
              pageName: page.name ?? null,
              accessToken,
              igUsername: ig.username ?? null,
              status: "CONNECTED",
              messagesEnabled: true,
              tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
              webhookSubscribedAt: new Date(),
            },
          });
        }
      }
    }
  } catch (e) {
    console.warn("[instagram-oauth] failed to upsert igAccount", e instanceof Error ? e.message : e);
  }

  hub.searchParams.set("workspaceId", pending.clienteId);
  hub.searchParams.set("connected", "INSTAGRAM");
  return NextResponse.redirect(hub);
}
