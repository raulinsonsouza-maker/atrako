import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTheoreticalSlots, getAvailableSlots } from "@/lib/availability";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const bookingPageId = searchParams.get("bookingPageId");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");

  if (!bookingPageId || !serviceId || !date) {
    return NextResponse.json({ error: "Par├ómetros inv├ílidos" }, { status: 400 });
  }

  const page = await prisma.bookingPage.findFirst({
    where: { id: bookingPageId, organizationId: session.user.organizationId },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      organizationId: session.user.organizationId,
      pages: { some: { bookingPageId: page.id } },
    },
  });
  if (!service) return NextResponse.json({ error: "Servi├ºo n├úo encontrado" }, { status: 404 });

  const theoretical = await getTheoreticalSlots({
    bookingPageId: page.id,
    date,
    timezone: page.timezone,
    durationMinutes: service.durationMinutes,
    bufferBefore: service.bufferBefore,
    bufferAfter: service.bufferAfter,
    slotStepMinutes: page.slotStepMinutes,
  });

  const available = await getAvailableSlots({
    bookingPageId: page.id,
    serviceId: service.id,
    date,
    timezone: page.timezone,
    durationMinutes: service.durationMinutes,
    bufferBefore: service.bufferBefore,
    bufferAfter: service.bufferAfter,
    slotStepMinutes: page.slotStepMinutes,
  });

  return NextResponse.json({
    date,
    service: {
      id: service.id,
      title: service.title,
      durationMinutes: service.durationMinutes,
    },
    theoretical,
    available,
    availableCount: available.length,
  });
}