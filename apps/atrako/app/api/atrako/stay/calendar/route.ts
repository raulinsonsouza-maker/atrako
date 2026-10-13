import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureStayWorkspace } from "@/lib/stay/catalog";
import { stayCanManage, stayPanelRole } from "@/lib/stay/panel";
import { calendarMonth, createStayBlock } from "@/lib/stay/reservations";
import { todayInTimeZone } from "@/lib/stay/nights";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const month = request.nextUrl.searchParams.get("month")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  await ensureStayWorkspace(workspaceId);
  const property = await prisma.stayProperty.findUnique({ where: { clienteId: workspaceId } });
  if (!property) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
  const current = month || todayInTimeZone(property.timezone).slice(0, 7);
  const calendar = await calendarMonth(property, current);
  if (!calendar) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  return NextResponse.json(calendar);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!stayCanManage(await stayPanelRole(workspaceId))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  const property = await prisma.stayProperty.findUnique({ where: { clienteId: workspaceId } });
  if (!property) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
  const created = await createStayBlock({
    propertyId: property.id,
    startDate: String(body.startDate ?? ""),
    endDate: String(body.endDate ?? ""),
    reason: typeof body.reason === "string" ? body.reason : null,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  return NextResponse.json({ block: created.block });
}
