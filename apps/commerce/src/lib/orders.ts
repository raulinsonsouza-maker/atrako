import { prisma } from "@/lib/prisma";
import { grantEntitlementsForOrder } from "@/lib/entitlements";
import { sendMetaCapiEvent } from "@/lib/meta";
import { absoluteUrl } from "@/lib/utils";
import { publishCheckoutEvent } from "@/lib/atrako-bridge";
import { getAtrakoWorkspaceId } from "@/lib/atrako-connections";

export async function approveOrder(orderId: string, _opts?: { fromPix?: boolean }) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!existing) throw new Error("Pedido não encontrado");

  // Idempotente: não reenvia CAPI / e-mail se já aprovado
  if (existing.status === "APPROVED") {
    return existing;
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: "APPROVED", approvedAt: new Date() },
    include: { items: true },
  });

  await grantEntitlementsForOrder(order.id);

  const workspaceId = getAtrakoWorkspaceId();
  if (workspaceId) {
    void publishCheckoutEvent({
      name: "payment.paid",
      workspaceId,
      orderId: order.id,
      paymentId: order.mpOrderId ?? undefined,
      payload: {
        amount: order.totalCents / 100,
        currency: "BRL",
        email: order.email,
        name: order.name,
        provider: "MERCADO_PAGO",
        description: `Pedido ${order.id}`,
      },
    }).catch((err) => console.error("[atrako] payment.paid", err));

    void publishCheckoutEvent({
      name: "order.completed",
      workspaceId,
      orderId: order.id,
      payload: {
        amount: order.totalCents / 100,
        email: order.email,
        name: order.name,
        provider: "MERCADO_PAGO",
      },
    }).catch((err) => console.error("[atrako] order.completed", err));

    void publishCheckoutEvent({
      name: "lead.created",
      workspaceId,
      orderId: order.id,
      payload: {
        nome: order.name,
        email: order.email,
        telefone: order.phone,
        fonte: "commerce",
        valor: order.totalCents / 100,
      },
    }).catch(() => null);
  }

  if (order.eventId) {
    const primaryProductId = order.items[0]?.productId;
    const contents = order.items.map((i) => ({
      id: i.productId,
      quantity: i.quantity,
      item_price: i.priceCents / 100,
    }));
    await sendMetaCapiEvent({
      eventName: "Purchase",
      eventId: order.eventId,
      email: order.email,
      phone: order.phone ?? undefined,
      name: order.name ?? undefined,
      externalId: order.cpf ?? undefined,
      value: order.totalCents / 100,
      currency: "BRL",
      contentIds: order.items.map((i) => i.productId),
      contentName: order.items.map((i) => i.name).join(" + "),
      contents,
      numItems: order.items.reduce((n, i) => n + i.quantity, 0),
      productId: primaryProductId,
      fbp: order.fbp,
      fbc: order.fbc,
      eventSourceUrl: absoluteUrl(`/obrigado?orderId=${order.id}`),
    });
  }

  if (order.couponId) {
    await prisma.coupon.update({
      where: { id: order.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  return order;
}
