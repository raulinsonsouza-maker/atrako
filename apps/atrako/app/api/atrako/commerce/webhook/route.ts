import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { approveOrder, revokeEntitlementsForOrder } from "@/lib/commerce/orders";
import { getMercadoPagoOrder } from "@/lib/commerce/mp";
import { verifyMpWebhookSignature } from "@/lib/integrations/mercadopago/webhooks";

function isPaid(status: string) {
  const s = status.toLowerCase();
  return ["processed", "approved", "paid"].some((x) => s.includes(x));
}

function isCancelled(status: string) {
  const s = status.toLowerCase();
  return ["refunded", "cancelled", "canceled", "chargeback"].some((x) => s.includes(x));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dataId = String(
      request.nextUrl.searchParams.get("data.id") ||
        (body as { data?: { id?: string }; id?: string })?.data?.id ||
        (body as { id?: string })?.id ||
        "",
    ).trim();

    const okSig = verifyMpWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });
    if (!okSig) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }

    const externalRef = String(
      (body as { data?: { external_reference?: string }; external_reference?: string })?.data
        ?.external_reference ||
        (body as { external_reference?: string })?.external_reference ||
        "",
    ).trim();

    let order =
      (externalRef
        ? await prisma.commerceOrder.findUnique({ where: { id: externalRef } })
        : null) ||
      (dataId
        ? await prisma.commerceOrder.findFirst({ where: { mpOrderId: dataId } })
        : null);

    // Agenda booking payment (external_reference = bookingId)
    if (!order && externalRef) {
      const booking = await prisma.agendaBooking.findUnique({
        where: { id: externalRef },
      });
      if (booking) {
        let status = String(
          (body as { data?: { status?: string }; status?: string })?.data?.status ||
            (body as { status?: string })?.status ||
            "",
        );
        if (dataId) {
          try {
            const mp = await getMercadoPagoOrder(booking.clienteId, dataId);
            status = String(mp?.status || status);
          } catch {
            /* keep body status */
          }
        }
        if (isPaid(status) && booking.status === "PENDING_PAYMENT") {
          const { confirmBookingPaid } = await import("@/lib/agenda/payments");
          await confirmBookingPaid(booking.id);
          try {
            const { syncBookingToGoogle } = await import(
              "@/lib/agenda/google-calendar"
            );
            await syncBookingToGoogle(booking.id);
          } catch {
            /* optional */
          }
        }
        return NextResponse.json({ ok: true, agenda: true });
      }
    }

    if (!order) return NextResponse.json({ ok: true, ignored: true });

    let status = "";
    const lookupId = order.mpOrderId || dataId;
    if (lookupId) {
      try {
        const mp = await getMercadoPagoOrder(order.clienteId, lookupId);
        status = String(mp?.status || "");
        if (!order.mpOrderId && mp?.id) {
          await prisma.commerceOrder.update({
            where: { id: order.id },
            data: { mpOrderId: String(mp.id) },
          });
        }
      } catch {
        status = String(
          (body as { data?: { status?: string }; status?: string })?.data?.status ||
            (body as { status?: string })?.status ||
            "",
        );
      }
    }

    if (isPaid(status)) {
      if (order.status !== "APPROVED") await approveOrder(order.id);
    } else if (isCancelled(status)) {
      await prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: status.toLowerCase().includes("refund") ? "REFUNDED" : "CANCELLED",
        },
      });
      await revokeEntitlementsForOrder(order.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("commerce webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
