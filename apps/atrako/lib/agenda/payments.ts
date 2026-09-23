import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";
import { createMercadoPagoOrder } from "@/lib/commerce/mp";

export function newManageToken() {
  return randomBytes(24).toString("hex");
}

export async function hasOnlinePayment(workspaceId: string) {
  const creds = await resolveMercadoPago(workspaceId);
  return Boolean(creds?.accessToken);
}

export async function createBookingPixPayment(params: {
  workspaceId: string;
  bookingId: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  payerName?: string;
}) {
  const amount = params.amountCents / 100;
  if (amount <= 0) {
    return { status: "PAID" as const, payment: null };
  }

  const connected = await hasOnlinePayment(params.workspaceId);
  if (!connected) {
    throw new Error("Mercado Pago não conectado (Config → Conexões)");
  }

  const idempotencyKey = `agenda-booking-${params.bookingId}-${randomUUID()}`;

  const order = await createMercadoPagoOrder({
    workspaceId: params.workspaceId,
    externalReference: params.bookingId,
    amount,
    description: params.description,
    payer: {
      email: params.payerEmail,
      firstName: params.payerName?.split(" ")[0],
      lastName: params.payerName?.split(" ").slice(1).join(" ") || undefined,
    },
    payment: { type: "bank_transfer", paymentMethodId: "pix" },
  });

  const pay = order.transactions?.payments?.[0];
  const payment = await prisma.agendaPayment.upsert({
    where: { bookingId: params.bookingId },
    create: {
      bookingId: params.bookingId,
      method: "PIX",
      status: order.status === "processed" ? "PAID" : "PENDING",
      amountCents: params.amountCents,
      provider: "MERCADO_PAGO",
      externalId: String(pay?.id || order.id),
      idempotencyKey,
      pixQrCode: pay?.payment_method?.qr_code ?? null,
      pixQrCodeBase64: pay?.payment_method?.qr_code_base64 ?? null,
      rawResponse: order as object,
      paidAt: order.status === "processed" ? new Date() : null,
    },
    update: {
      status: order.status === "processed" ? "PAID" : "PENDING",
      externalId: String(pay?.id || order.id),
      pixQrCode: pay?.payment_method?.qr_code ?? null,
      pixQrCodeBase64: pay?.payment_method?.qr_code_base64 ?? null,
      rawResponse: order as object,
      paidAt: order.status === "processed" ? new Date() : null,
    },
  });

  if (payment.status === "PAID") {
    await prisma.agendaBooking.update({
      where: { id: params.bookingId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        holdExpiresAt: null,
      },
    });
    await prisma.agendaSlotHold.deleteMany({
      where: { bookingId: params.bookingId },
    });
  }

  return { status: payment.status as "PAID" | "PENDING", payment, order };
}

/** Cria (ou reutiliza) pagamento PIX para um agendamento pendente. */
export async function createBookingPayment(bookingId: string) {
  const booking = await prisma.agendaBooking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  if (!booking) throw new Error("Agendamento não encontrado");

  const amountCents = booking.amountCents || booking.service.priceCents;
  if (amountCents <= 0) {
    await confirmBookingPaid(bookingId);
    return { status: "PAID" as const, payment: null };
  }

  const email = booking.customerEmail || "cliente@agenda.local";
  return createBookingPixPayment({
    workspaceId: booking.clienteId,
    bookingId: booking.id,
    amountCents,
    description: booking.service.title,
    payerEmail: email,
    payerName: booking.customerName,
  });
}

export async function confirmBookingPaid(bookingId: string) {
  const booking = await prisma.agendaBooking.update({
    where: { id: bookingId },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      holdExpiresAt: null,
    },
  });
  await prisma.agendaSlotHold.deleteMany({ where: { bookingId } });
  await prisma.agendaPayment.updateMany({
    where: { bookingId },
    data: { status: "PAID", paidAt: new Date() },
  });
  return booking;
}
