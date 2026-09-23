import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const { id } = await params;
  const contato = await prisma.igContato.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      execucoes: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { fluxo: { select: { nome: true } } },
      },
      conversas: {
        orderBy: { lastMessageAt: "desc" },
        take: 5,
        include: {
          mensagens: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      },
    },
  });

  if (!contato) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ contato });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const { id } = await params;
  const body = (await request.json()) as {
    tags?: string[];
    campos?: Record<string, unknown>;
    phone?: string;
    botPaused?: boolean;
    nome?: string;
  };

  const contato = await prisma.igContato.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!contato) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const updated = await prisma.igContato.update({
    where: { id },
    data: {
      tags: body.tags,
      phone: body.phone,
      botPaused: body.botPaused,
      nome: body.nome,
      campos: body.campos
        ? ({ ...(contato.campos as object), ...body.campos } as object)
        : undefined,
    },
  });

  return NextResponse.json({ contato: updated });
}
