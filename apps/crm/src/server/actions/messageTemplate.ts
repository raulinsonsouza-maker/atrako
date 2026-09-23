"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
});

export async function listMessageTemplates(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  return db.messageTemplate.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createMessageTemplate(tenantId: string, data: z.infer<typeof createSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = createSchema.parse(data);
  return db.messageTemplate.create({
    data: { tenantId, name: d.name, content: d.content },
  });
}

export async function deleteMessageTemplate(id: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  await db.messageTemplate.deleteMany({ where: { id, tenantId } });
}
