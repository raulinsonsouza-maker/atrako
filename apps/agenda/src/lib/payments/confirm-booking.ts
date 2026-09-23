import { prisma } from "@/lib/prisma";
import { emitBookingEvent, SlotUnavailableError } from "@/lib/events/booking-events";

export { SlotUnavailableError };

export async function confirmBooking(bookingId: string) {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      bookingPage: true,
    },
  });

  if (!existing) {
    throw new Error("Agendamento não encontrado");
  }

  if (existing.status !== "CONFIRMED") {
    const { assertSlotAvailable } = await import("@/lib/availability");
    try {
      await assertSlotAvailable({
        bookingPageId: existing.bookingPageId,
        serviceId: existing.serviceId,
        startAt: existing.startAt,
        endAt: existing.endAt,
        timezone: existing.timezone,
        durationMinutes: existing.service.durationMinutes,
        bufferBefore: existing.service.bufferBefore,
        bufferAfter: existing.service.bufferAfter,
        excludeBookingId: bookingId,
        professionalId: existing.professionalId,
      });
    } catch (e) {
      if (e instanceof SlotUnavailableError) {
        await prisma.$transaction([
          prisma.booking.update({
            where: { id: bookingId },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              holdExpiresAt: null,
            },
          }),
          prisma.slotHold.deleteMany({ where: { bookingId } }),
        ]);
      }
      throw e;
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        holdExpiresAt: null,
      },
    });
    await prisma.slotHold.deleteMany({ where: { bookingId } });
  }

  await emitBookingEvent({
    type: "booking.confirmed",
    organizationId: existing.bookingPage.organizationId,
    bookingId,
    dedupeKey: bookingId,
  });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      bookingPage: true,
    },
  });
  if (!booking) throw new Error("Agendamento não encontrado");
  return booking;
}

export async function markPaymentPaidAndConfirm(bookingId: string, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: { service: true, bookingPage: true },
      },
    },
  });
  if (!payment || payment.bookingId !== bookingId || !payment.booking) return null;

  if (payment.status !== "PAID") {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  if (payment.booking.status === "CONFIRMED") {
    await emitBookingEvent({
      type: "booking.confirmed",
      organizationId: payment.booking.bookingPage.organizationId,
      bookingId,
      dedupeKey: bookingId,
    });
    return payment.booking;
  }

  return confirmBooking(bookingId);
}
