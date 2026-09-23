import { NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { hasOnlinePayment } from "@/lib/agenda/payments";

const schema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8),
  customerCpf: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ linkSlug: string }> },
) {
  const { linkSlug } = await params;
  try {
    const body = schema.parse(await req.json());
    const link = await prisma.agendaCheckoutLink.findFirst({
      where: { slug: linkSlug, isActive: true },
      include: { product: true },
    });
    if (!link || !link.product.isActive) {
      return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
    }

    const workspaceId = link.product.clienteId;
    const priceCents = link.product.priceCents;
    const holdExpiresAt = priceCents > 0 ? addMinutes(new Date(), 15) : null;

    const order = await prisma.agendaCheckoutOrder.create({
      data: {
        checkoutLinkId: link.id,
        productId: link.product.id,
        status: priceCents > 0 ? "PENDING_PAYMENT" : "CONFIRMED",
        customerName: body.customerName.trim(),
        customerEmail: body.customerEmail.toLowerCase().trim(),
        customerPhone: body.customerPhone.replace(/\D/g, ""),
        customerCpf: body.customerCpf?.replace(/\D/g, "") || null,
        holdExpiresAt,
        paidAt: priceCents <= 0 ? new Date() : null,
        confirmedAt: priceCents <= 0 ? new Date() : null,
      },
    });

    if (priceCents <= 0) {
      return NextResponse.json({ ok: true, orderId: order.id, status: "CONFIRMED" });
    }

    const online = await hasOnlinePayment(workspaceId);
    if (!online) {
      await prisma.agendaPayment.create({
        data: {
          checkoutOrderId: order.id,
          method: "MANUAL",
          status: "PENDING",
          amountCents: priceCents,
          provider: "MANUAL",
          idempotencyKey: `checkout-manual-${order.id}`,
        },
      });
      await prisma.agendaCheckoutOrder.update({
        where: { id: order.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        orderId: order.id,
        status: "CONFIRMED",
        instructions:
          "Pagamento online não configurado. Entraremos em contato para concluir o pagamento.",
      });
    }

    const idempotencyKey = `checkout-${order.id}-${randomUUID()}`;
    const amount = priceCents / 100;
    const { createMercadoPagoOrder } = await import("@/lib/commerce/mp");
    const mpOrder = await createMercadoPagoOrder({
      workspaceId,
      externalReference: order.id,
      amount,
      description: link.product.title,
      payer: {
        email: body.customerEmail,
        firstName: body.customerName.split(" ")[0],
        lastName: body.customerName.split(" ").slice(1).join(" ") || undefined,
      },
      payment: { type: "bank_transfer", paymentMethodId: "pix" },
    });

    const pay = mpOrder.transactions?.payments?.[0];
    const paid = mpOrder.status === "processed";
    const payment = await prisma.agendaPayment.create({
      data: {
        checkoutOrderId: order.id,
        method: "PIX",
        status: paid ? "PAID" : "PENDING",
        amountCents: priceCents,
        provider: "MERCADO_PAGO",
        externalId: String(pay?.id || mpOrder.id),
        idempotencyKey,
        pixQrCode: pay?.payment_method?.qr_code ?? null,
        pixQrCodeBase64: pay?.payment_method?.qr_code_base64 ?? null,
        rawResponse: mpOrder as object,
        paidAt: paid ? new Date() : null,
      },
    });

    if (paid) {
      await prisma.agendaCheckoutOrder.update({
        where: { id: order.id },
        data: { status: "CONFIRMED", paidAt: new Date(), confirmedAt: new Date() },
      });
      return NextResponse.json({ ok: true, orderId: order.id, status: "CONFIRMED" });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      status: "PENDING",
      paymentId: payment.id,
      qrCode: payment.pixQrCode,
      qrCodeBase64: payment.pixQrCodeBase64,
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
