import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";
import { sendOrderDeliveryEmail } from "@/lib/entitlements";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  await sendOrderDeliveryEmail(order.id);

  return NextResponse.json({ ok: true });
}
