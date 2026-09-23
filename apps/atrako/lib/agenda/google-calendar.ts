/**
 * Google Calendar sync for Agenda bookings via WorkspaceConnection provider GOOGLE_CALENDAR.
 */
import { prisma } from "@/lib/db";

type GoogleCreds = {
  accessToken?: string;
  refreshToken?: string;
  calendarId?: string;
  expiresAt?: number;
};

async function getGoogleCreds(workspaceId: string): Promise<GoogleCreds | null> {
  const conn = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: {
        clienteId: workspaceId,
        provider: "GOOGLE_CALENDAR",
      },
    },
  });
  if (!conn || conn.status !== "ACTIVE") return null;
  const creds = conn.credentialsEnc as GoogleCreds;
  if (!creds?.accessToken && !creds?.refreshToken) return null;
  return creds;
}

async function refreshAccessToken(
  workspaceId: string,
  creds: GoogleCreds,
): Promise<string | null> {
  if (!creds.refreshToken) return creds.accessToken || null;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return creds.accessToken || null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return creds.accessToken || null;
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return creds.accessToken || null;

  await prisma.workspaceConnection.update({
    where: {
      clienteId_provider: {
        clienteId: workspaceId,
        provider: "GOOGLE_CALENDAR",
      },
    },
    data: {
      credentialsEnc: {
        ...creds,
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      },
    },
  });
  return data.access_token;
}

async function googleFetch(
  workspaceId: string,
  path: string,
  init?: RequestInit,
) {
  const creds = await getGoogleCreds(workspaceId);
  if (!creds) return null;
  let token = creds.accessToken;
  if (!token || (creds.expiresAt && creds.expiresAt < Date.now() + 60_000)) {
    token = (await refreshAccessToken(workspaceId, creds)) || undefined;
  }
  if (!token) return null;

  const calendarId = encodeURIComponent(creds.calendarId || "primary");
  const url = path.startsWith("http")
    ? path
    : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function syncBookingToGoogle(bookingId: string) {
  const booking = await prisma.agendaBooking.findUnique({
    where: { id: bookingId },
    include: { service: true, professional: true },
  });
  if (!booking || booking.status !== "CONFIRMED") return null;

  const creds = await getGoogleCreds(booking.clienteId);
  if (!creds) return null;

  const body = {
    summary: `${booking.service.title} — ${booking.customerName}`,
    description: [
      booking.customerEmail && `E-mail: ${booking.customerEmail}`,
      booking.customerPhone && `Tel: ${booking.customerPhone}`,
      booking.professional && `Profissional: ${booking.professional.displayName}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: {
      dateTime: booking.startAt.toISOString(),
      timeZone: booking.timezone,
    },
    end: {
      dateTime: booking.endAt.toISOString(),
      timeZone: booking.timezone,
    },
  };

  if (booking.googleEventId) {
    const res = await googleFetch(
      booking.clienteId,
      `/events/${booking.googleEventId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return res?.ok ? booking.googleEventId : null;
  }

  const res = await googleFetch(booking.clienteId, "/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res?.ok) return null;
  const data = (await res.json()) as { id?: string; hangoutLink?: string };
  if (data.id) {
    await prisma.agendaBooking.update({
      where: { id: bookingId },
      data: {
        googleEventId: data.id,
        googleMeetLink: data.hangoutLink || null,
      },
    });
  }
  return data.id || null;
}

export async function deleteGoogleEventForBooking(booking: {
  id: string;
  clienteId: string;
  googleEventId?: string | null;
}) {
  if (!booking.googleEventId) return;
  await googleFetch(booking.clienteId, `/events/${booking.googleEventId}`, {
    method: "DELETE",
  });
  await prisma.agendaBooking.update({
    where: { id: booking.id },
    data: { googleEventId: null, googleMeetLink: null },
  });
}

export async function isGoogleCalendarConnected(workspaceId: string) {
  return Boolean(await getGoogleCreds(workspaceId));
}
