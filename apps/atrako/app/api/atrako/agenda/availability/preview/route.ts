import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getAvailableSlots } from "@/lib/agenda/availability";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const bookingPageId = request.nextUrl.searchParams.get("bookingPageId");
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const date = request.nextUrl.searchParams.get("date");
  const professionalId = request.nextUrl.searchParams.get("professionalId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!bookingPageId || !serviceId || !date) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const page = await prisma.agendaBookingPage.findFirst({
    where: { id: bookingPageId, clienteId: workspaceId },
  });
  const service = await prisma.agendaService.findFirst({
    where: { id: serviceId, clienteId: workspaceId, active: true },
  });
  if (!page || !service) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const slots = await getAvailableSlots({
    bookingPageId: page.id,
    serviceId: service.id,
    date,
    timezone: page.timezone,
    durationMinutes: service.durationMinutes,
    bufferBefore: service.bufferBefore,
    bufferAfter: service.bufferAfter,
    slotStepMinutes: page.slotStepMinutes,
    professionalId: professionalId || null,
  });

  return NextResponse.json({ slots, timezone: page.timezone });
}
