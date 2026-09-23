"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { randomBytes } from "crypto";
import { UserRole } from "@prisma/client";

function requireTenantAdmin(tenantId: string) {
  return async () => {
    const session = await getSession();
    if (!session?.user) throw new Error("Não autorizado");
    const tid = (session.user as { tenantId?: string | null }).tenantId;
    if (tid !== tenantId) throw new Error("Tenant inválido");
    const role = (session.user as { role?: string }).role;
    if (role !== "TENANT_ADMIN") throw new Error("Apenas administradores do tenant.");
  };
}

export async function listUsersForManagement(tenantId: string) {
  const check = requireTenantAdmin(tenantId);
  await check();
  return db.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function inviteUser(
  tenantId: string,
  data: { email: string; role: "TENANT_ADMIN" | "TENANT_USER" }
) {
  await requireTenantAdmin(tenantId)();
  const email = data.email?.trim().toLowerCase();
  if (!email) throw new Error("E-mail é obrigatório.");

  const exists = await db.user.findFirst({ where: { tenantId, email } });
  if (exists) throw new Error("Já existe usuário com este e-mail neste tenant.");

  await db.invite.deleteMany({ where: { tenantId, email } });
  const token = randomBytes(32).toString("hex");
  await db.invite.create({
    data: {
      tenantId,
      email,
      role: data.role,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { inviteLink: `${base}/auth/accept-invite?token=${token}` };
}

export async function updateUserRole(
  tenantId: string,
  userId: string,
  role: "TENANT_ADMIN" | "TENANT_USER"
) {
  await requireTenantAdmin(tenantId)();
  const target = await db.user.findFirst({ where: { id: userId, tenantId } });
  if (!target) throw new Error("Usuário não encontrado.");
  await db.user.update({
    where: { id: userId },
    data: { role: role as UserRole },
  });
}
