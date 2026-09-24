import { NextResponse } from "next/server";
import { buildOAuthCompleteUrl } from "@/lib/oauth/openOAuthPopup";

/** Redirect pós-OAuth → bridge (popup postMessage ou same-tab → hub). */
export function oauthCompleteRedirect(
  origin: string,
  params: Record<string, string | null | undefined>,
) {
  return NextResponse.redirect(buildOAuthCompleteUrl(origin, params));
}
