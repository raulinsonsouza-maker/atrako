/**
 * Cron de carrinho abandonado (a cada 15 min):
 * puxa checkouts das lojas → promove carrinhos vencidos (coluna + WhatsApp) → expira antigos.
 * Invocar via GET /api/atrako/whatsapp/cron-abandonment?secret=CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { pollAbandonedCheckouts } from "@/lib/crm/abandoned-checkout-poll";
import { runAbandonedCartSweep } from "@/lib/crm/abandoned-cart";

export const maxDuration = 300;

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return request.nextUrl.searchParams.get("secret") === expected || bearer === expected;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const checkouts = await pollAbandonedCheckouts();
  const sweep = await runAbandonedCartSweep();
  return NextResponse.json({
    ok: true,
    checkouts: {
      synced: checkouts.reduce((s, r) => s + (r.synced ?? 0), 0),
      errors: checkouts.filter((r) => r.error),
    },
    ...sweep,
  });
}

export const POST = GET;
