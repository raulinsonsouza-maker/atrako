import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { ensureDefaultBookingPage, attachServiceToDefaultPage } from "@/lib/agenda/pages";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const defaultPage = await ensureDefaultBookingPage(workspaceId);

  const [services, bookings, counts] = await Promise.all([
    prisma.agendaService.findMany({
      where: { clienteId: workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agendaBooking.findMany({
      where: { clienteId: workspaceId },
      include: { service: true },
      orderBy: { startAt: "desc" },
      take: 50,
    }),
    Promise.all([
      prisma.agendaService.count({ where: { clienteId: workspaceId } }),
      prisma.agendaBooking.count({ where: { clienteId: workspaceId } }),
      prisma.agendaBookingPage.count({ where: { clienteId: workspaceId } }),
      prisma.agendaProfessional.count({ where: { clienteId: workspaceId } }),
    ]).then(([servicesCount, bookingsCount, pages, professionals]) => ({
      services: servicesCount,
      bookings: bookingsCount,
      pages,
      professionals,
    })),
  ]);

  return NextResponse.json({
    defaultPage,
    counts,
    services,
    bookings: bookings.map((b) => ({
      id: b.id,
      customerName: b.customerName,
      service: b.service.title,
      startAt: b.startAt.toISOString(),
      status: b.status,
      amountCents: b.amountCents,
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  if (b.action === "service") {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const service = await prisma.agendaService.create({
      data: {
        clienteId: workspaceId,
        title,
        durationMinutes:
          typeof b.durationMinutes === "number" ? b.durationMinutes : 60,
        priceCents: typeof b.priceCents === "number" ? b.priceCents : 0,
      },
    });
    await attachServiceToDefaultPage(workspaceId, service.id);
    return NextResponse.json({ service }, { status: 201 });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
