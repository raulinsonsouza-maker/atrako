import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { id } = await params;
  const { nome, cor } = await req.json();
  try {
    const segmento = await prisma.segmento.update({
      where: { id },
      data: {
        ...(nome?.trim() ? { nome: nome.trim() } : {}),
        ...(cor ? { cor } : {}),
      },
    });
    await writeAuditLog({
      action: "SEGMENT_UPDATED",
      actorInternalUserId: access.user.id,
      metadata: {
        targetResourceId: id,
        operationType: "update",
        changedFields: [
          ...(nome?.trim() ? ["nome"] : []),
          ...(cor ? ["cor"] : []),
        ],
      },
    });
    return NextResponse.json(segmento);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar segmento" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { id } = await params;
  await prisma.segmento.delete({ where: { id } });
  await writeAuditLog({
    action: "SEGMENT_DELETED",
    actorInternalUserId: access.user.id,
    metadata: { targetResourceId: id, operationType: "delete" },
  });
  return NextResponse.json({ ok: true });
}
