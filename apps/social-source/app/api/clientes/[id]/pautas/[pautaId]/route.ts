import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pautaId: string }> }
) {
  const { id, pautaId } = await params;
  let body: { status?: string; titulo?: string; prioridade?: string; dataFim?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const pauta = await prisma.pautaReuniao.update({
      where: { id: pautaId, clienteId: id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.titulo !== undefined && { titulo: body.titulo }),
        ...(body.prioridade !== undefined && { prioridade: body.prioridade }),
        ...(body.dataFim !== undefined && {
          dataFim: body.dataFim ? new Date(body.dataFim) : null,
        }),
      },
    });
    return NextResponse.json(pauta);
  } catch {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pautaId: string }> }
) {
  const { id, pautaId } = await params;
  try {
    await prisma.pautaReuniao.delete({
      where: { id: pautaId, clienteId: id },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }
}
