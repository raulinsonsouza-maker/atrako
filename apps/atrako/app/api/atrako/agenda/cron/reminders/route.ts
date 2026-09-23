/**
 * Cron: lembretes de booking (e-mail/WhatsApp quando flags existirem).
 * Invocar via GET /api/atrako/agenda/cron/reminders?secret=CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { addHours } from "date-fns";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET?.trim();
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = addHours(now, 24);

  const upcoming = await prisma.agendaBooking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startAt: { gte: now, lte: windowEnd },
    },
    include: {
      service: true,
      cliente: { select: { nome: true, slug: true } },
    },
    take: 100,
  });

  let marked = 0;
  for (const booking of upcoming) {
    // Placeholder: integra Resend/WhatsApp quando flags do workspace existirem.
    // Por enquanto só marca reminderSentAt para evitar reprocessamento.
    await prisma.agendaBooking.update({
      where: { id: booking.id },
      data: { reminderSentAt: now },
    });
    marked += 1;
  }

  const expired = await prisma.agendaBooking.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      holdExpiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  return NextResponse.json({
    remindersMarked: marked,
    expiredHolds: expired.count,
  });
}
