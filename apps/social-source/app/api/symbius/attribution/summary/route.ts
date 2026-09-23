import { NextRequest, NextResponse } from "next/server";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { getAttributionSummary } from "@/lib/symbius/attribution/reporting";
import type { AttributionModel } from "@/lib/symbius/attribution/types";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const sp = request.nextUrl.searchParams;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from")
    ? new Date(sp.get("from")!)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const model = (sp.get("model") as AttributionModel) || "first_touch";

  const summary = await getAttributionSummary({
    organizationId: session.organizationId,
    from,
    to,
    model,
  });

  return NextResponse.json(summary);
}
