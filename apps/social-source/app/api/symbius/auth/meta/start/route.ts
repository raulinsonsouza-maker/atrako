import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/symbius/auth";
import { buildMetaOAuthUrl } from "@/lib/instagram/metaOAuth";

const OAUTH_STATE_COOKIE = "symbius_meta_oauth_state";

const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

function redirectToMetaOAuth(state: string): NextResponse {
  const res = NextResponse.redirect(buildMetaOAuthUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_STATE_COOKIE_OPTIONS);
  return res;
}

export async function GET(request: NextRequest) {
  const intentParam = request.nextUrl.searchParams.get("intent");
  const popup = request.nextUrl.searchParams.get("popup") === "1";
  const returnTo =
    request.nextUrl.searchParams.get("returnTo") ?? "/app/connect";

  const session = await getSession();

  // Autenticação / cadastro via Instagram (sem sessão)
  if (intentParam === "auth" || !session) {
    if (intentParam !== "auth" && !session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const state = Buffer.from(
      JSON.stringify({
        intent: "auth",
        ts: Date.now(),
        returnTo: request.nextUrl.searchParams.get("returnTo") ?? "/app",
        popup,
      }),
    ).toString("base64url");

    return redirectToMetaOAuth(state);
  }

  // Conectar/atualizar canal (usuário já logado)
  const state = Buffer.from(
    JSON.stringify({
      intent: "connect",
      organizationId: session.organizationId,
      userId: session.userId,
      ts: Date.now(),
      returnTo,
      popup,
    }),
  ).toString("base64url");

  return redirectToMetaOAuth(state);
}
