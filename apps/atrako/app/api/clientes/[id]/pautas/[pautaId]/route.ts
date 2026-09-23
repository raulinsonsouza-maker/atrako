import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { writeAuditLog } from "@/lib/internalUsers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pautaId: string }> }
) {
  const { id, pautaId } = await params;
  const access = await requireClienteAccess(request, id, "write");
  if (access.response) return access.response;
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
    if (access.internalUser) {
      const changedFields = ["status", "titulo", "prioridade", "dataFim"].filter(
        (field) => body[field as keyof typeof body] !== undefined,
      );
      await writeAuditLog({
        action: "PAUTA_UPDATED",
        actorInternalUserId: access.internalUser.id,
        metadata: { clientId: id, targetResourceId: pautaId, operationType: "update", changedFields },
      });
    }
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
  const access = await requireClienteAccess(_request, id, "write");
  if (access.response) return access.response;
  try {
    await prisma.pautaReuniao.delete({
      where: { id: pautaId, clienteId: id },
    });
    if (access.internalUser) {
      await writeAuditLog({
        action: "PAUTA_DELETED",
        actorInternalUserId: access.internalUser.id,
        metadata: { clientId: id, targetResourceId: pautaId, operationType: "delete" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }
}
