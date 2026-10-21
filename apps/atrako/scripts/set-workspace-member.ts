/**
 * Cria ou atualiza o acesso de um membro com senha (mesma regra do Admin → Clientes → Acesso).
 *
 *   MEMBER_PASSWORD='...' npx tsx scripts/set-workspace-member.ts <slug-do-workspace> <email> [OWNER|ADMIN|OPERATOR|ANALYST]
 */

import { prisma } from "../lib/db";
import { hashPassword, validatePassword } from "../lib/authSecurity";
import type { WorkspaceMemberRole } from "../lib/generated/prisma";

const ROLES: WorkspaceMemberRole[] = ["OWNER", "ADMIN", "OPERATOR", "ANALYST"];

async function main() {
  const [slug, rawEmail, rawRole = "OWNER"] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const role = rawRole.toUpperCase() as WorkspaceMemberRole;
  const password = process.env.MEMBER_PASSWORD ?? "";
  if (!slug || !email || !ROLES.includes(role)) {
    throw new Error("Uso: MEMBER_PASSWORD=... tsx scripts/set-workspace-member.ts <slug> <email> [papel]");
  }
  const policyError = validatePassword(password);
  if (policyError) throw new Error(policyError);

  const cliente = await prisma.cliente.findUnique({ where: { slug }, select: { id: true, nome: true } });
  if (!cliente) throw new Error(`Workspace "${slug}" não encontrado.`);

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { clienteId_email: { clienteId: cliente.id, email } },
      create: { clienteId: cliente.id, email, role, passwordHash, passwordUpdatedAt: now, active: true },
      update: { role, passwordHash, passwordUpdatedAt: now, active: true },
    }),
    prisma.workspaceMember.updateMany({
      where: { email, clienteId: { not: cliente.id }, active: true },
      data: { passwordHash, passwordUpdatedAt: now },
    }),
  ]);
  console.log(`${email} (${role}) com acesso a ${cliente.nome}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
