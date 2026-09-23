import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const conversa = await prisma.igConversa.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      contato: true,
      mensagens: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversa) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  // Abrir a conversa = marcar como lida
  const now = new Date();
  const updated = await prisma.igConversa.update({
    where: { id: conversa.id },
    data: { lastReadAt: now },
    include: {
      contato: true,
      mensagens: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({ conversa: updated });
}
