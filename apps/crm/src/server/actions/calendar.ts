"use server";

import crypto from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { getResolvedTenantId } from "@/lib/dashboard-context";
import {
  createEvent,
  updateEvent,
  listCalendars,
  listEvents,
  listEventChanges,
  refreshAccessToken,
  watchCalendar,
} from "@/lib/integrations/google-calendar";
import type { calendar_v3 } from "googleapis";

function assertTenant(tenantId: string, sessionTenantId?: string | null) {
  if (!sessionTenantId) throw new Error("Não autorizado");
  if (sessionTenantId !== tenantId) throw new Error("Tenant inválido");
}

function getWebhookUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL não configurado");
  return `${baseUrl}/api/integrations/google-calendar/webhook`;
}

async function ensureTokens(connection: {
  id: string;
  refreshToken: string | null;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
}) {
  const now = Date.now();
  const needsRefresh = !connection.accessToken || !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() < now + 60_000;
  if (!needsRefresh) {
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      tokenExpiresAt: connection.tokenExpiresAt,
    };
  }
  if (!connection.refreshToken) throw new Error("Refresh token não encontrado.");

  const refreshed = await refreshAccessToken(connection.refreshToken);
  await db.userCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.accessToken ?? undefined,
      refreshToken: refreshed.refreshToken ?? undefined,
      tokenExpiresAt: refreshed.tokenExpiresAt ?? undefined,
    },
  });
  return refreshed;
}

async function ensureWatch(connection: {
  id: string;
  tenantId: string;
  userId: string;
  calendarId: string;
  channelId: string | null;
  channelExpiresAt: Date | null;
  refreshToken: string | null;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
}) {
  // Skip webhook em desenvolvimento local (Google requer HTTPS)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    return;
  }

  const now = Date.now();
  if (connection.channelId && connection.channelExpiresAt && connection.channelExpiresAt.getTime() > now + 60_000) {
    return;
  }

  const tokens = await ensureTokens(connection);
  const channelId = crypto.randomUUID();
  const res = await watchCalendar({
    calendarId: connection.calendarId,
    tokens,
    channelId,
    webhookUrl: getWebhookUrl(),
    token: process.env.GOOGLE_WEBHOOK_SECRET,
  });
  await db.userCalendarConnection.update({
    where: { id: connection.id },
    data: {
      channelId,
      resourceId: res.resourceId ?? undefined,
      channelExpiresAt: res.expiration ? new Date(Number(res.expiration)) : undefined,
    },
  });
}

export async function getUserCalendarConnection(tenantId: string) {
  const session = await getSession();
  const userId = (session?.user as { id?: string; tenantId?: string | null })?.id;
  assertTenant(tenantId, (session?.user as { tenantId?: string | null })?.tenantId);
  if (!userId) throw new Error("Usuário inválido");

  return db.userCalendarConnection.findFirst({ where: { tenantId, userId } });
}

export async function getCalendarEmbedInfo(tenantId: string) {
  const session = await getSession();
  const userId = (session?.user as { id?: string; tenantId?: string | null })?.id;
  assertTenant(tenantId, (session?.user as { tenantId?: string | null })?.tenantId);
  if (!userId) throw new Error("Usuário inválido");

  const conn = await db.userCalendarConnection.findFirst({ where: { tenantId, userId } });
  if (!conn) return { connected: false as const };

  let resolvedCalendarId = conn.calendarId;
  if (resolvedCalendarId === "primary") {
    try {
      const tokens = await ensureTokens(conn);
      const calendars = await listCalendars(tokens);
      const primary = calendars.find((cal) => cal.primary && cal.id);
      if (primary?.id && primary.id !== resolvedCalendarId) {
        resolvedCalendarId = primary.id;
        await db.userCalendarConnection.update({
          where: { id: conn.id },
          data: { calendarId: resolvedCalendarId },
        });
        await ensureWatch({ ...conn, calendarId: resolvedCalendarId });
      }
    } catch (err) {
      // Fallback para o calendarId atual se não conseguir resolver o primário
    }
  }

  return {
    connected: true as const,
    calendarId: resolvedCalendarId,
    rawCalendarId: conn.calendarId,
  };
}

export async function disconnectCalendar(tenantId: string) {
  const session = await getSession();
  const userId = (session?.user as { id?: string; tenantId?: string | null })?.id;
  assertTenant(tenantId, (session?.user as { tenantId?: string | null })?.tenantId);
  if (!userId) throw new Error("Usuário inválido");

  await db.userCalendarConnection.deleteMany({ where: { tenantId, userId } });
}

export async function listUserCalendars(tenantId: string) {
  const session = await getSession();
  const userId = (session?.user as { id?: string; tenantId?: string | null })?.id;
  assertTenant(tenantId, (session?.user as { tenantId?: string | null })?.tenantId);
  if (!userId) throw new Error("Usuário inválido");

  const conn = await db.userCalendarConnection.findFirst({ where: { tenantId, userId } });
  if (!conn) return [];
  const tokens = await ensureTokens(conn);
  return listCalendars(tokens);
}

export async function listUpcomingEvents(tenantId: string) {
  const session = await getSession();
  const userId = (session?.user as { id?: string; tenantId?: string | null })?.id;
  assertTenant(tenantId, (session?.user as { tenantId?: string | null })?.tenantId);
  if (!userId) throw new Error("Usuário inválido");

  const conn = await db.userCalendarConnection.findFirst({ where: { tenantId, userId } });
  if (!conn) return { connected: false, events: [] as calendar_v3.Schema$Event[] };

  const tokens = await ensureTokens(conn);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const events = await listEvents({
    calendarId: conn.calendarId,
    tokens,
    timeMin,
    timeMax,
    maxResults: 100,
  });
  return { connected: true, calendarId: conn.calendarId, events };
}

export async function setUserCalendarId(tenantId: string, calendarId: string) {
  const session = await getSession();
  const userId = (session?.user as { id?: string; tenantId?: string | null })?.id;
  assertTenant(tenantId, (session?.user as { tenantId?: string | null })?.tenantId);
  if (!userId) throw new Error("Usuário inválido");

  const conn = await db.userCalendarConnection.findFirst({ where: { tenantId, userId } });
  if (!conn) throw new Error("Calendário não conectado.");
  await db.userCalendarConnection.update({
    where: { id: conn.id },
    data: { calendarId },
  });
  await ensureWatch({ ...conn, calendarId });
}

export async function upsertCalendarEventForActivity(tenantId: string, activityId: string) {
  const session = await getSession();
  const sessionTenant = (session?.user as { tenantId?: string | null })?.tenantId;
  assertTenant(tenantId, sessionTenant);

  const activity = await db.activity.findFirst({
    where: { id: activityId, tenantId },
    include: { lead: true, user: true },
  });
  if (!activity || activity.type !== "MEETING") return;
  if (!activity.startAt || !activity.endAt) return;

  const ownerUserId = activity.userId ?? (session?.user as { id?: string })?.id;
  if (!ownerUserId) return;

  const conn = await db.userCalendarConnection.findFirst({
    where: { tenantId, userId: ownerUserId },
  });
  if (!conn) return;

  await ensureWatch(conn);
  const tokens = await ensureTokens(conn);

  const summary = activity.content?.trim() || `Atendimento - ${activity.lead.name}`;
  const description = [
    `Lead: ${activity.lead.name}`,
    activity.lead.email ? `Email: ${activity.lead.email}` : "",
    activity.lead.phone ? `Telefone: ${activity.lead.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const event: calendar_v3.Schema$Event = {
    summary,
    description,
    start: { dateTime: activity.startAt.toISOString() },
    end: { dateTime: activity.endAt.toISOString() },
    attendees: activity.lead.email ? [{ email: activity.lead.email }] : undefined,
    extendedProperties: { private: { crmActivityId: activity.id, leadId: activity.leadId } },
  };

  const existing = await db.calendarEventLink.findFirst({
    where: { tenantId, activityId: activity.id },
  });

  if (existing?.googleEventId) {
    const updated = await updateEvent(conn.calendarId, existing.googleEventId, event, tokens);
    await db.calendarEventLink.update({
      where: { id: existing.id },
      data: { lastSyncedAt: new Date(), status: updated.status ?? undefined },
    });
  } else {
    const created = await createEvent(conn.calendarId, event, tokens);
    if (!created.id) return;
    await db.calendarEventLink.create({
      data: {
        tenantId,
        userId: ownerUserId,
        activityId: activity.id,
        calendarId: conn.calendarId,
        googleEventId: created.id,
        status: created.status ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  }
}

export async function syncCalendarChangesByChannel(channelId: string, resourceId: string) {
  const conn = await db.userCalendarConnection.findFirst({
    where: { channelId, resourceId },
  });
  if (!conn) return;
  await syncCalendarChanges(conn);
}

export async function syncCalendarChanges(connection: {
  id: string;
  tenantId: string;
  userId: string;
  calendarId: string;
  syncToken: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
}) {
  const tokens = await ensureTokens(connection);
  const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();

  let data: calendar_v3.Schema$Events;
  try {
    data = await listEventChanges({
      calendarId: connection.calendarId,
      tokens,
      syncToken: connection.syncToken ?? undefined,
      timeMin,
    });
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 410) {
      await db.userCalendarConnection.update({
        where: { id: connection.id },
        data: { syncToken: null },
      });
    }
    return;
  }

  const items = data.items ?? [];
  for (const ev of items) {
    const crmActivityId = ev.extendedProperties?.private?.crmActivityId;
    if (!crmActivityId) continue;

    const activity = await db.activity.findFirst({
      where: { id: crmActivityId, tenantId: connection.tenantId },
      select: { id: true, metadata: true },
    });
    if (!activity) continue;

    const eventStatus = ev.status ?? undefined;
    if (eventStatus === "cancelled") {
      const metadata = (activity.metadata ?? {}) as Record<string, unknown>;
      await db.activity.update({
        where: { id: activity.id },
        data: {
          metadata: {
            ...metadata,
            googleCalendar: { status: "cancelled", eventId: ev.id },
          },
        },
      });
      if (ev.id) {
        await db.calendarEventLink.updateMany({
          where: { tenantId: connection.tenantId, googleEventId: ev.id },
          data: { status: eventStatus, lastSyncedAt: new Date() },
        });
      }
      continue;
    }

    const startAt = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
    const endAt = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
    const content = ev.summary ?? undefined;

    await db.activity.update({
      where: { id: activity.id },
      data: {
        startAt: startAt ?? undefined,
        endAt: endAt ?? undefined,
        content: content ?? undefined,
      },
    });

    if (ev.id) {
      await db.calendarEventLink.upsert({
        where: { tenantId_activityId: { tenantId: connection.tenantId, activityId: activity.id } },
        create: {
          tenantId: connection.tenantId,
          userId: connection.userId,
          activityId: activity.id,
          calendarId: connection.calendarId,
          googleEventId: ev.id,
          status: eventStatus,
          lastSyncedAt: new Date(),
        },
        update: {
          status: eventStatus,
          lastSyncedAt: new Date(),
          googleEventId: ev.id,
        },
      });
    }
  }

  if (data.nextSyncToken) {
    await db.userCalendarConnection.update({
      where: { id: connection.id },
      data: { syncToken: data.nextSyncToken },
    });
  }
}

export async function createConnectionFromOAuth(data: {
  userId: string;
  tenantId: string;
  calendarId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}) {
  const existing = await db.userCalendarConnection.findFirst({
    where: { tenantId: data.tenantId, userId: data.userId },
  });
  if (existing) {
    const updated = await db.userCalendarConnection.update({
      where: { id: existing.id },
      data: {
        calendarId: data.calendarId,
        accessToken: data.accessToken ?? existing.accessToken ?? undefined,
        refreshToken: data.refreshToken ?? existing.refreshToken ?? undefined,
        tokenExpiresAt: data.tokenExpiresAt ?? existing.tokenExpiresAt ?? undefined,
      },
    });
    await ensureWatch(updated);
    return updated;
  }

  const created = await db.userCalendarConnection.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId,
      calendarId: data.calendarId,
      accessToken: data.accessToken ?? undefined,
      refreshToken: data.refreshToken ?? undefined,
      tokenExpiresAt: data.tokenExpiresAt ?? undefined,
    },
  });
  await ensureWatch(created);
  return created;
}

export async function getResolvedTenantAndUser() {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) throw new Error("Não autorizado");
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) throw new Error("Usuário inválido");
  return { tenantId, userId };
}
