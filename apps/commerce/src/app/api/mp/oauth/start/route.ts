import { NextRequest, NextResponse } from "next/server";
import { createPkce, getAuthorizationUrl } from "@/lib/mercadopago/oauth";
import { requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { codeVerifier, codeChallenge, state } = createPkce();
  const test = req.nextUrl.searchParams.get("test") === "1";

  const res = NextResponse.redirect(getAuthorizationUrl({ state, codeChallenge }));
  res.cookies.set("mp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  res.cookies.set("mp_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  res.cookies.set("mp_oauth_test", test ? "1" : "0", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
