import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoOrder } from "@/lib/mercadopago/orders";
import { approveOrder } from "@/lib/orders";
import { getApprovedOrderFiles } from "@/lib/order-download";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (order.status === "APPROVED") {
    const files = await getApprovedOrderFiles(order.id);
    return NextResponse.json({
      status: order.status,
      orderId: order.id,
      files: files ?? [],
    });
  }

  if (order.mpOrderId) {
    try {
      const mp = await getMercadoPagoOrder(order.mpOrderId);
      const status = String(mp.status || "").toLowerCase();
      if (["processed", "approved", "paid"].includes(status)) {
        await approveOrder(order.id, { fromPix: true });
        const files = await getApprovedOrderFiles(order.id);
        return NextResponse.json({
          status: "APPROVED",
          orderId: order.id,
          files: files ?? [],
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  return NextResponse.json({
    status: order.status,
    orderId: order.id,
    pixCopyPaste: order.pixCopyPaste,
    pixQrCodeBase64: order.pixQrCodeBase64,
  });
}
