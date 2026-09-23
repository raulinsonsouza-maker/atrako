import { prisma } from "@/lib/prisma";
import {
  markPaymentPaidAndConfirm,
  SlotUnavailableError,
} from "@/lib/payments/confirm-booking";
import { isRemotePaymentPaid } from "@/lib/payments/is-remote-payment-paid";

/**
 * Se o webhook atrasar, consulta o provedor e confirma o booking se Pix/cartão já estiver pago.
 */
export async function reconcileBookingPaymentIfNeeded(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      bookingPage: { include: { organization: true } },
    },
  });
  if (!booking) return null;
  if (booking.status === "CONFIRMED") return booking;
  if (booking.status !== "PENDING_PAYMENT" || !booking.payment) return booking;
  if (booking.payment.status === "PAID") {
    try {
      await markPaymentPaidAndConfirm(booking.id, booking.payment.id);
    } catch (e) {
      if (!(e instanceof SlotUnavailableError)) throw e;
    }
    return reloadBooking(bookingId);
  }

  const providerPaymentId = booking.payment.caktoPaymentId;
  if (!providerPaymentId || providerPaymentId.startsWith("demo_")) {
    return booking;
  }

  const org = booking.bookingPage.organization;

  try {
    const paid = await isRemotePaymentPaid({
      provider: booking.payment.provider,
      providerPaymentId,
      org,
    });
    if (!paid) return booking;
    await markPaymentPaidAndConfirm(booking.id, booking.payment.id);
  } catch (e) {
    if (e instanceof SlotUnavailableError) {
      console.warn("[reconcile] slot unavailable", bookingId);
      return reloadBooking(bookingId);
    }
    console.warn("[reconcile] provider check failed", bookingId, e);
    return booking;
  }

  return reloadBooking(bookingId);
}

function reloadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      bookingPage: { include: { organization: true } },
    },
  });
}
