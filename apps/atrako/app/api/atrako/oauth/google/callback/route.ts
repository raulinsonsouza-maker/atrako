import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getPublicOrigin } from "@/lib/http/public-origin";
import { saveGuestProfile } from "@/lib/identity/guest";
import {
  GOOGLE_RETURN_COOKIE,
  GUEST_COOKIE,
  guestCookieOptions,
  readGoogleReturn,
  safeReturnPath,
  signGuest,
} from "@/lib/identity/guest-session";

function back(origin: string, returnTo: string, error?: string) {
  const url = new URL(safeReturnPath(returnTo), origin);
  if (error) url.searchParams.set("guest", "error");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const jar = await cookies();
  const pendingReturn = readGoogleReturn(jar.get(GOOGLE_RETURN_COOKIE)?.value);
  const returnTo = pendingReturn?.returnTo || "/";
  const fail = (error: string) => {
    const response = back(origin, returnTo, error);
    response.cookies.set(GOOGLE_RETURN_COOKIE, "", guestCookieOptions(0));
    return response;
  };

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (error || !code || !state || !pendingReturn || pendingReturn.state !== state) {
    return fail("login");
  }

  const row = await prisma.workspaceOAuthPending.findUnique({ where: { state } });
  if (!row || row.provider !== "GOOGLE_LOGIN" || row.expiresAt.getTime() < Date.now() || !row.codeVerifier || !row.redirectUri) {
    return fail("expired");
  }
  await prisma.workspaceOAuthPending.delete({ where: { id: row.id } }).catch(() => null);

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("GOOGLE");
  const clientId = app?.credentials.clientId?.trim();
  const clientSecret = app?.credentials.clientSecret?.trim();
  if (!clientId || !clientSecret) return fail("config");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: row.redirectUri,
      grant_type: "authorization_code",
      code_verifier: row.codeVerifier,
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenRes.ok || !token.access_token) return fail("token");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileRes.json().catch(() => ({}))) as {
    sub?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
  };
  if (!profileRes.ok || !profile.email) return fail("profile");

  try {
    const guest = await saveGuestProfile({
      workspaceId: row.clienteId,
      firstName: profile.given_name,
      lastName: profile.family_name,
      name: profile.name,
      email: profile.email,
      googleSub: profile.sub,
      source: "google",
    });
    const response = back(origin, returnTo);
    response.cookies.set(GUEST_COOKIE, signGuest(guest), guestCookieOptions());
    response.cookies.set(GOOGLE_RETURN_COOKIE, "", guestCookieOptions(0));
    return response;
  } catch {
    return fail("profile");
  }
}
