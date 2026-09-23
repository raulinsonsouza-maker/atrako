import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { portalToken: token },
    select: { id: true, nome: true, slug: true },
  });
  if (!cliente) {
    return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ clienteId: cliente.id, nome: cliente.nome });
}
