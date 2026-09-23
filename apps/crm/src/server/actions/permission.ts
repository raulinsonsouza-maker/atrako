"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  role: z.nativeEnum(UserRole),
  resource: z.string().min(1).max(50),
  action: z.string().min(1).max(50),
  allowed: z.boolean().default(true),
});

const updateSchema = createSchema.partial().extend({
  allowed: z.boolean(),
});

export async function listPermissions(tenantId: string, role?: UserRole) {
  await assertTenantAccess(tenantId);

  const where: { tenantId: string; role?: UserRole } = { tenantId };
  if (role) where.role = role;

  return db.permission.findMany({
    where,
    orderBy: [{ role: "asc" }, { resource: "asc" }, { action: "asc" }],
  });
}

export async function getPermission(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.permission.findFirst({
    where: { id, tenantId },
  });
}

export async function createPermission(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);

  const d = createSchema.parse(data);
  return db.permission.create({
    data: {
      tenantId,
      role: d.role,
      resource: d.resource,
      action: d.action,
      allowed: d.allowed ?? true,
    },
  });
}

export async function updatePermission(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  await assertTenantAccess(tenantId);

  const d = updateSchema.parse(data);
  return db.permission.updateMany({
    where: { id, tenantId },
    data: {
      allowed: d.allowed,
    },
  });
}

export async function deletePermission(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.permission.deleteMany({
    where: { id, tenantId },
  });
}

/**
 * Verifica se um usuário tem permissão para realizar uma ação
 */
export async function checkPermission(
  tenantId: string,
  userRole: UserRole,
  resource: string,
  action: string
): Promise<boolean> {
  // SUPER_ADMIN sempre tem permissão
  if (userRole === "SUPER_ADMIN") return true;

  // Buscar permissão específica
  const permission = await db.permission.findUnique({
    where: {
      tenantId_role_resource_action: {
        tenantId,
        role: userRole,
        resource,
        action,
      },
    },
  });

  // Se não existe permissão específica, usar padrões
  if (!permission) {
    return getDefaultPermission(userRole, resource, action);
  }

  return permission.allowed;
}

/**
 * Permissões padrão por role
 */
function getDefaultPermission(role: UserRole, resource: string, action: string): boolean {
  // TENANT_ADMIN tem todas as permissões por padrão
  if (role === "TENANT_ADMIN") return true;

  // TENANT_USER tem permissões limitadas
  if (role === "TENANT_USER") {
    // Pode ler tudo
    if (action === "read") return true;

    // Pode criar leads e atividades
    if (resource === "lead" && action === "create") return true;
    if (resource === "activity" && action === "create") return true;
    if (resource === "task" && action === "create") return true;

    // Pode atualizar apenas seus próprios recursos (será verificado no nível da aplicação)
    if (action === "update") return true;

    // Não pode deletar ou fazer ações administrativas por padrão
    if (action === "delete") return false;
    if (action === "assign") return false;
    if (resource === "user" || resource === "tenant" || resource === "pipeline") return false;
  }

  return false;
}

/**
 * Helper para verificar múltiplas permissões
 */
export async function checkPermissions(
  tenantId: string,
  userRole: UserRole,
  checks: Array<{ resource: string; action: string }>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  await Promise.all(
    checks.map(async (check) => {
      const key = `${check.resource}:${check.action}`;
      results[key] = await checkPermission(tenantId, userRole, check.resource, check.action);
    })
  );

  return results;
}
