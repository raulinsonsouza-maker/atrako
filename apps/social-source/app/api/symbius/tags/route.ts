import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const tags = await prisma.igTagDefinition.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json({ tags });
}

const createSchema = z.object({
  nome: z.string().min(1).max(50),
  cor: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const tag = await prisma.igTagDefinition.create({
    data: {
      organizationId: session.organizationId,
      nome: parsed.data.nome,
      cor: parsed.data.cor,
    },
  });

  return NextResponse.json({ tag });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  await prisma.igTagDefinition.deleteMany({
    where: { id, organizationId: session.organizationId },
  });

  return NextResponse.json({ ok: true });
}
