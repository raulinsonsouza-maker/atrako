import { NextRequest, NextResponse } from "next/server";
import { syncMetaLeadsCliente } from "@/lib/sync/metaLeadsSync";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, ativo: true },
  });

  if (!cliente) {
    return NextResponse.json({ ok: false, error: "Cliente não encontrado" }, { status: 404 });
  }
  if (!cliente.ativo) {
    return NextResponse.json({ ok: false, error: "Cliente inativo" }, { status: 403 });
  }

  const result = await syncMetaLeadsCliente(clienteId);
  const ok = !result.error;
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 422 });
}
