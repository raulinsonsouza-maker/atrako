"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { randomBytes } from "crypto";

function requireSuperAdmin() {
  return async () => {
    const session = await getSession();
    if (!session?.user) throw new Error("Não autorizado");
    const role = (session.user as { role?: string }).role;
    if (role !== "SUPER_ADMIN") throw new Error("Apenas Super Admin.");
  };
}

const check = requireSuperAdmin();

export async function listTenants() {
  await check();
  return db.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      logoUrl: true,
      primaryColor: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });
}

const slugRe = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
export async function createTenant(data: { name: string; slug: string; adminEmail?: string }) {
  await check();
  const name = data.name?.trim();
  const slug = data.slug?.trim().toLowerCase().replace(/\s+/g, "-");
  if (!name || !slug) throw new Error("Nome e slug são obrigatórios.");
  if (!slugRe.test(slug)) throw new Error("Slug inválido. Use letras minúsculas, números e hífens.");

  const existing = await db.tenant.findUnique({ where: { slug } });
  if (existing) throw new Error("Este slug já está em uso.");

  const tenant = await db.tenant.create({
    data: { name, slug, status: "ACTIVE" },
  });

  const adminEmail = data.adminEmail?.trim();
  if (adminEmail) {
    const token = randomBytes(32).toString("hex");
    await db.invite.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        role: "TENANT_ADMIN",
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // O link é /auth/accept-invite?token=xxx — a página aceita token por query
    return { tenant, inviteLink: `${base}/auth/accept-invite?token=${token}` };
  }
  return { tenant, inviteLink: null };
}

export async function updateTenant(id: string, data: { name?: string; slug?: string; logoUrl?: string; primaryColor?: string }) {
  await check();
  const name = data.name?.trim();
  const slug = data.slug?.trim().toLowerCase().replace(/\s+/g, "-");
  const update: { name?: string; slug?: string; logoUrl?: string | null; primaryColor?: string | null } = {};
  if (name != null) update.name = name;
  if (slug != null) {
    if (!slugRe.test(slug)) throw new Error("Slug inválido.");
    const other = await db.tenant.findFirst({ where: { slug, NOT: { id } } });
    if (other) throw new Error("Este slug já está em uso.");
    update.slug = slug;
  }
  if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl?.trim() || null;
  if (data.primaryColor !== undefined) update.primaryColor = data.primaryColor?.trim() || null;
  if (Object.keys(update).length === 0) return db.tenant.findUnique({ where: { id } });
  return db.tenant.update({ where: { id }, data: update });
}

export async function setTenantStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
  await check();
  return db.tenant.update({
    where: { id },
    data: { status },
  });
}

export async function inviteTenantAdmin(tenantId: string, email: string) {
  await check();
  const e = email?.trim();
  if (!e) throw new Error("E-mail é obrigatório.");

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant não encontrado.");

  const exists = await db.user.findFirst({ where: { tenantId, email: e } });
  if (exists) throw new Error("Já existe usuário com este e-mail neste tenant.");

  await db.invite.deleteMany({ where: { tenantId, email: e } });
  const token = randomBytes(32).toString("hex");
  await db.invite.create({
    data: {
      tenantId,
      email: e,
      role: "TENANT_ADMIN",
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return { inviteLink: `${base}/auth/accept-invite?token=${token}` };
}

// --- Config do tenant (webhook, auto-assign) — usado em Configurações pelo TENANT_ADMIN
export async function getTenantConfig(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { config: true } });
  return (t?.config as { webhookApiKey?: string; autoAssignUserId?: string } | null) || {};
}

export async function saveTenantConfig(
  tenantId: string,
  data: { webhookApiKey?: string; autoAssignUserId?: string | null }
) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const role = (session.user as { role?: string }).role;
  if (role !== "TENANT_ADMIN") throw new Error("Apenas administrador do tenant.");
  const curr = await db.tenant.findUnique({ where: { id: tenantId }, select: { config: true } });
  const prev = (curr?.config as Record<string, unknown>) || {};
  const next = { ...prev } as Record<string, unknown>;
  if (data.webhookApiKey !== undefined) next.webhookApiKey = data.webhookApiKey?.trim() || null;
  if (data.autoAssignUserId !== undefined) next.autoAssignUserId = data.autoAssignUserId || null;
  await db.tenant.update({ where: { id: tenantId }, data: { config: next as Prisma.InputJsonValue } });
}

export async function getTenantBranding(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, logoUrl: true, primaryColor: true },
  });
  return t ? { name: t.name, logoUrl: t.logoUrl, primaryColor: t.primaryColor } : { name: "CRM", logoUrl: null, primaryColor: null };
}

/** Atualiza apenas nome e logo do tenant. Apenas TENANT_ADMIN do próprio tenant. */
export async function updateTenantBranding(
  tenantId: string,
  data: { name?: string; logoUrl?: string | null }
) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const role = (session.user as { role?: string }).role;
  if (role !== "TENANT_ADMIN") throw new Error("Apenas administrador do tenant pode alterar a marca.");
  const update: { name?: string; logoUrl?: string | null } = {};
  if (data.name !== undefined) {
    const name = data.name?.trim();
    if (!name) throw new Error("Nome é obrigatório.");
    update.name = name;
  }
  if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl?.trim() || null;
  if (Object.keys(update).length === 0) return getTenantBranding(tenantId);
  await db.tenant.update({ where: { id: tenantId }, data: update });
  return getTenantBranding(tenantId);
}
