/**
 * Tenancy — workspace ativo e papéis.
 * Toda query de domínio deve filtrar pelo workspaceId retornado aqui.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getInternalUser } from "@/lib/internalUsers";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";
import type { WorkspaceMember, WorkspaceMemberRole } from "@/lib/generated/prisma";

export const WORKSPACE_COOKIE = "atrako_workspace_id";

const MANAGE_ROLES: WorkspaceMemberRole[] = ["OWNER", "ADMIN"];
const OPERATE_ROLES: WorkspaceMemberRole[] = ["OWNER", "ADMIN", "OPERATOR"];

function isDevOpenAccess(): boolean {
  return process.env.ATRAKO_DEV_OPEN_ACCESS === "1";
}

export async function setActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveWorkspaceCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(WORKSPACE_COOKIE);
}

/** Memberships ativas do dealer logado (não staff). */
export async function listMemberWorkspaceIds(email: string): Promise<string[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { email: email.trim().toLowerCase(), active: true },
    select: { clienteId: true },
  });
  return rows.map((r) => r.clienteId);
}

/**
 * Workspace ativo: cookie validado contra membership (ou staff).
 * Nunca cai no "primeiro Cliente do banco" sem auth.
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const internal = await getInternalUser();
  const member = await getWorkspaceMember();
  const jar = await cookies();
  const fromCookie = jar.get(WORKSPACE_COOKIE)?.value?.trim() || null;

  if (internal && internal.id !== "atrako-open-access") {
    if (fromCookie) {
      const exists = await prisma.cliente.findUnique({
        where: { id: fromCookie },
        select: { id: true, ativo: true },
      });
      if (exists?.ativo) return exists.id;
    }
    if (internal.role === "ADMIN" || internal.role === "ANALYST") {
      const first = await prisma.cliente.findFirst({
        where: { ativo: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      return first?.id ?? null;
    }
  }

  if (member) {
    const memberships = await listMemberWorkspaceIds(member.email);
    if (memberships.length === 0) return null;
    if (fromCookie && memberships.includes(fromCookie)) return fromCookie;
    return memberships[0] ?? null;
  }

  if (isDevOpenAccess() && internal?.id === "atrako-open-access") {
    if (fromCookie) {
      const exists = await prisma.cliente.findUnique({
        where: { id: fromCookie },
        select: { id: true },
      });
      if (exists) return exists.id;
    }
    const first = await prisma.cliente.findFirst({
      where: { ativo: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  }

  return null;
}

export async function requireWorkspaceId(): Promise<string> {
  const id = await getActiveWorkspaceId();
  if (!id) throw new Error("Nenhum workspace disponível");
  return id;
}

async function findActiveMember(
  workspaceId: string,
  email: string | null | undefined,
): Promise<WorkspaceMember | null> {
  if (!email) return null;
  return prisma.workspaceMember.findUnique({
    where: { clienteId_email: { clienteId: workspaceId, email: email.trim().toLowerCase() } },
  });
}

function memberHasRole(member: WorkspaceMember, roles: WorkspaceMemberRole[]): boolean {
  return member.active && roles.includes(member.role);
}

/** Staff ADMIN real (plataforma) ou membro OWNER/ADMIN do workspace. */
export async function assertCanManageConfig(workspaceId: string) {
  const internal = await getInternalUser();
  if (internal && internal.id !== "atrako-open-access" && internal.role === "ADMIN") {
    return { kind: "platform" as const, user: internal };
  }

  const memberSession = await getWorkspaceMember();
  const email = memberSession?.email ?? internal?.email ?? null;
  const member = await findActiveMember(workspaceId, email);
  if (member && memberHasRole(member, MANAGE_ROLES)) {
    return { kind: "member" as const, member };
  }

  if (isDevOpenAccess() && internal?.id === "atrako-open-access") {
    return { kind: "platform" as const, user: internal };
  }

  throw new Error("Sem permissão para Config");
}

/** Operação do dia a dia: OWNER/ADMIN/OPERATOR (ou staff ADMIN). */
export async function assertCanOperateWorkspace(workspaceId: string) {
  const internal = await getInternalUser();
  if (internal && internal.id !== "atrako-open-access" && internal.role === "ADMIN") {
    return { kind: "platform" as const, user: internal };
  }
  if (internal && internal.id !== "atrako-open-access" && internal.role === "ANALYST") {
    return { kind: "platform" as const, user: internal };
  }

  const memberSession = await getWorkspaceMember();
  const email = memberSession?.email ?? internal?.email ?? null;
  const member = await findActiveMember(workspaceId, email);
  if (member && memberHasRole(member, OPERATE_ROLES)) {
    return { kind: "member" as const, member };
  }

  if (isDevOpenAccess() && internal?.id === "atrako-open-access") {
    return { kind: "platform" as const, user: internal };
  }

  throw new Error("Sem permissão no workspace");
}

export type WorkspaceAccessKind = "platform" | "member";

/**
 * Gate único para APIs de domínio. Retorna NextResponse 401/403 em falha.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  minRole: "operate" | "manage" = "operate",
): Promise<
  | { ok: true; kind: WorkspaceAccessKind; response: null }
  | { ok: false; kind: null; response: NextResponse }
> {
  if (!workspaceId?.trim()) {
    return {
      ok: false,
      kind: null,
      response: NextResponse.json({ error: "workspaceId required" }, { status: 400 }),
    };
  }

  const ws = await prisma.cliente.findUnique({
    where: { id: workspaceId },
    select: { id: true, ativo: true },
  });
  if (!ws) {
    return {
      ok: false,
      kind: null,
      response: NextResponse.json({ error: "not found" }, { status: 404 }),
    };
  }

  try {
    if (minRole === "manage") {
      const r = await assertCanManageConfig(workspaceId);
      return { ok: true, kind: r.kind, response: null };
    }
    const r = await assertCanOperateWorkspace(workspaceId);
    return { ok: true, kind: r.kind, response: null };
  } catch {
    const internal = await getInternalUser();
    const member = await getWorkspaceMember();
    if (!internal && !member && !isDevOpenAccess()) {
      return {
        ok: false,
        kind: null,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return {
      ok: false,
      kind: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
}
