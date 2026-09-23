"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { assertTenantAccess, getResolvedTenantId } from "@/lib/dashboard-context";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { upsertCalendarEventForActivity } from "./calendar";

const createSchema = z.object({
  leadId: z.string().uuid(),
  type: z.nativeEnum(ActivityType),
  content: z.string().max(5000).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

export type ActivityWithCalendar = Awaited<ReturnType<typeof db.activity.findMany<{
  include: { user: { select: { id: true; name: true } } };
}>>>[number] & { calendarEvent: { activityId: string; googleEventId: string; status: string | null } | null };

export async function listByLead(leadId: string, tenantId: string): Promise<ActivityWithCalendar[]> {
  await assertTenantAccess(tenantId);

  const activities = await db.activity.findMany({
    where: { leadId, tenantId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (activities.length === 0) return activities.map((a) => ({ ...a, calendarEvent: null }));

  const links = await db.calendarEventLink.findMany({
    where: { tenantId, activityId: { in: activities.map((a) => a.id) } },
    select: { activityId: true, googleEventId: true, status: true },
  });
  const map = new Map(links.map((l) => [l.activityId, l]));
  return activities.map((a) => ({ ...a, calendarEvent: map.get(a.id) ?? null }));
}

export async function createActivity(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;

  const d = createSchema.parse(data);
  return db.activity.create({
    data: {
      tenantId,
      leadId: d.leadId,
      userId: userId ?? null,
      type: d.type,
      content: d.content ?? null,
      startAt: d.startAt ?? undefined,
      endAt: d.endAt ?? undefined,
    },
    include: { user: { select: { id: true, name: true } } },
  });
}

/** Cria atividade e sincroniza com Google Calendar se for MEETING. Sem redirect. */
export async function createActivityWithCalendarSync(
  tenantId: string,
  data: z.infer<typeof createSchema>
) {
  const activity = await createActivity(tenantId, data);
  if (activity && data.type === "MEETING") {
    try {
      await upsertCalendarEventForActivity(tenantId, activity.id);
    } catch {
      // Ignora erro do calendário
    }
  }
  return activity;
}

export async function createActivityFromForm(formData: FormData) {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) throw new Error("Não autorizado");

  const leadId = (formData.get("leadId") as string)?.trim();
  const type = (formData.get("type") as ActivityType) || "NOTE";
  const content = (formData.get("content") as string)?.trim();
  const startAtRaw = (formData.get("startAt") as string)?.trim();
  const endAtRaw = (formData.get("endAt") as string)?.trim();
  if (!leadId) return;

  const activity = await createActivity(tenantId, {
    leadId,
    type,
    content: content || undefined,
    startAt: startAtRaw ? new Date(startAtRaw) : undefined,
    endAt: endAtRaw ? new Date(endAtRaw) : undefined,
  });
  if (type === "MEETING" && activity?.id) {
    await upsertCalendarEventForActivity(tenantId, activity.id);
  }
  redirect(`/dashboard/leads/${leadId}`);
}

const scheduleMeetingSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().min(1).max(255),
  startAt: z.coerce.date(),
  durationMinutes: z.number().min(5).max(480),
  description: z.string().max(5000).optional(),
});

export async function scheduleMeeting(data: z.infer<typeof scheduleMeetingSchema>): Promise<{
  success: boolean;
  error?: string;
  activityId?: string;
  calendarSynced?: boolean;
}> {
  try {
    const { tenantId } = await getResolvedTenantId();
    if (!tenantId) {
      return { success: false, error: "Não autorizado" };
    }

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const validated = scheduleMeetingSchema.parse(data);
    
    // Calcula endAt baseado na duração
    const endAt = new Date(validated.startAt.getTime() + validated.durationMinutes * 60 * 1000);

    const activity = await db.activity.create({
      data: {
        tenantId,
        leadId: validated.leadId,
        userId: userId ?? null,
        type: "MEETING",
        content: validated.title + (validated.description ? `\n\n${validated.description}` : ""),
        startAt: validated.startAt,
        endAt,
      },
    });

    // Tenta sincronizar com Google Calendar
    let calendarSynced = false;
    try {
      await upsertCalendarEventForActivity(tenantId, activity.id);
      // Verifica se foi criado um link de calendário
      const link = await db.calendarEventLink.findFirst({
        where: { tenantId, activityId: activity.id },
      });
      calendarSynced = !!link?.googleEventId;
    } catch (calendarError) {
      // Silenciosamente ignora erros do calendário - reunião foi salva
      console.error("Erro ao sincronizar com Google Calendar:", calendarError);
    }

    return {
      success: true,
      activityId: activity.id,
      calendarSynced,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Dados inválidos" };
    }
    console.error("Erro ao agendar reunião:", error);
    return { success: false, error: "Erro ao agendar reunião" };
  }
}
