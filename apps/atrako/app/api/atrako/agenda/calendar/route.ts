import { NextRequest, NextResponse } from "next/server";
import { addDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import {
  getAvailableSlots,
  getTheoreticalSlots,
  getBusyIntervals,
} from "@/lib/agenda/availability";

type SlotOut = {
  date: string;
  startAt: string;
  endAt: string;
  label: string;
  professionalId?: string | null;
};

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const bookingPageId = request.nextUrl.searchParams.get("bookingPageId");
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const professionalId = request.nextUrl.searchParams.get("professionalId");
  const anyone = request.nextUrl.searchParams.get("anyone") === "1";

  if (!from || !to || !bookingPageId || !serviceId) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const page = await prisma.agendaBookingPage.findFirst({
    where: { id: bookingPageId, clienteId: workspaceId },
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  const service = await prisma.agendaService.findFirst({
    where: { id: serviceId, clienteId: workspaceId },
  });
  if (!service) {
    return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
  }

  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { businessMode: true },
  });
  const salonMode = settings?.businessMode === "SALON";

  const linkedPros = salonMode
    ? await prisma.agendaProfessional.findMany({
        where: {
          clienteId: workspaceId,
          isActive: true,
          services: { some: { serviceId: service.id } },
        },
        orderBy: [{ sortOrder: "asc" }],
        select: { id: true, displayName: true },
      })
    : [];

  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const bookings = await prisma.agendaBooking.findMany({
    where: {
      clienteId: workspaceId,
      bookingPageId: page.id,
      ...(professionalId && !anyone ? { professionalId } : {}),
      startAt: { gte: startOfDay(fromDate), lte: endOfDay(toDate) },
      status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
    },
    include: { service: true, payment: true, professional: true },
    orderBy: { startAt: "asc" },
  });

  const availableSlots: SlotOut[] = [];
  const slotParamsBase = {
    bookingPageId: page.id,
    serviceId: service.id,
    timezone: page.timezone,
    durationMinutes: service.durationMinutes,
    bufferBefore: service.bufferBefore,
    bufferAfter: service.bufferAfter,
    slotStepMinutes: page.slotStepMinutes,
  };

  let d = startOfDay(fromDate);
  while (d <= toDate) {
    const dateStr = d.toISOString().slice(0, 10);

    if (salonMode && anyone && linkedPros.length) {
      const byStart = new Map<string, SlotOut>();
      for (const pro of linkedPros) {
        const slots = await getAvailableSlots({
          ...slotParamsBase,
          date: dateStr,
          professionalId: pro.id,
        });
        for (const slot of slots) {
          if (!byStart.has(slot.startAt)) {
            byStart.set(slot.startAt, {
              date: dateStr,
              ...slot,
              professionalId: pro.id,
            });
          }
        }
      }
      availableSlots.push(
        ...[...byStart.values()].sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
      );
    } else if (salonMode && professionalId) {
      const slots = await getAvailableSlots({
        ...slotParamsBase,
        date: dateStr,
        professionalId,
      });
      for (const slot of slots) {
        availableSlots.push({
          date: dateStr,
          ...slot,
          professionalId,
        });
      }
    } else {
      const { slots } = await getTheoreticalSlots({
        bookingPageId: page.id,
        date: dateStr,
        timezone: page.timezone,
        durationMinutes: service.durationMinutes,
        bufferBefore: service.bufferBefore,
        bufferAfter: service.bufferAfter,
        slotStepMinutes: page.slotStepMinutes,
        professionalId: professionalId || null,
      });
      const busy = await getBusyIntervals({
        bookingPageId: page.id,
        date: dateStr,
        timezone: page.timezone,
        bufferBefore: service.bufferBefore,
        bufferAfter: service.bufferAfter,
        professionalId: professionalId || null,
      });
      for (const slot of slots) {
        const s = new Date(slot.startAt);
        const e = new Date(slot.endAt);
        const conflict = busy.some((b) => s < b.end && e > b.start);
        if (!conflict && s > new Date()) {
          availableSlots.push({
            date: dateStr,
            startAt: slot.startAt,
            endAt: slot.endAt,
            label: slot.label,
            professionalId: professionalId || null,
          });
        }
      }
    }

    d = addDays(d, 1);
  }

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      serviceTitle: b.service.title,
      professionalName: b.professional?.displayName ?? null,
      paymentStatus: b.payment?.status,
    })),
    availableSlots,
    timezone: page.timezone,
    professionalId: anyone ? null : professionalId,
    anyone: salonMode && anyone,
    linkedProfessionals: linkedPros,
  });
}
