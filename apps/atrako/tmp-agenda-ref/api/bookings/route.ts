import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emitBookingEvent } from "@/lib/events/booking-events";
import {
  apiRequireStaff,
  bookingScopeWhere,
  isProfessionalRole,
} from "@/lib/rbac";

export async function GET(req: Request) {
  const auth = await apiRequireStaff();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const bookingPageId = searchParams.get("bookingPageId");
  const professionalIdParam = searchParams.get("professionalId");

  const scope = bookingScopeWhere(ctx);

  const bookings = await prisma.booking.findMany({
    where: {
      ...scope,
      ...(bookingPageId && !isProfessionalRole(ctx.role)
        ? { bookingPageId }
        : {}),
      ...(professionalIdParam && !isProfessionalRole(ctx.role)
        ? { professionalId: professionalIdParam }
        : {}),
      ...(status === "ACTIVE"
        ? { status: { in: ["CONFIRMED", "PENDING_PAYMENT"] as const } }
        : status
          ? {
              status: status as
                | "CONFIRMED"
                | "PENDING_PAYMENT"
                | "CANCELLED"
                | "EXPIRED",
            }
          : {}),
      ...(from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q } },
              { customerEmail: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      service: true,
      bookingPage: { select: { title: true, slug: true } },
      professional: { select: { id: true, displayName: true } },
      payment: true,
    },
    orderBy: { startAt: "desc" },
    take: 200,
  });
  return NextResponse.json(bookings);
}

const cancelSchema = z.object({ id: z.string() });

export async function PATCH(req: Request) {
  const auth = await apiRequireStaff();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = cancelSchema.parse(await req.json());
    const booking = await prisma.booking.findFirst({
      where: {
        id,
        ...bookingScopeWhere(ctx),
      },
      include: {
        bookingPage: true,
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json(booking);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await prisma.slotHold.deleteMany({ where: { bookingId: id } });

    await emitBookingEvent({
      type: "booking.cancelled",
      organizationId: booking.bookingPage.organizationId,
      bookingId: id,
      dedupeKey: `cancel-${id}`,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro" }, { status: 400 });
  }
}