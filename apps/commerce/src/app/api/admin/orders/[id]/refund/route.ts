import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";
import { revokeEntitlementsForOrder } from "@/lib/entitlements";
import { refundMercadoPagoOrder } from "@/lib/mercadopago/orders";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Só é possível reembolsar pedidos aprovados." },
      { status: 400 },
    );
  }

  if (order.mpOrderId) {
    try {
      await refundMercadoPagoOrder(order.mpOrderId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha no reembolso MP";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  await prisma.order.update({
    where: { id },
    data: { status: "REFUNDED" },
  });
  await revokeEntitlementsForOrder(id);

  return NextResponse.json({ ok: true });
}
