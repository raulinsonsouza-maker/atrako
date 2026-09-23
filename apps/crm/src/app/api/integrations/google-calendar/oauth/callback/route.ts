import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/google-calendar";
import { sanitizeReturnTo, verifyOAuthState } from "@/lib/integrations/google-calendar-state";
import { createConnectionFromOAuth } from "@/server/actions/calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const origin = req.nextUrl.origin;
  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?calendar=error", origin));
  }

  try {
    const state = verifyOAuthState(stateParam);
    const tokens = await exchangeCodeForTokens(code);
    await createConnectionFromOAuth({
      userId: state.userId,
      tenantId: state.tenantId,
      calendarId: "primary",
      accessToken: tokens.accessToken ?? undefined,
      refreshToken: tokens.refreshToken ?? undefined,
      tokenExpiresAt: tokens.tokenExpiresAt ?? undefined,
    });
    const returnTo = sanitizeReturnTo(state.returnTo);
    return NextResponse.redirect(new URL(returnTo, origin));
  } catch (err) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?calendar=error", origin));
  }
}
