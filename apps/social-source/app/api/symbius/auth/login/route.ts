import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/symbius/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      {
        error:
          "Esta conta entra com Instagram. Use o botão “Entrar com Instagram”.",
      },
      { status: 401 },
    );
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  const membership = user.memberships[0];
  if (!membership || membership.organization.status !== "ACTIVE") {
    return NextResponse.json({ error: "Conta suspensa" }, { status: 403 });
  }

  const token = await createSessionToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    email: user.email,
    nome: user.nome,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
