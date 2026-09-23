import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getGoogleAuthUrl } from "@/lib/integrations/google-calendar";
import { signOAuthState, sanitizeReturnTo } from "@/lib/integrations/google-calendar-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  const tenantId = (session?.user as { tenantId?: string | null })?.tenantId;
  if (!userId || !tenantId) return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));

  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const state = signOAuthState({ userId, tenantId, returnTo });
  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
