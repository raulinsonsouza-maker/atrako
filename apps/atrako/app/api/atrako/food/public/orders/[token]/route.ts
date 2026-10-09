import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicOrderView } from "@/lib/food/orders";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await prisma.foodOrder.findUnique({
    where: { publicToken: token },
    include: {
      items: true,
      store: { select: { name: true, slug: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({
    store: order.store,
    order: publicOrderView(order),
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      priceCents: item.priceCents,
      removals: item.removals,
      notes: item.notes,
    })),
    fulfillment: order.fulfillment,
    address: order.fulfillment === "DELIVERY" ? order.address : null,
  });
}
