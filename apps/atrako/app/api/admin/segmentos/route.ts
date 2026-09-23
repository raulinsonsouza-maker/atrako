import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAdmin, requireInternalAnalyst } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function GET() {
  const access = await requireInternalAnalyst();
  if (access.response) return access.response;
  const segmentos = await prisma.segmento.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(segmentos);
}

export async function POST(req: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { nome, cor } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  try {
    const segmento = await prisma.segmento.create({
      data: { nome: nome.trim(), cor: cor || "#6b7280" },
    });
    await writeAuditLog({
      action: "SEGMENT_CREATED",
      actorInternalUserId: access.user.id,
      metadata: { targetResourceId: segmento.id, operationType: "create", changedFields: ["nome", "cor"] },
    });
    return NextResponse.json(segmento, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Segmento já existe com esse nome" }, { status: 409 });
  }
}
