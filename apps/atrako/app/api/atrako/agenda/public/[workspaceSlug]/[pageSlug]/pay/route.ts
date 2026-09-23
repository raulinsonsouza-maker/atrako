import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findPublicBookingPage } from "@/lib/agenda/public-booking-page";
import {
  confirmBookingPaid,
  createBookingPayment,
  hasOnlinePayment,
} from "@/lib/agenda/payments";

type Ctx = {
  params: Promise<{ workspaceSlug: string; pageSlug: string }>;
};

const schema = z.object({
  bookingId: z.string().min(1),
  manageToken: z.string().min(1),
});

export async function POST(req: Request, { params }: Ctx) {
  const { workspaceSlug, pageSlug } = await params;
  try {
    const body = schema.parse(await req.json());
    const page = await findPublicBookingPage(workspaceSlug, pageSlug);
    if (!page) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }

    const booking = await prisma.agendaBooking.findFirst({
      where: {
        id: body.bookingId,
        manageToken: body.manageToken,
        bookingPageId: page.id,
        status: "PENDING_PAYMENT",
      },
      include: { service: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
    }

    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
      await prisma.agendaBooking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Reserva expirada" }, { status: 410 });
    }

    const amountCents = booking.amountCents || booking.service.priceCents;

    if (amountCents <= 0) {
      await confirmBookingPaid(booking.id);
      return NextResponse.json({ status: "CONFIRMED", skipPayment: true });
    }

    const online = await hasOnlinePayment(page.cliente.id);
    if (!online) {
      await prisma.agendaPayment.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          method: "MANUAL",
          status: "PENDING",
          amountCents,
          provider: "MANUAL",
          idempotencyKey: `manual-${booking.id}`,
        },
        update: {},
      });
      await confirmBookingPaid(booking.id);
      return NextResponse.json({
        status: "CONFIRMED",
        instructions:
          "Pagamento online não configurado. Seu horário foi reservado — combine o pagamento com o estabelecimento.",
      });
    }

    const result = await createBookingPayment(booking.id);

    if (result.status === "PAID") {
      return NextResponse.json({ status: "CONFIRMED", payment: result.payment });
    }

    return NextResponse.json({
      status: "PENDING",
      payment: result.payment
        ? {
            id: result.payment.id,
            status: result.payment.status,
            pixQrCode: result.payment.pixQrCode,
            pixQrCodeBase64: result.payment.pixQrCodeBase64,
            amountCents: result.payment.amountCents,
          }
        : null,
      qrCode: result.payment?.pixQrCode,
      qrCodeBase64: result.payment?.pixQrCodeBase64,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no pagamento" },
      { status: 500 },
    );
  }
}
