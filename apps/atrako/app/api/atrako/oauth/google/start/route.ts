import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { getPublicOrigin } from "@/lib/http/public-origin";
import { GOOGLE_RETURN_COOKIE, guestCookieOptions, safeReturnPath, signGoogleReturn } from "@/lib/identity/guest-session";

function createPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { codeVerifier, codeChallenge, state };
}

/** Login Google da plataforma. Escopo só identidade; o cookie serve a todos os segmentos. */
export async function GET(request: NextRequest) {
  const clienteId = request.nextUrl.searchParams.get("clienteId")?.trim() || "";
  if (!clienteId || !(await findWorkspaceById(clienteId))) {
    return NextResponse.json({ error: "Workspace inválido." }, { status: 400 });
  }

  const { resolvePlatformApp } = await import("@/lib/config/platformApps");
  const app = await resolvePlatformApp("GOOGLE");
  const clientId = app?.credentials.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "Login com Google não está configurado." }, { status: 503 });
  }

  const redirectUri = `${getPublicOrigin(request)}/api/atrako/oauth/google/callback`;
  const { codeVerifier, codeChallenge, state } = createPkce();
  await prisma.workspaceOAuthPending.create({
    data: {
      state,
      provider: "GOOGLE_LOGIN",
      clienteId,
      codeVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(url.toString());
  response.cookies.set(
    GOOGLE_RETURN_COOKIE,
    signGoogleReturn({ state, returnTo }),
    guestCookieOptions(15 * 60),
  );
  return response;
}
