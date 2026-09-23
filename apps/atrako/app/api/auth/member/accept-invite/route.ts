import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/authSecurity";
import { requireSameOrigin } from "@/lib/requestSecurity";
import { createMemberSession, setMemberSessionCookie } from "@/lib/tenancy/memberAuth";
import { WORKSPACE_COOKIE } from "@/lib/tenancy/workspace";

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const inviteToken = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!inviteToken || !password) {
    return NextResponse.json({ error: "token e senha obrigatórios" }, { status: 400 });
  }
  const policyError = validatePassword(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const invite = await prisma.workspaceInvite.findUnique({ where: { token: inviteToken } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const member = await prisma.$transaction(async (tx) => {
    const m = await tx.workspaceMember.upsert({
      where: {
        clienteId_email: { clienteId: invite.clienteId, email: invite.email.toLowerCase() },
      },
      create: {
        clienteId: invite.clienteId,
        email: invite.email.toLowerCase(),
        name,
        role: invite.role,
        passwordHash,
        passwordUpdatedAt: new Date(),
        active: true,
      },
      update: {
        name: name ?? undefined,
        role: invite.role,
        passwordHash,
        passwordUpdatedAt: new Date(),
        active: true,
      },
    });
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return m;
  });

  const sessionToken = await createMemberSession(member.id);
  const res = NextResponse.json({ ok: true, workspaceId: invite.clienteId });
  setMemberSessionCookie(res, sessionToken);
  res.cookies.set(WORKSPACE_COOKIE, invite.clienteId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
