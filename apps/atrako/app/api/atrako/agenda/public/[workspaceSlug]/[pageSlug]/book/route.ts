import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import {
  assertSlotAvailable,
  pickProfessionalForSlot,
  SlotUnavailableError,
} from "@/lib/agenda/availability";
import { parseBookBody } from "@/lib/agenda/book-validation";
import { findPublicBookingPage } from "@/lib/agenda/public-booking-page";
import {
  newManageToken,
  hasOnlinePayment,
} from "@/lib/agenda/payments";

const HOLD_MINUTES = 15;

type Ctx = {
  params: Promise<{ workspaceSlug: string; pageSlug: string }>;
};

export async function POST(req: Request, { params }: Ctx) {
  const { workspaceSlug, pageSlug } = await params;
  try {
    const raw = await req.json();
    const serviceId = raw.serviceId as string;
    let professionalId = (raw.professionalId as string | undefined) || null;
    const anyone = Boolean(raw.anyone);

    const page = await findPublicBookingPage(workspaceSlug, pageSlug);
    if (!page) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }

    const ps = page.pageServices.find((x) => x.serviceId === serviceId);
    if (!ps?.service?.active) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    const service = ps.service;
    const salon = page.cliente.workspaceSettings?.businessMode === "SALON";
    const linkedPros = service.professionals
      .map((x) => x.professional)
      .filter((p) => p.isActive);

    if (salon && linkedPros.length === 0) {
      return NextResponse.json(
        { error: "Nenhum profissional disponível para este serviço" },
        { status: 400 },
      );
    }

    const body = parseBookBody(raw);
    const startAt = new Date(body.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);
    const needsPayment =
      service.priceCents > 0 && (await hasOnlinePayment(page.cliente.id));
    const holdExpiresAt = needsPayment
      ? addMinutes(new Date(), HOLD_MINUTES)
      : null;
    const timezone = body.timezone || page.timezone;

    if (salon) {
      if (anyone || !professionalId) {
        const picked = await pickProfessionalForSlot({
          bookingPageId: page.id,
          serviceId: service.id,
          startAt,
          endAt,
          timezone,
          durationMinutes: service.durationMinutes,
          bufferBefore: service.bufferBefore,
          bufferAfter: service.bufferAfter,
          professionalIds: linkedPros.map((p) => p.id),
        });
        if (!picked) {
          throw new SlotUnavailableError(
            "Este horário acabou de ser reservado. Escolha outro.",
          );
        }
        professionalId = picked;
      } else if (!linkedPros.some((p) => p.id === professionalId)) {
        return NextResponse.json(
          { error: "Profissional inválido para este serviço" },
          { status: 400 },
        );
      }
    } else {
      professionalId = null;
    }

    let customerId: string | null = null;
    if (body.customerPhone) {
      const phone = body.customerPhone.replace(/\D/g, "");
      if (phone.length >= 8) {
        const customer = await prisma.agendaCustomer.upsert({
          where: {
            clienteId_phoneE164: {
              clienteId: page.cliente.id,
              phoneE164: phone,
            },
          },
          create: {
            clienteId: page.cliente.id,
            phoneE164: phone,
            name: body.customerName,
            email: body.customerEmail || null,
          },
          update: {
            name: body.customerName,
            email: body.customerEmail || undefined,
          },
        });
        customerId = customer.id;
      }
    }

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
          clienteId: page.cliente.id,
          bookingPageId: page.id,
          serviceId: service.id,
          professionalId,
          customerId,
          status: needsPayment ? "PENDING_PAYMENT" : "CONFIRMED",
          startAt,
          endAt,
          timezone,
          customerName: body.customerName.trim(),
          customerEmail: body.customerEmail?.toLowerCase().trim() || null,
          customerPhone: body.customerPhone?.replace(/\D/g, "") || null,
          customerCpf: body.customerCpf || null,
          amountCents: service.priceCents,
          customAnswers: body.customAnswers || undefined,
          holdExpiresAt,
          confirmedAt: needsPayment ? null : new Date(),
          manageToken,
        },
      });

      if (needsPayment && holdExpiresAt) {
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

    if (!needsPayment) {
      try {
        const { syncBookingToGoogle } = await import(
          "@/lib/agenda/google-calendar"
        );
        await syncBookingToGoogle(booking.id);
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status,
      manageToken,
      needsPayment,
      skipPayment: !needsPayment,
      amountCents: service.priceCents,
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
    console.error(e);
    return NextResponse.json({ error: "Erro ao agendar" }, { status: 500 });
  }
}
