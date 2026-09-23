import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function GET() {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const [members, invites] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      include: { user: { select: { id: true, email: true, nome: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.igMemberInvite.findMany({
      where: {
        organizationId: session.organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      email: m.user.email,
      nome: m.user.nome,
    })),
    invites,
  });
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["AGENT", "ADMIN"]).default("AGENT"),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    include: { _count: { select: { members: true } } },
  });

  if (org._count.members >= org.maxMembers) {
    return NextResponse.json({ error: "Limite de membros atingido" }, { status: 403 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existingUser) {
    const already = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: session.organizationId,
        },
      },
    });
    if (already) {
      return NextResponse.json({ error: "Usuário já é membro" }, { status: 409 });
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const invite = await prisma.igMemberInvite.create({
    data: {
      organizationId: session.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({
    ok: true,
    invite,
    acceptUrl: `/app/invite/${token}`,
  });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiSession("OWNER");
  if (!isSession(session)) return session;

  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId obrigatório" }, { status: 400 });
  }

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: session.organizationId },
  });
  if (!member || member.role === "OWNER") {
    return NextResponse.json({ error: "Não permitido" }, { status: 403 });
  }

  await prisma.organizationMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
