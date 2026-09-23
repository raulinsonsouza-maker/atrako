import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Faça login primeiro" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const invite = await prisma.igMemberInvite.findFirst({
    where: {
      token: parsed.data.token,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 404 });
  }

  if (invite.email.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Convite enviado para outro e-mail" },
      { status: 403 },
    );
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        userId: session.userId,
        organizationId: invite.organizationId,
        role: invite.role,
      },
    }),
    prisma.igMemberInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, organizationId: invite.organizationId });
}
