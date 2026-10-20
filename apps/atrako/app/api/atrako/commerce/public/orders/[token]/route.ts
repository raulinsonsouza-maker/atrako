import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await prisma.commerceOrder.findUnique({
    where: { publicToken: token },
    include: { items: true, store: { select: { slug: true, name: true } } },
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      fulfillment: order.fulfillment,
      totalCents: order.totalCents,
      subtotalCents: order.subtotalCents,
      shippingFeeCents: order.shippingFeeCents,
      discountCents: order.discountCents,
      pixQrCode: order.pixQrCode,
      pixQrCodeBase64: order.pixQrCodeBase64,
      pixCopyPaste: order.pixCopyPaste,
      items: order.items,
      store: order.store,
    },
  });
}
