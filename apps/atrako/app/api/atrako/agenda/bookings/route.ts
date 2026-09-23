import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const bookingPageId = request.nextUrl.searchParams.get("bookingPageId");
  const professionalId = request.nextUrl.searchParams.get("professionalId");

  const bookings = await prisma.agendaBooking.findMany({
    where: {
      clienteId: workspaceId,
      ...(bookingPageId ? { bookingPageId } : {}),
      ...(professionalId ? { professionalId } : {}),
      ...(status === "ACTIVE"
        ? { status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } }
        : status
          ? { status }
          : {}),
      ...(from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q } },
              { customerEmail: { contains: q } },
              { customerPhone: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      service: true,
      bookingPage: { select: { title: true, slug: true } },
      professional: { select: { id: true, displayName: true } },
      payment: true,
    },
    orderBy: { startAt: "desc" },
    take: 200,
  });

  return NextResponse.json(bookings);
}

const cancelSchema = z.object({
  workspaceId: z.string().min(1),
  id: z.string().min(1),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = cancelSchema.parse(await request.json());
    const access = await requireWorkspaceAccess(body.workspaceId, "operate");
    if (!access.ok) return access.response;
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const booking = await prisma.agendaBooking.findFirst({
      where: { id: body.id, clienteId: body.workspaceId },
    });
    if (!booking) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json(booking);
    }

    const updated = await prisma.agendaBooking.update({
      where: { id: body.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await prisma.agendaSlotHold.deleteMany({ where: { bookingId: body.id } });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro" }, { status: 400 });
  }
}
