/**
 * Cron: libera noites de Pix vencido e avisa o check-in da véspera.
 * GET /api/atrako/stay/cron/reminders?secret=CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { expireStayHolds } from "@/lib/stay/reservations";
import { remindStayCheckins } from "@/lib/stay/messages";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET?.trim();
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const expired = await expireStayHolds();
  const reminders = await remindStayCheckins();
  return NextResponse.json({ ok: true, expired, reminders });
}
