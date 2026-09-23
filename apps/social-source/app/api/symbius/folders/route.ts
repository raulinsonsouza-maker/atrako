import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

const createSchema = z.object({
  nome: z.string().min(1).max(80),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const pastas = await prisma.igFluxoPasta.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { nome: "asc" },
    include: { _count: { select: { fluxos: true } } },
  });

  return NextResponse.json({ pastas });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const pasta = await prisma.igFluxoPasta.create({
    data: {
      organizationId: session.organizationId,
      nome: parsed.data.nome.trim(),
    },
  });

  return NextResponse.json({ pasta });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id: string;
    nome?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const existing = await prisma.igFluxoPasta.findFirst({
    where: { id: body.id, organizationId: session.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const pasta = await prisma.igFluxoPasta.update({
    where: { id: body.id },
    data: { nome: body.nome?.trim() || existing.nome },
  });

  return NextResponse.json({ pasta });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const existing = await prisma.igFluxoPasta.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.igFluxo.updateMany({
      where: { pastaId: id, organizationId: session.organizationId },
      data: { pastaId: null },
    }),
    prisma.igFluxoPasta.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
