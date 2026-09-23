import { NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  assertSlotAvailable,
  pickProfessionalForSlot,
  SlotUnavailableError,
} from "@/lib/availability";
import { parseBookBody } from "@/lib/book-validation";
import { mergeFunnelConfig, parseFunnelConfig } from "@/lib/funnel-config";
import { newManageToken } from "@/lib/booking-notify";
import { requiresOnlinePayment } from "@/lib/payments/resolve-provider";
import { emitBookingEvent } from "@/lib/events/booking-events";
import { releaseCustomerPendingBookings } from "@/lib/booking-release-pending";
import { upsertCustomer } from "@/lib/customer-auth";
import { toE164 } from "@/lib/whatsapp/phone";
import { sanitizeClickIds } from "@/lib/tracking/click-ids";
import { fireBookingScheduleConversion } from "@/lib/tracking/server";

const HOLD_MINUTES = 15;

const orgPaymentSelect = {
  paymentProvider: true,
  caktoClientId: true,
  caktoClientSecret: true,
  caktoOfferId: true,
  mercadoPagoAccessToken: true,
  mercadoPagoPublicKey: true,
  asaasApiKey: true,
} as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; pageSlug: string }> },
) {
  const { slug: orgSlug, pageSlug } = await params;
  try {
    const raw = await req.json();
    const serviceId = raw.serviceId as string;
    let professionalId = (raw.professionalId as string | undefined) || null;
    const anyone = Boolean(raw.anyone);

    const page = await prisma.bookingPage.findFirst({
      where: {
        slug: pageSlug,
        isActive: true,
        organization: { slug: orgSlug },
      },
      include: {
        organization: { select: { businessMode: true, ...orgPaymentSelect } },
      },
    });
    if (!page) {
      return NextResponse.json({ error: "N├úo encontrado" }, { status: 404 });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organizationId: page.organizationId,
        pages: { some: { bookingPageId: page.id } },
      },
      include: {
        professionals: {
          where: { professional: { isActive: true } },
          include: { professional: true },
        },
      },
    });
    if (!service) {
      return NextResponse.json({ error: "N├úo encontrado" }, { status: 404 });
    }

    const salonMode = page.organization.businessMode === "SALON";
    const linkedPros = service.professionals.map((ps) => ps.professional);

    if (salonMode) {
      if (linkedPros.length === 0) {
        return NextResponse.json(
          { error: "Nenhum profissional dispon├¡vel para este servi├ºo" },
          { status: 400 },
        );
      }
    }

    const funnelConfig = mergeFunnelConfig(parseFunnelConfig(page.funnelConfig), {
      title: page.title,
      description: page.description,
      accentColor: page.accentColor,
      logoUrl: page.logoUrl,
    });
    const body = parseBookBody(funnelConfig, raw);
    const clickIds = sanitizeClickIds(raw.clickIds || raw);
    const startAt = new Date(body.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);
    const needsPayment = requiresOnlinePayment(page.organization);
    const holdExpiresAt = needsPayment
      ? addMinutes(new Date(), HOLD_MINUTES)
      : null;
    const timezone = body.timezone || page.timezone;

    if (salonMode) {
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
            "Este hor├írio acabou de ser reservado. Escolha outro.",
          );
        }
        professionalId = picked;
      } else if (!linkedPros.some((p) => p.id === professionalId)) {
        return NextResponse.json(
          { error: "Profissional inv├ílido para este servi├ºo" },
          { status: 400 },
        );
      }
    } else {
      professionalId = null;
    }

    let customerId: string | null = null;
    try {
      if (body.customerPhone) {
        const customer = await upsertCustomer({
          organizationId: page.organizationId,
          phone: body.customerPhone,
          name: body.customerName,
          email: body.customerEmail?.toLowerCase() ?? null,
        });
        customerId = customer.id;
      }
    } catch {
      customerId = null;
    }

    const booking = await prisma.$transaction(async (tx) => {
      await releaseCustomerPendingBookings(
        tx,
        page.id,
        body.customerEmail?.toLowerCase() ?? "",
      );

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

      const phoneDigits =
        toE164(body.customerPhone || "")?.replace(/\D/g, "") ||
        body.customerPhone?.replace(/\D/g, "") ||
        "";

      const b = await tx.booking.create({
        data: {
          bookingPageId: page.id,
          serviceId: service.id,
          professionalId,
          customerId,
          status: needsPayment ? "PENDING_PAYMENT" : "CONFIRMED",
          startAt,
          endAt,
          timezone,
          customerName: body.customerName,
          customerEmail: body.customerEmail?.toLowerCase() ?? "",
          customerPhone: phoneDigits,
          customerCpf: body.customerCpf?.replace(/\D/g, "") || null,
          customAnswers: body.customAnswers
            ? JSON.stringify(body.customAnswers)
            : null,
          holdExpiresAt,
          confirmedAt: needsPayment ? null : new Date(),
          manageToken: newManageToken(),
          gclid: clickIds.gclid || null,
          fbclid: clickIds.fbclid || null,
          fbc: clickIds.fbc || null,
          fbp: clickIds.fbp || null,
        },
        include: { service: true, bookingPage: true },
      });

      if (needsPayment) {
        await tx.slotHold.create({
          data: {
            bookingPageId: page.id,
            serviceId: service.id,
            professionalId,
            bookingId: b.id,
            startAt,
            endAt,
            expiresAt: holdExpiresAt!,
          },
        });
      }

      return b;
    });

    if (!needsPayment) {
      await emitBookingEvent({
        type: "booking.confirmed",
        organizationId: page.organizationId,
        bookingId: booking.id,
        dedupeKey: booking.id,
      });
      fireBookingScheduleConversion(booking.id);
    }

    return NextResponse.json({
      bookingId: booking.id,
      manageToken: booking.manageToken,
      holdExpiresAt,
      skipPayment: !needsPayment,
      status: booking.status,
      amountCents: service.priceCents,
      serviceTitle: service.title,
      caktoOfferId: service.caktoOfferId,
      professionalId,
    });
  } catch (e) {
    if (e instanceof SlotUnavailableError) {
      return NextResponse.json({ error: e.message, code: "SLOT_UNAVAILABLE" }, { status: 409 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao reservar" }, { status: 500 });
  }
}