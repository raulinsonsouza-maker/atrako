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

    const okSig = await verifyMpWebhookSignature({
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

    const hintedStatus = String(
      (body as { data?: { status?: string }; status?: string })?.data?.status ||
        (body as { status?: string })?.status ||
        "",
    );

    const refParam = request.nextUrl.searchParams.get("ref")?.trim() || "";
    const leadRef = refParam.startsWith("lead:") ? refParam : externalRef;
    if (leadRef.startsWith("lead:")) {
      const { applyLeadPaymentWebhook } = await import("@/lib/attendance/payment");
      await applyLeadPaymentWebhook({
        leadId: leadRef.slice("lead:".length),
        paymentId: dataId,
        hintedStatus,
      });
      return NextResponse.json({ ok: true, lead: true });
    }

    if (externalRef.startsWith("food:")) {
      const { applyFoodPaymentWebhook } = await import("@/lib/food/orders");
      await applyFoodPaymentWebhook({
        orderId: externalRef.slice("food:".length),
        mpOrderId: dataId || null,
        hintedStatus,
      });
      return NextResponse.json({ ok: true, food: true });
    }

    if (externalRef.startsWith("stay:")) {
      const { applyStayPaymentWebhook } = await import("@/lib/stay/reservations");
      await applyStayPaymentWebhook({
        reservationId: externalRef.slice("stay:".length),
        mpOrderId: dataId || null,
        hintedStatus,
      });
      return NextResponse.json({ ok: true, stay: true });
    }

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

    if (!order && dataId) {
      const stay = await prisma.stayReservation.findFirst({ where: { mpOrderId: dataId }, select: { id: true } });
      if (stay) {
        const { applyStayPaymentWebhook } = await import("@/lib/stay/reservations");
        await applyStayPaymentWebhook({ reservationId: stay.id, mpOrderId: dataId, hintedStatus });
        return NextResponse.json({ ok: true, stay: true });
      }
      const food = await prisma.foodOrder.findFirst({ where: { mpOrderId: dataId }, select: { id: true } });
      if (food) {
        const { applyFoodPaymentWebhook } = await import("@/lib/food/orders");
        await applyFoodPaymentWebhook({ orderId: food.id, mpOrderId: dataId, hintedStatus });
        return NextResponse.json({ ok: true, food: true });
      }
    }

    if (!order && externalRef) {
      const agendaOrder = await prisma.agendaCheckoutOrder.findUnique({
        where: { id: externalRef },
        include: { checkoutLink: true, product: true },
      });
      if (agendaOrder) {
        let status = hintedStatus;
        if (dataId) {
          try {
            const mp = await getMercadoPagoOrder(agendaOrder.product.clienteId, dataId);
            status = String(mp?.status || status);
          } catch {
            /* keep body status */
          }
        }
        if (isPaid(status) && agendaOrder.status !== "CONFIRMED") {
          await prisma.agendaCheckoutOrder.update({
            where: { id: agendaOrder.id },
            data: { status: "CONFIRMED", paidAt: new Date(), confirmedAt: new Date() },
          });
          const { closeLeadMatchingCheckout } = await import("@/lib/attendance/payment");
          await closeLeadMatchingCheckout({
            workspaceId: agendaOrder.product.clienteId,
            phone: agendaOrder.customerPhone,
            kind: "agenda",
            ref: agendaOrder.checkoutLink.slug,
            amount: agendaOrder.product.priceCents / 100,
          });
        }
        return NextResponse.json({ ok: true, agendaCheckout: true });
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
      if (order.storeId && order.fulfillmentStatus === "NEW") {
        await prisma.commerceOrder.update({
          where: { id: order.id },
          data: { fulfillmentStatus: "CONFIRMED" },
        });
      }
    } else if (isCancelled(status)) {
      const wasPending = order.status === "PENDING";
      await prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: status.toLowerCase().includes("refund") ? "REFUNDED" : "CANCELLED",
          fulfillmentStatus: "CANCELLED",
        },
      });
      await revokeEntitlementsForOrder(order.id);
      // Devolve estoque se ainda não havia sido pago (reserva na criação da loja).
      if (order.storeId && wasPending) {
        const items = await prisma.commerceOrderItem.findMany({ where: { orderId: order.id } });
        for (const item of items) {
          if (!item.variantId) continue;
          await prisma.commerceVariant.updateMany({
            where: { id: item.variantId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("commerce webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
