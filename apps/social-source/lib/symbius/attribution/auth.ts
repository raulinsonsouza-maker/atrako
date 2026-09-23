import { NextRequest, NextResponse } from "next/server";
import { verifyPublicApiKey } from "@/lib/symbius/integrations";

export async function requirePublicApiOrg(
  request: NextRequest,
): Promise<{ organizationId: string } | NextResponse> {
  const apiKey = request.headers.get("x-api-key");
  const orgId = request.headers.get("x-organization-id");
  if (!orgId || !apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await verifyPublicApiKey(orgId, apiKey);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { organizationId: orgId };
}

export function isAuthError(
  result: { organizationId: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
