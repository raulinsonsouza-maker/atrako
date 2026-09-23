import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const booking = await prisma.agendaBooking.findFirst({
    where: { manageToken: token },
    include: {
      service: true,
      professional: { select: { displayName: true } },
      bookingPage: { select: { title: true, slug: true } },
      payment: true,
      cliente: { select: { nome: true, slug: true } },
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    id: booking.id,
    status: booking.status,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    timezone: booking.timezone,
    customerName: booking.customerName,
    serviceTitle: booking.service.title,
    professionalName: booking.professional?.displayName ?? null,
    amountCents: booking.amountCents,
    paymentStatus: booking.payment?.status ?? null,
    workspaceName: booking.cliente.nome,
    workspaceSlug: booking.cliente.slug,
    pageSlug: booking.bookingPage?.slug,
  });
}

const cancelSchema = z.object({ action: z.literal("cancel") });

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  try {
    cancelSchema.parse(await req.json());
    const booking = await prisma.agendaBooking.findFirst({
      where: { manageToken: token },
    });
    if (!booking) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json(booking);
    }

    const updated = await prisma.agendaBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await prisma.agendaSlotHold.deleteMany({
      where: { bookingId: booking.id },
    });

    try {
      const { deleteGoogleEventForBooking } = await import(
        "@/lib/agenda/google-calendar"
      );
      await deleteGoogleEventForBooking(updated);
    } catch {
      /* optional */
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Erro" }, { status: 400 });
  }
}
