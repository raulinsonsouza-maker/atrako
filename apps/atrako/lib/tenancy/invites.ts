import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { WorkspaceMemberRole } from "@/lib/generated/prisma";

export function createInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/** Cria (ou renova) convite OWNER/membro e retorna URL relativa. */
export async function createWorkspaceInvite(input: {
  clienteId: string;
  email: string;
  role?: WorkspaceMemberRole;
  expiresInDays?: number;
}): Promise<{ token: string; acceptPath: string }> {
  const email = input.email.trim().toLowerCase();
  const token = createInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 14));
  await prisma.workspaceInvite.create({
    data: {
      clienteId: input.clienteId,
      email,
      role: input.role ?? "OWNER",
      token,
      expiresAt,
    },
  });
  // Ensure member row exists (sem senha até aceite)
  await prisma.workspaceMember.upsert({
    where: { clienteId_email: { clienteId: input.clienteId, email } },
    create: {
      clienteId: input.clienteId,
      email,
      role: input.role ?? "OWNER",
      active: true,
    },
    update: {
      role: input.role ?? "OWNER",
      active: true,
    },
  });
  return { token, acceptPath: `/invite?token=${token}` };
}
