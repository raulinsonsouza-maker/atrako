/**
 * Cria usuários de validação local:
 * - admin (InternalUser ADMIN) → /admin
 * - sense@sense.com (WorkspaceMember OWNER no workspace Sense) → /assistente
 * Senha: admin123
 */
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/authSecurity";

const PASSWORD = "admin123";

async function upsertAdmin() {
  const passwordHash = await hashPassword(PASSWORD);
  const username = "admin";
  const existing = await prisma.internalUser.findUnique({ where: { username } });
  if (existing) {
    return prisma.internalUser.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: "ADMIN",
        active: true,
        mustChangePassword: false,
        name: "Admin Atrako",
        email: "admin@atrako.local",
        failedLoginCount: 0,
        lockedUntil: null,
        failureWindowStartedAt: null,
        passwordChangedAt: new Date(),
      },
    });
  }
  return prisma.internalUser.create({
    data: {
      username,
      passwordHash,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      name: "Admin Atrako",
      email: "admin@atrako.local",
      passwordChangedAt: new Date(),
    },
  });
}

async function upsertSenseWorkspace() {
  const slug = "sense";
  const existing = await prisma.cliente.findUnique({ where: { slug } });
  if (existing) {
    return prisma.cliente.update({
      where: { id: existing.id },
      data: { nome: "Sense", ativo: true },
    });
  }
  return prisma.cliente.create({
    data: {
      nome: "Sense",
      slug,
      ativo: true,
      segmento: "Demo",
    },
  });
}

async function upsertSenseMember(clienteId: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const email = "sense@sense.com";
  const existing = await prisma.workspaceMember.findFirst({
    where: { email, clienteId },
  });
  if (existing) {
    return prisma.workspaceMember.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: "OWNER",
        active: true,
        name: "Sense",
      },
    });
  }
  // Reativa/atualiza se o e-mail existir em outro workspace órfão? Preferimos unique por cliente+email.
  const byEmail = await prisma.workspaceMember.findFirst({ where: { email } });
  if (byEmail) {
    return prisma.workspaceMember.update({
      where: { id: byEmail.id },
      data: {
        clienteId,
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: "OWNER",
        active: true,
        name: "Sense",
      },
    });
  }
  return prisma.workspaceMember.create({
    data: {
      clienteId,
      email,
      name: "Sense",
      role: "OWNER",
      active: true,
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
  });
}

async function main() {
  const admin = await upsertAdmin();
  const workspace = await upsertSenseWorkspace();
  const member = await upsertSenseMember(workspace.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        password: PASSWORD,
        admin: {
          username: admin.username,
          role: admin.role,
          active: admin.active,
          redirect: "/admin/clientes",
        },
        sense: {
          email: member.email,
          role: member.role,
          active: member.active,
          workspace: { id: workspace.id, nome: workspace.nome, slug: workspace.slug },
          redirect: "/assistente",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
