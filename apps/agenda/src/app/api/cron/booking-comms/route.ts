import { NextResponse } from "next/server";
import { addHours, addMinutes, subHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import { emitBookingEvent } from "@/lib/events/booking-events";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

export async function POST(req: Request) {
  if (!authorize(req)) return unauthorized();

  const now = new Date();
  const summary = {
    reminders: 0,
    pixPending: 0,
    feedback: 0,
    expiredHolds: 0,
  };

  // Expire stale holds
  const expired = await prisma.booking.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      holdExpiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
  summary.expiredHolds = expired.count;
  await prisma.slotHold.deleteMany({ where: { expiresAt: { lt: now } } });

  // Client reminders
  const orgs = await prisma.organization.findMany({
    where: {
      notifyClientReminder: true,
      reminderHoursBefore: { gt: 0 },
    },
    select: {
      id: true,
      reminderHoursBefore: true,
    },
  });

  for (const org of orgs) {
    const windowStart = addHours(now, org.reminderHoursBefore - 1);
    const windowEnd = addHours(now, org.reminderHoursBefore);
    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        reminderSentAt: null,
        startAt: { gte: windowStart, lte: windowEnd },
        bookingPage: { organizationId: org.id },
      },
      select: { id: true },
      take: 100,
    });
    for (const b of bookings) {
      await emitBookingEvent({
        type: "booking.reminder",
        organizationId: org.id,
        bookingId: b.id,
        dedupeKey: `reminder-${org.reminderHoursBefore}h`,
      });
      summary.reminders += 1;
    }
  }

  // Pix pending ~45 minutes after creation, still unpaid
  const pixCutoff = subHours(now, 1);
  const pixMinAge = addMinutes(now, -50);
  const pendingPix = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      pixReminderSentAt: null,
      createdAt: { lte: pixMinAge, gte: pixCutoff },
      holdExpiresAt: { gt: now },
      payment: { method: "PIX", status: "PENDING" },
    },
    include: { bookingPage: { select: { organizationId: true } } },
    take: 50,
  });
  for (const b of pendingPix) {
    await emitBookingEvent({
      type: "payment.pending",
      organizationId: b.bookingPage.organizationId,
      bookingId: b.id,
      dedupeKey: "pix-45m",
    });
    summary.pixPending += 1;
  }

  // Feedback after appointment ended (orgs with toggle)
  const feedbackOrgs = await prisma.organization.findMany({
    where: { notifyClientFeedback: true },
    select: { id: true },
  });
  for (const org of feedbackOrgs) {
    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        feedbackSentAt: null,
        endAt: { lte: now, gte: subHours(now, 48) },
        bookingPage: { organizationId: org.id },
      },
      select: { id: true },
      take: 50,
    });
    for (const b of bookings) {
      await emitBookingEvent({
        type: "booking.completed",
        organizationId: org.id,
        bookingId: b.id,
        dedupeKey: "feedback",
      });
      summary.feedback += 1;
    }
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), summary });
}

export async function GET(req: Request) {
  return POST(req);
}
