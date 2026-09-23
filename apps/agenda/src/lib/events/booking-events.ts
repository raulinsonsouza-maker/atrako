import { prisma } from "@/lib/prisma";
import {
  sendBookingCancelledClient,
  sendBookingCancelledPro,
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingRescheduledClient,
  sendBookingRescheduledPro,
  sendFeedbackRequest,
  sendPaymentFailed,
  sendPixPending,
  sendProNewBooking,
} from "@/lib/email";
import {
  ensureManageToken,
  getOwnerNotifyEmail,
  manageBookingUrl,
} from "@/lib/booking-notify";
import { appUrl } from "@/lib/email/templates/layout";
import { bookingPublicPath } from "@/lib/booking-page-slug";
import { deleteCalendarEvent, syncBookingToGoogle } from "@/lib/google/calendar";

export { SlotUnavailableError } from "@/lib/availability";

export type BookingEventType =
  | "payment.pending"
  | "payment.confirmed"
  | "payment.failed"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.reminder"
  | "booking.completed"
  | "calendar.synced";

type EmitParams = {
  type: BookingEventType;
  organizationId: string;
  bookingId?: string;
  dedupeKey?: string;
  payload?: Record<string, unknown>;
};

async function claimEvent(params: EmitParams) {
  const dedupeKey = params.dedupeKey || "default";
  try {
    await prisma.bookingEventLog.create({
      data: {
        organizationId: params.organizationId,
        bookingId: params.bookingId || null,
        type: params.type,
        dedupeKey,
        payload: params.payload ? JSON.stringify(params.payload) : null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function loadBookingContext(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      payment: true,
      professional: {
        include: {
          membership: { include: { user: { select: { email: true, name: true } } } },
        },
      },
      bookingPage: {
        include: { organization: true },
      },
    },
  });
}

async function notifyAssignedProfessional(
  booking: NonNullable<Awaited<ReturnType<typeof loadBookingContext>>>,
  send: (email: string) => Promise<unknown>,
) {
  const proEmail = booking.professional?.membership?.user?.email;
  if (proEmail) {
    await send(proEmail);
    return;
  }
  const org = booking.bookingPage.organization;
  const owner = await getOwnerNotifyEmail(org.id);
  if (owner?.email) await send(owner.email);
}

export async function emitBookingEvent(params: EmitParams) {
  const claimed = await claimEvent(params);
  if (!claimed) {
    return { ok: true, skipped: true };
  }

  try {
    switch (params.type) {
      case "booking.confirmed":
        if (params.bookingId) await handleBookingConfirmed(params.bookingId);
        break;
      case "booking.cancelled":
        if (params.bookingId) await handleBookingCancelled(params.bookingId);
        break;
      case "booking.rescheduled":
        if (params.bookingId) await handleBookingRescheduled(params.bookingId);
        break;
      case "booking.reminder":
        if (params.bookingId) await handleBookingReminder(params.bookingId);
        break;
      case "booking.completed":
        if (params.bookingId) await handleBookingCompleted(params.bookingId);
        break;
      case "payment.failed":
        if (params.bookingId) await handlePaymentFailed(params.bookingId);
        break;
      case "payment.pending":
        if (params.bookingId) await handlePixPending(params.bookingId);
        break;
      case "payment.confirmed":
      case "calendar.synced":
        break;
      default:
        break;
    }
    return { ok: true, skipped: false };
  } catch (e) {
    console.error(`[events] ${params.type} failed`, e);
    throw e;
  }
}

async function handleBookingConfirmed(bookingId: string) {
  await ensureManageToken(bookingId);

  const synced = await syncBookingToGoogle(bookingId);
  const booking = await loadBookingContext(bookingId);
  if (!booking || booking.status !== "CONFIRMED") return;

  const org = booking.bookingPage.organization;
  await claimEvent({
    type: "calendar.synced",
    organizationId: org.id,
    bookingId,
    dedupeKey: synced?.eventId || "none",
    payload: { eventId: synced?.eventId, hangoutLink: synced?.hangoutLink },
  });

  const token = await ensureManageToken(bookingId);
  const manageUrl = token ? manageBookingUrl(token) : appUrl("/app/agenda/listagem");
  const meetLink = booking.googleMeetLink || synced?.hangoutLink || null;
  const professionalName =
    booking.professional?.displayName || org.name;

  if (org.notifyClientConfirmation) {
    await sendBookingConfirmation({
      to: booking.customerEmail,
      customerName: booking.customerName,
      serviceTitle: booking.service.title,
      professionalName,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.timezone,
      priceCents: booking.service.priceCents,
      meetLink,
      manageUrl,
    });
  }

  if (org.notifyProNewBooking) {
    await notifyAssignedProfessional(booking, async (to) => {
      await sendProNewBooking({
        to,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        serviceTitle: booking.service.title,
        startAt: booking.startAt,
        endAt: booking.endAt,
        timezone: booking.timezone,
        priceCents: booking.service.priceCents,
        adminUrl: appUrl("/app/agenda/listagem"),
      });
    });
  }
}

async function handleBookingCancelled(bookingId: string) {
  const booking = await loadBookingContext(bookingId);
  if (!booking) return;
  const org = booking.bookingPage.organization;

  if (booking.googleEventId) {
    await deleteCalendarEvent({ org, eventId: booking.googleEventId });
    await prisma.booking.update({
      where: { id: bookingId },
      data: { googleEventId: null },
    });
  }

  const bookAgainUrl = appUrl(
    bookingPublicPath(org.slug, booking.bookingPage.slug),
  );

  await sendBookingCancelledClient({
    to: booking.customerEmail,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.timezone,
    bookAgainUrl,
  });

  if (org.notifyProCancellation) {
    const owner = await getOwnerNotifyEmail(org.id);
    if (owner?.email) {
      await sendBookingCancelledPro({
        to: owner.email,
        customerName: booking.customerName,
        serviceTitle: booking.service.title,
        startAt: booking.startAt,
        endAt: booking.endAt,
        timezone: booking.timezone,
        adminUrl: appUrl("/app/agenda/listagem"),
      });
    }
  }
}

async function handleBookingRescheduled(bookingId: string) {
  await syncBookingToGoogle(bookingId);
  const booking = await loadBookingContext(bookingId);
  if (!booking || booking.status !== "CONFIRMED") return;
  const org = booking.bookingPage.organization;
  const token = await ensureManageToken(bookingId);
  const manageUrl = token ? manageBookingUrl(token) : appUrl(bookingPublicPath(org.slug, booking.bookingPage.slug));

  await sendBookingRescheduledClient({
    to: booking.customerEmail,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    professionalName: org.name,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.timezone,
    meetLink: booking.googleMeetLink,
    manageUrl,
  });

  if (org.notifyProReschedule) {
    const owner = await getOwnerNotifyEmail(org.id);
    if (owner?.email) {
      await sendBookingRescheduledPro({
        to: owner.email,
        customerName: booking.customerName,
        serviceTitle: booking.service.title,
        startAt: booking.startAt,
        endAt: booking.endAt,
        timezone: booking.timezone,
        adminUrl: appUrl("/app/agenda/listagem"),
      });
    }
  }
}

async function handleBookingReminder(bookingId: string) {
  const booking = await loadBookingContext(bookingId);
  if (!booking || booking.status !== "CONFIRMED") return;
  if (booking.reminderSentAt) return;
  const org = booking.bookingPage.organization;
  if (!org.notifyClientReminder || org.reminderHoursBefore <= 0) return;

  const token = await ensureManageToken(bookingId);
  await sendBookingReminder({
    to: booking.customerEmail,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    professionalName: org.name,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.timezone,
    meetLink: booking.googleMeetLink,
    manageUrl: token ? manageBookingUrl(token) : appUrl(bookingPublicPath(org.slug, booking.bookingPage.slug)),
  });
  await prisma.booking.update({
    where: { id: bookingId },
    data: { reminderSentAt: new Date() },
  });
}

async function handleBookingCompleted(bookingId: string) {
  const booking = await loadBookingContext(bookingId);
  if (!booking || booking.status !== "CONFIRMED") return;
  if (booking.feedbackSentAt) return;
  const org = booking.bookingPage.organization;
  if (!org.notifyClientFeedback) return;

  await sendFeedbackRequest({
    to: booking.customerEmail,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    professionalName: org.name,
    feedbackUrl: appUrl(bookingPublicPath(org.slug, booking.bookingPage.slug)),
  });
  await prisma.booking.update({
    where: { id: bookingId },
    data: { feedbackSentAt: new Date() },
  });
}

async function handlePaymentFailed(bookingId: string) {
  const booking = await loadBookingContext(bookingId);
  if (!booking) return;
  const org = booking.bookingPage.organization;
  await sendPaymentFailed({
    to: booking.customerEmail,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    retryUrl: appUrl(bookingPublicPath(org.slug, booking.bookingPage.slug)),
  });
}

async function handlePixPending(bookingId: string) {
  const booking = await loadBookingContext(bookingId);
  if (!booking) return;
  if (booking.status !== "PENDING_PAYMENT") return;
  if (booking.pixReminderSentAt) return;
  if (booking.payment?.status === "PAID") return;
  const org = booking.bookingPage.organization;

  await sendPixPending({
    to: booking.customerEmail,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.timezone,
    payUrl: appUrl(bookingPublicPath(org.slug, booking.bookingPage.slug)),
  });
  await prisma.booking.update({
    where: { id: bookingId },
    data: { pixReminderSentAt: new Date() },
  });
}
