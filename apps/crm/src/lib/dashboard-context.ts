/**
 * Contexto do dashboard e helpers para "ver como" (super-admin) e validação de acesso a tenants.
 * Usa cache() do React para evitar chamadas redundantes na mesma requisição.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSession } from "@/lib/auth-server";
import { db } from "@/lib/db";

export type DashboardContext = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  tenantId: string;
  isViewingAs: boolean;
  tenantName: string | null;
};

/** Usado por getDashboardContext e por form actions que precisam do tenantId (ex: createLeadFromForm). */
export const getResolvedTenantId = cache(async function getResolvedTenantId() {
  const session = await getSession();
  if (!session?.user) return { tenantId: null, isViewingAs: false, tenantName: null, session };

  const role = (session.user as { role?: string }).role;
  const sessionTenantId = (session.user as { tenantId?: string | null }).tenantId;
  const cookieStore = await cookies();
  const viewAsTenantId = cookieStore.get("viewAsTenant")?.value;

  if (role === "SUPER_ADMIN" && viewAsTenantId) {
    const tenant = await db.tenant.findFirst({
      where: { id: viewAsTenantId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (tenant) {
      return { tenantId: tenant.id, isViewingAs: true, tenantName: tenant.name, session };
    }
  }

  if (sessionTenantId) {
    return { tenantId: sessionTenantId, isViewingAs: false, tenantName: null, session };
  }
  return { tenantId: null, isViewingAs: false, tenantName: null, session };
} as () => Promise<{
  tenantId: string | null;
  isViewingAs: boolean;
  tenantName: string | null;
  session: Awaited<ReturnType<typeof getSession>>;
}>);

/** Garante que o usuário pode atuar no tenantId (membro do tenant ou super-admin em "ver como"). */
export async function assertTenantAccess(tenantId: string): Promise<void> {
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    const t = await db.tenant.findFirst({
      where: { id: tenantId, status: "ACTIVE" },
      select: { id: true },
    });
    if (t) return;
    throw new Error("Tenant inválido");
  }

  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");

  const sid = (session.user as { tenantId?: string | null }).tenantId;
  const role = (session.user as { role?: string }).role;
  const viewAs = (await cookies()).get("viewAsTenant")?.value;

  if (sid === tenantId) return;
  if (role === "SUPER_ADMIN" && viewAs === tenantId) {
    const t = await db.tenant.findFirst({ where: { id: tenantId, status: "ACTIVE" }, select: { id: true } });
    if (t) return;
  }
  throw new Error("Tenant inválido");
}

export const getDashboardContext = cache(async function getDashboardContext(): Promise<DashboardContext> {
  const { session, tenantId, isViewingAs, tenantName } = await getResolvedTenantId();

  if (process.env.ATRAKO_EMBED_OPEN === "true" && (!session?.user || !tenantId)) {
    let tenant = await db.tenant.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (!tenant) {
      tenant = await db.tenant.create({
        data: {
          name: "Atrako",
          slug: "atrako-local",
          status: "ACTIVE",
        },
        select: { id: true, name: true },
      });
    }
    const openSession = {
      user: {
        id: "atrako-embed",
        name: "Atrako",
        email: "atrako@local",
        role: "ADMIN",
        tenantId: tenant.id,
      },
      session: { id: "atrako-embed-session" },
    };
    return {
      session: openSession as NonNullable<Awaited<ReturnType<typeof getSession>>>,
      tenantId: tenant.id,
      isViewingAs: false,
      tenantName: tenant.name,
    };
  }

  if (!session?.user) redirect("/auth/login");

  if (!tenantId) {
    if ((session.user as { role?: string }).role === "SUPER_ADMIN") redirect("/super-admin");
    redirect("/auth/login");
  }

  return { session: session as NonNullable<typeof session>, tenantId, isViewingAs, tenantName };
});
