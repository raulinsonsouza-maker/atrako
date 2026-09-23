"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { z } from "zod";

const createSchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["manual", "stage", "no_reply"]),
  title: z.string().min(1).max(255),
  dueAt: z.coerce.date().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

export async function createTask(tenantId: string, data: z.infer<typeof createSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = createSchema.parse(data);
  return db.task.create({
    data: {
      tenantId,
      leadId: d.leadId,
      type: d.type,
      title: d.title,
      dueAt: d.dueAt ?? undefined,
      assignedToId: d.assignedToId ?? undefined,
    },
    include: { lead: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
  });
}

export async function listTasksByLead(leadId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  return db.task.findMany({
    where: { leadId, tenantId },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
  });
}

export async function listOverdueTasks(tenantId: string, limit = 20) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const now = new Date();
  return db.task.findMany({
    where: { tenantId, completedAt: null, dueAt: { lt: now } },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}

export async function completeTask(taskId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  await db.task.updateMany({
    where: { id: taskId, tenantId },
    data: { completedAt: new Date() },
  });
}
