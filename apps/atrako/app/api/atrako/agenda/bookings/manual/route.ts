import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addHours, addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  assertSlotAvailable,
  SlotUnavailableError,
} from "@/lib/agenda/availability";
import { newManageToken, hasOnlinePayment } from "@/lib/agenda/payments";
import { ensureDefaultBookingPage } from "@/lib/agenda/pages";

const schema = z.object({
  workspaceId: z.string().min(1),
  bookingPageId: z.string().optional(),
  serviceId: z.string(),
  startAt: z.string().datetime(),
  customerName: z.string().min(2),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  payOnSite: z.boolean().default(true),
  professionalId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const access = await requireWorkspaceAccess(body.workspaceId, "operate");
    if (!access.ok) return access.response;
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const page = body.bookingPageId
      ? await prisma.agendaBookingPage.findFirst({
          where: { id: body.bookingPageId, clienteId: body.workspaceId },
        })
      : await ensureDefaultBookingPage(body.workspaceId);

    if (!page) {
      return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
    }

    const service = await prisma.agendaService.findFirst({
      where: {
        id: body.serviceId,
        clienteId: body.workspaceId,
        active: true,
      },
    });
    if (!service) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
    }

    const settings = await prisma.workspaceSettings.findUnique({
      where: { clienteId: body.workspaceId },
      select: { businessMode: true },
    });
    const salonMode = settings?.businessMode === "SALON";
    let professionalId: string | null = body.professionalId || null;

    if (salonMode) {
      if (!professionalId) {
        return NextResponse.json(
          { error: "Selecione o profissional" },
          { status: 400 },
        );
      }
      const linked = await prisma.agendaProfessionalService.findFirst({
        where: {
          professionalId,
          serviceId: service.id,
          professional: { clienteId: body.workspaceId, isActive: true },
        },
      });
      if (!linked) {
        return NextResponse.json(
          { error: "Profissional inválido para este serviço" },
          { status: 400 },
        );
      }
    } else {
      professionalId = null;
    }

    const startAt = new Date(body.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);
    const timezone = page.timezone;
    const online = await hasOnlinePayment(body.workspaceId);
    const confirmNow = body.payOnSite || !online || service.priceCents <= 0;
    const holdExpiresAt = confirmNow ? null : addHours(new Date(), 24);
    const manageToken = newManageToken();

    const booking = await prisma.$transaction(async (tx) => {
      await assertSlotAvailable({
        bookingPageId: page.id,
        serviceId: service.id,
        startAt,
        endAt,
        timezone,
        durationMinutes: service.durationMinutes,
        bufferBefore: service.bufferBefore,
        bufferAfter: service.bufferAfter,
        professionalId,
      });

      const b = await tx.agendaBooking.create({
        data: {
          clienteId: body.workspaceId,
          bookingPageId: page.id,
          serviceId: service.id,
          professionalId,
          status: confirmNow ? "CONFIRMED" : "PENDING_PAYMENT",
          startAt,
          endAt,
          timezone,
          customerName: body.customerName.trim(),
          customerEmail: body.customerEmail?.toLowerCase().trim() || null,
          customerPhone: body.customerPhone?.replace(/\D/g, "") || null,
          amountCents: service.priceCents,
          holdExpiresAt,
          confirmedAt: confirmNow ? new Date() : null,
          manageToken,
        },
        include: { service: true },
      });

      if (!confirmNow && holdExpiresAt) {
        await tx.agendaSlotHold.create({
          data: {
            bookingPageId: page.id,
            serviceId: service.id,
            professionalId,
            bookingId: b.id,
            startAt,
            endAt,
            expiresAt: holdExpiresAt,
          },
        });
      }

      return b;
    });

    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status,
      manageToken,
      startAt: booking.startAt.toISOString(),
      holdExpiresAt: holdExpiresAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof SlotUnavailableError) {
      return NextResponse.json(
        { error: e.message, code: "SLOT_UNAVAILABLE" },
        { status: 409 },
      );
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
  }
}
