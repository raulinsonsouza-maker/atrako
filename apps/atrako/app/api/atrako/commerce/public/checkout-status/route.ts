import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { approveOrder } from "@/lib/commerce/orders";
import { getMercadoPagoOrder } from "@/lib/commerce/mp";

function isPaid(status: string) {
  const s = status.toLowerCase();
  return ["processed", "approved", "paid"].some((x) => s.includes(x));
}

/**
 * Poll público do pedido (Pix inline). Se ainda PENDING e há mpOrderId,
 * consulta o MP e aprova sem depender só do webhook.
 */
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId")?.trim() || "";
    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 });
    }

    let order = await prisma.commerceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        totalCents: true,
        clienteId: true,
        mpOrderId: true,
        pixQrCodeBase64: true,
        pixCopyPaste: true,
        pixQrCode: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    if (order.status === "PENDING" && order.mpOrderId) {
      try {
        const mp = await getMercadoPagoOrder(order.clienteId, order.mpOrderId);
        const status = String(mp?.status || "");
        if (isPaid(status)) {
          await approveOrder(order.id);
          order = {
            ...order,
            status: "APPROVED",
          };
        }
      } catch (err) {
        console.warn(
          "[checkout-status] mp sync failed",
          err instanceof Error ? err.message : err,
        );
      }
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      totalCents: order.totalCents,
      pixQrCodeBase64: order.pixQrCodeBase64,
      pixCopyPaste: order.pixCopyPaste ?? order.pixQrCode,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao consultar status" },
      { status: 500 },
    );
  }
}
