/**
 * Tenancy — workspace ativo e papéis.
 * Toda query de domínio deve filtrar pelo workspaceId retornado aqui.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getInternalUser } from "@/lib/internalUsers";

export const WORKSPACE_COOKIE = "atrako_workspace_id";

export async function getActiveWorkspaceId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(WORKSPACE_COOKIE)?.value?.trim();
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

export async function requireWorkspaceId(): Promise<string> {
  const id = await getActiveWorkspaceId();
  if (!id) throw new Error("Nenhum workspace disponível");
  return id;
}

/** Staff interno (plataforma) ou membro OWNER/ADMIN do workspace. */
export async function assertCanManageConfig(workspaceId: string) {
  const internal = await getInternalUser();
  if (internal?.role === "ADMIN") return { kind: "platform" as const, user: internal };

  const email = internal?.email;
  if (email) {
    const member = await prisma.workspaceMember.findUnique({
      where: { clienteId_email: { clienteId: workspaceId, email } },
    });
    if (member && (member.role === "OWNER" || member.role === "ADMIN") && member.active) {
      return { kind: "member" as const, member };
    }
  }
  // Dev aberto: staff autenticado qualquer
  if (internal) return { kind: "platform" as const, user: internal };
  throw new Error("Sem permissão para Config");
}

/** Operação do dia a dia: OWNER/ADMIN/OPERATOR (ou staff). */
export async function assertCanOperateWorkspace(workspaceId: string) {
  const internal = await getInternalUser();
  if (internal?.role === "ADMIN") return { kind: "platform" as const, user: internal };

  const email = internal?.email;
  if (email) {
    const member = await prisma.workspaceMember.findUnique({
      where: { clienteId_email: { clienteId: workspaceId, email } },
    });
    if (
      member &&
      member.active &&
      (member.role === "OWNER" || member.role === "ADMIN" || member.role === "OPERATOR")
    ) {
      return { kind: "member" as const, member };
    }
  }
  if (internal) return { kind: "platform" as const, user: internal };
  throw new Error("Sem permissão no workspace");
}
