import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getAvailableSlots,
  getAvailableSlotsAnyone,
} from "@/lib/agenda/availability";
import { findPublicBookingPage } from "@/lib/agenda/public-booking-page";

type Ctx = {
  params: Promise<{ workspaceSlug: string; pageSlug: string }>;
};

export async function GET(request: NextRequest, { params }: Ctx) {
  const { workspaceSlug, pageSlug } = await params;
  const date = request.nextUrl.searchParams.get("date");
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const professionalId = request.nextUrl.searchParams.get("professionalId");
  const anyone = request.nextUrl.searchParams.get("anyone") === "1";

  if (!date || !serviceId) {
    return NextResponse.json({ error: "date e serviceId" }, { status: 400 });
  }

  const page = await findPublicBookingPage(workspaceSlug, pageSlug);
  if (!page) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const ps = page.pageServices.find((x) => x.serviceId === serviceId);
  if (!ps?.service?.active) {
    return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
  }
  const service = ps.service;
  const timezone = page.timezone;
  const salon =
    page.cliente.workspaceSettings?.businessMode === "SALON";

  const proIds = service.professionals
    .map((p) => p.professional)
    .filter((p) => p.isActive)
    .map((p) => p.id);

  let slots;
  if (salon && (anyone || !professionalId) && proIds.length) {
    slots = await getAvailableSlotsAnyone({
      bookingPageId: page.id,
      serviceId: service.id,
      date,
      timezone,
      durationMinutes: service.durationMinutes,
      bufferBefore: service.bufferBefore,
      bufferAfter: service.bufferAfter,
      professionalIds: proIds,
    });
  } else {
    slots = await getAvailableSlots({
      bookingPageId: page.id,
      serviceId: service.id,
      date,
      timezone,
      durationMinutes: service.durationMinutes,
      bufferBefore: service.bufferBefore,
      bufferAfter: service.bufferAfter,
      slotStepMinutes: page.slotStepMinutes,
      professionalId: professionalId || null,
    });
  }

  return NextResponse.json({ slots, timezone });
}
