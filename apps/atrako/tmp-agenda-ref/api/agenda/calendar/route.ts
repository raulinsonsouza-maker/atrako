import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAvailableSlots,
  getTheoreticalSlots,
  getBusyIntervals,
} from "@/lib/availability";
import { getGoogleCalendarEvents } from "@/lib/google/calendar";
import {
  apiAuthContext,
  bookingScopeWhere,
  isAdminRole,
  isProfessionalRole,
  resolveProfessionalScope,
} from "@/lib/rbac";
import { addDays, parseISO, startOfDay, endOfDay } from "date-fns";

type SlotOut = {
  date: string;
  startAt: string;
  endAt: string;
  label: string;
  professionalId?: string | null;
};

async function linkedProfessionals(organizationId: string, serviceId: string) {
  return prisma.professional.findMany({
    where: {
      organizationId,
      isActive: true,
      services: { some: { serviceId } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, displayName: true },
  });
}

export async function GET(req: Request) {
  const auth = await apiAuthContext();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const bookingPageId = searchParams.get("bookingPageId");
  const serviceId = searchParams.get("serviceId");
  const professionalIdParam = searchParams.get("professionalId");
  const anyone = searchParams.get("anyone") === "1";

  if (!from || !to || !bookingPageId || !serviceId) {
    return NextResponse.json({ error: "Par├ómetros inv├ílidos" }, { status: 400 });
  }

  const page = await prisma.bookingPage.findFirst({
    where: { id: bookingPageId, organizationId: ctx.organizationId },
    include: { organization: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      organizationId: ctx.organizationId,
      pages: { some: { bookingPageId: page.id } },
    },
  });
  if (!service) {
    return NextResponse.json({ error: "Servi├ºo n├úo encontrado" }, { status: 404 });
  }

  const salonMode = page.organization.businessMode === "SALON";
  const adminSalon = salonMode && isAdminRole(ctx.role);

  let professionalId = resolveProfessionalScope(ctx, professionalIdParam);

  if (isProfessionalRole(ctx.role) && ctx.professionalId) {
    const linked = await prisma.professionalService.findFirst({
      where: {
        professionalId: ctx.professionalId,
        serviceId: service.id,
        professional: { isActive: true },
      },
    });
    if (!linked) {
      return NextResponse.json(
        { error: "Sem permiss├úo para este servi├ºo" },
        { status: 403 },
      );
    }
  }

  const linkedPros = adminSalon
    ? await linkedProfessionals(ctx.organizationId, service.id)
    : [];

  if (adminSalon) {
    if (linkedPros.length === 0) {
      return NextResponse.json({
        bookings: [],
        availableSlots: [] as SlotOut[],
        googleEvents: [],
        googleConnected: false,
        timezone: page.timezone,
        professionalId: null,
        anyone: false,
        linkedProfessionals: [],
        setupHint: "NO_PROS" as const,
      });
    }

    if (!anyone && !professionalId) {
      return NextResponse.json({
        bookings: [],
        availableSlots: [] as SlotOut[],
        googleEvents: [],
        googleConnected: false,
        timezone: page.timezone,
        professionalId: null,
        anyone: false,
        linkedProfessionals: linkedPros,
        setupHint: "NEED_PRO_FILTER" as const,
      });
    }

    if (professionalId && !anyone) {
      if (!linkedPros.some((p) => p.id === professionalId)) {
        return NextResponse.json(
          { error: "Profissional n├úo atende este servi├ºo" },
          { status: 400 },
        );
      }
    }
  } else if (professionalId) {
    const pro = await prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
    });
    if (!pro) {
      return NextResponse.json(
        { error: "Profissional n├úo encontrado" },
        { status: 404 },
      );
    }
  }

  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const bookingProFilter =
    professionalId && !anyone
      ? { professionalId }
      : anyone
        ? { professionalId: { in: linkedPros.map((p) => p.id) } }
        : {};

  const bookings = await prisma.booking.findMany({
    where: {
      ...bookingScopeWhere(ctx),
      bookingPageId: page.id,
      ...(adminSalon && (anyone || professionalId) ? bookingProFilter : {}),
      ...(!adminSalon && professionalId && !isProfessionalRole(ctx.role)
        ? { professionalId }
        : {}),
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

    if (adminSalon && anyone) {
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
              startAt: slot.startAt,
              endAt: slot.endAt,
              label: slot.label,
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
    } else if (adminSalon && professionalId) {
      const slots = await getAvailableSlots({
        ...slotParamsBase,
        date: dateStr,
        professionalId,
      });
      for (const slot of slots) {
        availableSlots.push({
          date: dateStr,
          startAt: slot.startAt,
          endAt: slot.endAt,
          label: slot.label,
          professionalId,
        });
      }
    } else {
      // SOLO ou profissional logado: horas da p├ígina / do pr├│prio pro
      const { slots } = await getTheoreticalSlots({
        bookingPageId: page.id,
        date: dateStr,
        timezone: page.timezone,
        durationMinutes: service.durationMinutes,
        bufferBefore: service.bufferBefore,
        bufferAfter: service.bufferAfter,
        slotStepMinutes: page.slotStepMinutes,
        professionalId,
      });
      const busy = await getBusyIntervals({
        bookingPageId: page.id,
        date: dateStr,
        timezone: page.timezone,
        bufferBefore: service.bufferBefore,
        bufferAfter: service.bufferAfter,
        professionalId,
      });
      for (const slot of slots) {
        const s = new Date(slot.startAt);
        const e = new Date(slot.endAt);
        const conflict = busy.some((b) => s < b.end && e > b.start);
        const booked = bookings.some(
          (b) =>
            b.status !== "CANCELLED" &&
            b.startAt.toISOString() === slot.startAt,
        );
        if (!conflict && !booked) {
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

  let setupHint: "NO_PROS" | "NO_HOURS" | "NEED_PRO_FILTER" | null = null;
  if (adminSalon && linkedPros.length > 0 && availableSlots.length === 0) {
    const targetIds = anyone
      ? linkedPros.map((p) => p.id)
      : professionalId
        ? [professionalId]
        : [];
    if (targetIds.length) {
      const rules = await prisma.availabilityRule.count({
        where: { professionalId: { in: targetIds } },
      });
      if (rules === 0) setupHint = "NO_HOURS";
    }
  }

  const googleConnected =
    !salonMode &&
    !professionalId &&
    Boolean(
      page.organization.googleRefreshToken || page.organization.googleAccessToken,
    );

  const syncedGoogleIds = new Set(
    bookings.map((b) => b.googleEventId).filter(Boolean) as string[],
  );

  let googleEvents: {
    id: string;
    summary: string;
    startAt: string;
    endAt: string;
    htmlLink: string | null;
  }[] = [];

  if (googleConnected) {
    const events = await getGoogleCalendarEvents({
      org: page.organization,
      timeMin: startOfDay(fromDate),
      timeMax: endOfDay(toDate),
    });
    googleEvents = events
      .filter((ev) => !syncedGoogleIds.has(ev.id))
      .map((ev) => ({
        id: ev.id,
        summary: ev.summary,
        startAt: ev.start.toISOString(),
        endAt: ev.end.toISOString(),
        htmlLink: ev.htmlLink,
      }));
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
      googleEventId: b.googleEventId,
      paymentStatus: b.payment?.status,
    })),
    availableSlots,
    googleEvents,
    googleConnected,
    timezone: page.timezone,
    professionalId: anyone ? null : professionalId,
    anyone: adminSalon && anyone,
    linkedProfessionals: linkedPros,
    setupHint,
  });
}