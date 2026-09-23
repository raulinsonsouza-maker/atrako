import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const segmentos = await prisma.igSegmento.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json({ segmentos });
}

const schema = z.object({
  nome: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
  id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.id) {
    const seg = await prisma.igSegmento.update({
      where: { id: parsed.data.id },
      data: {
        nome: parsed.data.nome,
        filters: (parsed.data.filters ?? {}) as object,
      },
    });
    return NextResponse.json({ segmento: seg });
  }

  const seg = await prisma.igSegmento.create({
    data: {
      organizationId: session.organizationId,
      nome: parsed.data.nome,
      filters: (parsed.data.filters ?? {}) as object,
    },
  });

  return NextResponse.json({ segmento: seg });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  await prisma.igSegmento.deleteMany({
    where: { id, organizationId: session.organizationId },
  });

  return NextResponse.json({ ok: true });
}
