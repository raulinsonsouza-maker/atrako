import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/symbius/auth";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

const schema = z.object({ organizationId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId: parsed.data.organizationId,
      },
    },
    include: { organization: true },
  });

  if (!membership || membership.organization.status !== "ACTIVE") {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
  }

  const token = await createSessionToken({
    userId: session.userId,
    organizationId: membership.organizationId,
    role: membership.role,
    email: session.email,
    nome: session.nome,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, organizationId: membership.organizationId });
}
