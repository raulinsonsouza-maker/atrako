import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  assertSlotAvailable,
  getAvailableDays,
  getAvailableSlots,
} from "@/lib/availability";
import { emitBookingEvent } from "@/lib/events/booking-events";

async function loadByToken(token: string) {
  return prisma.booking.findFirst({
    where: { manageToken: token },
    include: {
      service: true,
      bookingPage: {
        include: { organization: true },
      },
      payment: true,
    },
  });
}

function publicBooking(booking: NonNullable<Awaited<ReturnType<typeof loadByToken>>>) {
  return {
    id: booking.id,
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.timezone,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    serviceTitle: booking.service.title,
    durationMinutes: booking.service.durationMinutes,
    priceCents: booking.service.priceCents,
    pageTitle: booking.bookingPage.title,
    pageSlug: booking.bookingPage.slug,
    orgName: booking.bookingPage.organization.name,
    orgSlug: booking.bookingPage.organization.slug,
    accentColor:
      booking.bookingPage.accentColor ||
      booking.bookingPage.organization.accentColor ||
      "#0a0a0a",
    logoUrl:
      booking.bookingPage.logoUrl ||
      booking.bookingPage.organization.logoUrl ||
      null,
    meetLink: booking.googleMeetLink,
    canReschedule: booking.status === "CONFIRMED",
    canCancel: booking.status === "CONFIRMED",
    paymentStatus: booking.payment?.status ?? null,
    professionalId: booking.professionalId,
    holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    serviceId: booking.serviceId,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await loadByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "N├úo encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const salon = booking.bookingPage.organization.businessMode === "SALON";
  const professionalId = salon ? booking.professionalId : null;

  if (date && booking.status === "CONFIRMED") {
    const slots = await getAvailableSlots({
      bookingPageId: booking.bookingPageId,
      serviceId: booking.serviceId,
      date,
      timezone: booking.timezone,
      durationMinutes: booking.service.durationMinutes,
      bufferBefore: booking.service.bufferBefore,
      bufferAfter: booking.service.bufferAfter,
      slotStepMinutes: booking.bookingPage.slotStepMinutes || undefined,
      professionalId,
    });
    return NextResponse.json({ booking: publicBooking(booking), slots });
  }

  const days =
    booking.status === "CONFIRMED"
      ? await getAvailableDays({
          bookingPageId: booking.bookingPageId,
          from: new Date(),
          timezone: booking.timezone,
          professionalId,
        })
      : [];

  return NextResponse.json({
    booking: publicBooking(booking),
    availableDays: days,
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reschedule"),
    startAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const booking = await loadByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "N├úo encontrado" }, { status: 404 });
  }

  try {
    const body = actionSchema.parse(await req.json());

    if (body.action === "cancel") {
      if (booking.status !== "CONFIRMED") {
        return NextResponse.json(
          { error: "S├│ ├® poss├¡vel cancelar agendamentos confirmados" },
          { status: 400 },
        );
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await emitBookingEvent({
        type: "booking.cancelled",
        organizationId: booking.bookingPage.organizationId,
        bookingId: booking.id,
        dedupeKey: `manage-cancel-${booking.id}-${Date.now()}`,
      });
      const updated = await loadByToken(token);
      return NextResponse.json({
        ok: true,
        booking: updated ? publicBooking(updated) : null,
      });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "S├│ ├® poss├¡vel remarcar agendamentos confirmados" },
        { status: 400 },
      );
    }

    const startAt = new Date(body.startAt);
    const endAt = addMinutes(startAt, booking.service.durationMinutes);
    const salon = booking.bookingPage.organization.businessMode === "SALON";
    const professionalId = salon ? booking.professionalId : null;

    await assertSlotAvailable({
      bookingPageId: booking.bookingPageId,
      serviceId: booking.serviceId,
      startAt,
      endAt,
      timezone: booking.timezone,
      durationMinutes: booking.service.durationMinutes,
      bufferBefore: booking.service.bufferBefore,
      bufferAfter: booking.service.bufferAfter,
      excludeBookingId: booking.id,
      professionalId,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { startAt, endAt },
    });

    await emitBookingEvent({
      type: "booking.rescheduled",
      organizationId: booking.bookingPage.organizationId,
      bookingId: booking.id,
      dedupeKey: `reschedule-${startAt.toISOString()}`,
    });

    const updated = await loadByToken(token);
    return NextResponse.json({
      ok: true,
      booking: updated ? publicBooking(updated) : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 400 },
    );
  }
}