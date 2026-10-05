import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/authSecurity";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";
import { createWorkspaceInvite } from "@/lib/tenancy/invites";
import type { WorkspaceMemberRole } from "@/lib/generated/prisma";

const ROLES: WorkspaceMemberRole[] = ["OWNER", "ADMIN", "OPERATOR", "ANALYST"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lista quem acessa a área do cliente deste workspace. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { id } = await params;

  const members = await prisma.workspaceMember.findMany({
    where: { clienteId: id, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });
  return NextResponse.json({
    members: members.map(({ passwordHash, ...m }) => ({ ...m, hasPassword: passwordHash !== null })),
  });
}

/**
 * `{ email, role?, password? }` — com senha: define direto; sem senha: gera link de convite
 * (o mesmo link também redefine a senha de quem já tem acesso).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = ROLES.includes(body.role as WorkspaceMemberRole)
    ? (body.role as WorkspaceMemberRole)
    : "OWNER";

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true } });
  if (!cliente) return NextResponse.json({ error: "Workspace não encontrado." }, { status: 404 });

  if (password) {
    const policyError = validatePassword(password);
    if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const now = new Date();
    await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: { clienteId_email: { clienteId: id, email } },
        create: { clienteId: id, email, role, passwordHash, passwordUpdatedAt: now, active: true },
        update: { role, passwordHash, passwordUpdatedAt: now, active: true },
      }),
      // O login de membro é por e-mail (não por workspace): mantém a mesma senha em todos.
      prisma.workspaceMember.updateMany({
        where: { email, clienteId: { not: id }, active: true },
        data: { passwordHash, passwordUpdatedAt: now },
      }),
    ]);
    await writeAuditLog({
      action: "WORKSPACE_MEMBER_PASSWORD_SET",
      actorInternalUserId: access.user.id,
      metadata: { clientId: id, email, role },
    });
    return NextResponse.json({ ok: true, mode: "password", email });
  }

  const invite = await createWorkspaceInvite({ clienteId: id, email, role });
  await writeAuditLog({
    action: "WORKSPACE_MEMBER_INVITE_CREATED",
    actorInternalUserId: access.user.id,
    metadata: { clientId: id, email, role },
  });
  return NextResponse.json({
    ok: true,
    mode: "invite",
    email,
    acceptUrl: `${request.nextUrl.origin}${invite.acceptPath}`,
  });
}
