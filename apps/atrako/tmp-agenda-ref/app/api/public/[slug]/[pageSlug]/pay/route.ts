import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { addSeconds } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  createPixForProvider,
  createCardForProvider,
  isPaidResult,
  dbProvider,
  assertHoldValid,
  HoldExpiredError,
} from "@/lib/payments/create-payment";
import { confirmBooking, SlotUnavailableError } from "@/lib/payments/confirm-booking";
import { isDemoPaymentId } from "@/lib/payments/demo";
import { resolvePaymentProvider } from "@/lib/payments/resolve-provider";
import { isValidCpf } from "@/lib/utils";
import { emitBookingEvent } from "@/lib/events/booking-events";
import { fireBookingPaidConversion } from "@/lib/tracking/server";

async function loadBooking(
  bookingId: string,
  orgSlug: string,
  pageSlug: string,
) {
  return prisma.booking.findFirst({
    where: {
      id: bookingId,
      bookingPage: {
        slug: pageSlug,
        isActive: true,
        organization: { slug: orgSlug },
      },
      status: "PENDING_PAYMENT",
    },
    include: {
      service: true,
      bookingPage: {
        include: { organization: true },
      },
      payment: true,
    },
  });
}

const pixSchema = z.object({
  bookingId: z.string(),
  fingerprint: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; pageSlug: string }> },
) {
  const { slug: orgSlug, pageSlug } = await params;
  const url = new URL(req.url);
  const method = url.searchParams.get("method") || "pix";

  try {
    if (method === "pix") {
      const body = pixSchema.parse(await req.json());
      const booking = await loadBooking(body.bookingId, orgSlug, pageSlug);
      if (!booking) {
        return NextResponse.json(
          { error: "Agendamento inv├ílido ou expirado" },
          { status: 404 },
        );
      }

      try {
        assertHoldValid(booking);
      } catch {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "EXPIRED" },
        });
        return NextResponse.json({ error: "Hold expirado" }, { status: 410 });
      }

      const org = booking.bookingPage.organization;
      const provider = resolvePaymentProvider(org);
      const idempotencyKey = uuidv4();
      const result = await createPixForProvider({
        provider,
        org,
        customer: booking,
        item: booking.service,
        idempotencyKey,
        fingerprint: body.fingerprint,
        metadata: { bookingId: booking.id },
      });

      const payment = await prisma.payment.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          method: "PIX",
          status: "PENDING",
          amountCents: booking.service.priceCents,
          provider: dbProvider(provider),
          caktoPaymentId: result.id,
          idempotencyKey,
          pixQrCode: result.qrCode,
          pixQrCodeBase64: result.qrCodeBase64 || null,
          pixExpiresAt: addSeconds(new Date(), 3600),
          rawResponse: JSON.stringify(result),
        },
        update: {
          method: "PIX",
          status: "PENDING",
          provider: dbProvider(provider),
          caktoPaymentId: result.id,
          idempotencyKey,
          pixQrCode: result.qrCode,
          pixQrCodeBase64: result.qrCodeBase64 || null,
          pixExpiresAt: addSeconds(new Date(), 3600),
          rawResponse: JSON.stringify(result),
        },
      });

      return NextResponse.json({
        paymentId: payment.id,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
        demo: Boolean(result.demo),
        expiresAt: payment.pixExpiresAt,
        provider,
      });
    }

    if (method === "card") {
      const cardSchema = z.object({
        bookingId: z.string(),
        fingerprint: z.string().min(1),
        cardToken: z.string().min(1),
        installments: z.number().int().min(1).max(12).optional(),
      });
      const body = cardSchema.parse(await req.json());
      const booking = await loadBooking(body.bookingId, orgSlug, pageSlug);
      if (!booking) {
        return NextResponse.json(
          { error: "Agendamento inv├ílido ou expirado" },
          { status: 404 },
        );
      }

      const org = booking.bookingPage.organization;
      const provider = resolvePaymentProvider(org);
      const cpf = booking.customerCpf;
      if (
        provider !== "DEMO" &&
        !body.cardToken.startsWith("demo_") &&
        (!cpf || !isValidCpf(cpf))
      ) {
        return NextResponse.json(
          { error: "CPF obrigat├│rio para cart├úo" },
          { status: 400 },
        );
      }

      const idempotencyKey = uuidv4();
      const remoteIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        undefined;

      let result;
      try {
        result = await createCardForProvider({
          provider,
          org,
          customer: booking,
          item: booking.service,
          idempotencyKey,
          fingerprint: body.fingerprint,
          cardToken: body.cardToken,
          installments: Math.min(
            body.installments || 1,
            Math.min(12, Math.max(1, org.cardMaxInstallments || 12)),
          ),
          metadata: { bookingId: booking.id },
          remoteIp,
        });
      } catch (e) {
        await emitBookingEvent({
          type: "payment.failed",
          organizationId: org.id,
          bookingId: booking.id,
          dedupeKey: idempotencyKey,
        });
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Pagamento recusado" },
          { status: 400 },
        );
      }

      const paid = isPaidResult(provider, result);

      if (paid) {
        try {
          await confirmBooking(booking.id);
        } catch (e) {
          if (e instanceof SlotUnavailableError) {
            return NextResponse.json(
              { error: e.message, code: "SLOT_UNAVAILABLE" },
              { status: 409 },
            );
          }
          throw e;
        }
      } else {
        await emitBookingEvent({
          type: "payment.failed",
          organizationId: org.id,
          bookingId: booking.id,
          dedupeKey: result.id || idempotencyKey,
        });
      }

      await prisma.payment.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          method: "CARD",
          status: paid ? "PAID" : "PENDING",
          amountCents: booking.service.priceCents,
          provider: dbProvider(provider),
          caktoPaymentId: result.id,
          idempotencyKey,
          paidAt: paid ? new Date() : null,
          rawResponse: JSON.stringify(result),
        },
        update: {
          method: "CARD",
          status: paid ? "PAID" : "PENDING",
          provider: dbProvider(provider),
          caktoPaymentId: result.id,
          idempotencyKey,
          paidAt: paid ? new Date() : null,
          rawResponse: JSON.stringify(result),
        },
      });

      if (paid) {
        fireBookingPaidConversion(booking.id);
        return NextResponse.json({ ok: true, status: "CONFIRMED", demo: result.demo, provider });
      }

      return NextResponse.json({
        ok: true,
        status: "PENDING",
        message: "Aguardando confirma├º├úo do pagamento",
        provider,
      });
    }

    if (method === "abandon") {
      const body = z.object({ bookingId: z.string() }).parse(await req.json());
      const booking = await loadBooking(body.bookingId, orgSlug, pageSlug);
      if (!booking) {
        return NextResponse.json({ ok: true, status: "RELEASED" });
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED", holdExpiresAt: null },
      });
      return NextResponse.json({ ok: true, status: "RELEASED" });
    }

    if (method === "demo-confirm") {
      const body = z.object({ bookingId: z.string() }).parse(await req.json());
      const booking = await loadBooking(body.bookingId, orgSlug, pageSlug);
      if (!isDemoPaymentId(booking?.payment?.caktoPaymentId)) {
        return NextResponse.json({ error: "S├│ para demo" }, { status: 400 });
      }
      try {
        await confirmBooking(booking!.id);
      } catch (e) {
        if (e instanceof SlotUnavailableError) {
          return NextResponse.json(
            { error: e.message, code: "SLOT_UNAVAILABLE" },
            { status: 409 },
          );
        }
        throw e;
      }
      await prisma.payment.update({
        where: { bookingId: booking!.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      fireBookingPaidConversion(booking!.id);
      return NextResponse.json({ ok: true, status: "CONFIRMED" });
    }

    return NextResponse.json({ error: "M├®todo inv├ílido" }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
    }
    if (e instanceof HoldExpiredError) {
      return NextResponse.json({ error: e.message }, { status: 410 });
    }
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no pagamento" },
      { status: 500 },
    );
  }
}