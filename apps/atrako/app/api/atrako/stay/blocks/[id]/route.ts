import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { stayCanManage, stayPanelRole } from "@/lib/stay/panel";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim() ?? "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!stayCanManage(await stayPanelRole(workspaceId))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  const property = await prisma.stayProperty.findUnique({ where: { clienteId: workspaceId }, select: { id: true } });
  if (!property) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
  const removed = await prisma.stayBlock.deleteMany({ where: { id, propertyId: property.id } });
  if (!removed.count) return NextResponse.json({ error: "Bloqueio não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
