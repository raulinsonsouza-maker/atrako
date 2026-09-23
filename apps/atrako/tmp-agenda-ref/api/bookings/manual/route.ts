import { NextResponse } from "next/server";
import { z } from "zod";
import { addHours, addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  assertSlotAvailable,
  SlotUnavailableError,
} from "@/lib/availability";
import {
  apiAuthContext,
  isAdminRole,
  isProfessionalRole,
} from "@/lib/rbac";
import { newManageToken, manageBookingUrl, bookingPaymentUrl } from "@/lib/booking-notify";
import { requiresOnlinePayment } from "@/lib/payments/resolve-provider";
import { emitBookingEvent } from "@/lib/events/booking-events";

const MANUAL_HOLD_HOURS = 24;

const schema = z.object({
  bookingPageId: z.string(),
  serviceId: z.string(),
  startAt: z.string().datetime(),
  customerName: z.string().min(2),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  payOnSite: z.boolean().default(false),
  professionalId: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await apiAuthContext();
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  if (isProfessionalRole(ctx.role) && !ctx.professionalId) {
    return NextResponse.json({ error: "Sem permiss├úo" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());

    const page = await prisma.bookingPage.findFirst({
      where: { id: body.bookingPageId, organizationId: ctx.organizationId },
      include: {
        organization: {
          select: {
            id: true,
            slug: true,
            businessMode: true,
            paymentProvider: true,
            caktoClientId: true,
            caktoClientSecret: true,
            caktoOfferId: true,
            mercadoPagoAccessToken: true,
            mercadoPagoPublicKey: true,
            asaasApiKey: true,
          },
        },
      },
    });
    if (!page) {
      return NextResponse.json({ error: "Agenda ou servi├ºo n├úo encontrado" }, { status: 404 });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: body.serviceId,
        isActive: true,
        organizationId: ctx.organizationId,
        pages: { some: { bookingPageId: page.id } },
      },
    });
    if (!service) {
      return NextResponse.json({ error: "Agenda ou servi├ºo n├úo encontrado" }, { status: 404 });
    }

    const salonMode = page.organization.businessMode === "SALON";
    let professionalId: string | null = null;

    if (salonMode) {
      if (isProfessionalRole(ctx.role)) {
        professionalId = ctx.professionalId;
      } else if (isAdminRole(ctx.role)) {
        if (!body.professionalId) {
          return NextResponse.json(
            { error: "Selecione o profissional para este agendamento" },
            { status: 400 },
          );
        }
        professionalId = body.professionalId;
      }

      const linked = await prisma.professionalService.findFirst({
        where: {
          professionalId: professionalId!,
          serviceId: service.id,
          professional: {
            organizationId: ctx.organizationId,
            isActive: true,
          },
        },
      });
      if (!linked) {
        return NextResponse.json(
          { error: "Profissional inv├ílido para este servi├ºo" },
          { status: 400 },
        );
      }
    }

    const startAt = new Date(body.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);
    const timezone = page.timezone;
    const onlinePayment = requiresOnlinePayment(page.organization);
    const confirmNow = body.payOnSite || !onlinePayment;
    const holdExpiresAt = confirmNow
      ? null
      : addHours(new Date(), MANUAL_HOLD_HOURS);

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

      const overlap = await tx.booking.findFirst({
        where: {
          bookingPageId: page.id,
          ...(professionalId ? { professionalId } : {}),
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } },
          ],
        },
      });
      if (overlap) {
        throw new SlotUnavailableError(
          "Este hor├írio acabou de ser reservado. Escolha outro.",
        );
      }

      const b = await tx.booking.create({
        data: {
          bookingPageId: page.id,
          serviceId: service.id,
          professionalId,
          status: confirmNow ? "CONFIRMED" : "PENDING_PAYMENT",
          startAt,
          endAt,
          timezone,
          customerName: body.customerName.trim(),
          customerEmail: body.customerEmail?.toLowerCase().trim() || "",
          customerPhone: body.customerPhone?.replace(/\D/g, "") || "",
          holdExpiresAt,
          confirmedAt: confirmNow ? new Date() : null,
          manageToken,
        },
        include: { service: true },
      });

      if (!confirmNow && holdExpiresAt) {
        await tx.slotHold.create({
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

    if (confirmNow) {
      await emitBookingEvent({
        type: "booking.confirmed",
        organizationId: page.organizationId,
        bookingId: booking.id,
        dedupeKey: booking.id,
      });
    }

    const paymentUrl = confirmNow
      ? null
      : bookingPaymentUrl(
          page.organization.slug,
          page.slug,
          manageToken,
        );

    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status,
      manageToken,
      manageUrl: manageBookingUrl(manageToken),
      paymentUrl,
      serviceTitle: service.title,
      startAt: booking.startAt.toISOString(),
      holdExpiresAt: holdExpiresAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof SlotUnavailableError) {
      return NextResponse.json({ error: e.message, code: "SLOT_UNAVAILABLE" }, { status: 409 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
  }
}