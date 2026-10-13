import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { createStayReservation, type StayPaymentInput } from "@/lib/stay/reservations";

function readPayment(value: unknown): StayPaymentInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const payment = value as Record<string, unknown>;
  const cpf = typeof payment.cpf === "string" ? payment.cpf : undefined;
  if (payment.method === "card") {
    return {
      method: "card",
      token: String(payment.token ?? ""),
      paymentMethodId: String(payment.paymentMethodId ?? ""),
      installments: Number(payment.installments ?? 1),
      cpf,
    };
  }
  if (payment.method === "pix") return { method: "pix", cpf };
  return undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const property = await prisma.stayProperty.findUnique({ where: { slug } });
  if (!property || !property.published) {
    return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(property.clienteId, "hospedagem"))) {
    return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const created = await createStayReservation({
    property,
    checkIn: String(body.checkIn ?? ""),
    checkOut: String(body.checkOut ?? ""),
    guestName: String(body.guestName ?? ""),
    guestEmail: typeof body.guestEmail === "string" ? body.guestEmail : null,
    guestPhone: String(body.guestPhone ?? ""),
    guests: Number(body.guests ?? 1),
    clientRequestId: String(body.clientRequestId ?? ""),
    birthDate: typeof body.birthDate === "string" ? body.birthDate : null,
    payment: readPayment(body.payment),
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  return NextResponse.json(created);
}
