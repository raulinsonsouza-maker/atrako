import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar senha";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
