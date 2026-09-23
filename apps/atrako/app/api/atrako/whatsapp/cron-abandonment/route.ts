import { NextResponse } from "next/server";
import { emitAbandonedCommerceOrders } from "@/lib/whatsapp/triggers";

/** Cron interno: emite checkout.abandoned para pedidos PENDING antigos (dispara WPP). */
export async function POST() {
  const result = await emitAbandonedCommerceOrders({ olderThanMinutes: 60 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return POST();
}
