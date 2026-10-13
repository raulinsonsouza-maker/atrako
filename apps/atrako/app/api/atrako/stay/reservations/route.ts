import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureStayWorkspace } from "@/lib/stay/catalog";
import { stayCanManage, stayPanelRole } from "@/lib/stay/panel";
import { createManualStayReservation } from "@/lib/stay/reservations";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  const rows = await prisma.stayReservation.findMany({
    where: { clienteId: workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    reservations: rows.map((row) => ({
      id: row.id,
      number: row.number,
      guestName: row.guestName,
      guestEmail: row.guestEmail,
      guestPhone: row.guestPhone,
      guests: row.guests,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      nights: row.nights,
      amountCents: row.amountCents,
      status: row.status,
      channel: row.channel,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    })),
  });
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
  await ensureStayWorkspace(workspaceId);
  const property = await prisma.stayProperty.findUnique({ where: { clienteId: workspaceId } });
  if (!property) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
  const created = await createManualStayReservation({
    property,
    checkIn: String(body.checkIn ?? ""),
    checkOut: String(body.checkOut ?? ""),
    guestName: String(body.guestName ?? ""),
    guestEmail: typeof body.guestEmail === "string" ? body.guestEmail : null,
    guestPhone: String(body.guestPhone ?? ""),
    guests: Number(body.guests ?? 1),
    notes: typeof body.notes === "string" ? body.notes : null,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  return NextResponse.json({ reservation: created.reservation });
}
