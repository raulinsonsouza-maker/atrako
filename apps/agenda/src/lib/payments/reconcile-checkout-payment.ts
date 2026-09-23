import { prisma } from "@/lib/prisma";
import { markCheckoutPaymentPaidAndConfirm } from "@/lib/payments/confirm-checkout-order";
import { isRemotePaymentPaid } from "@/lib/payments/is-remote-payment-paid";

/**
 * Se o webhook atrasar, consulta o provedor e confirma o pedido de checkout.
 */
export async function reconcileCheckoutPaymentIfNeeded(orderId: string) {
  const order = await prisma.checkoutOrder.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      product: { include: { organization: true } },
    },
  });
  if (!order) return null;
  if (order.status === "PAID") return order;
  if (order.status !== "PENDING_PAYMENT" || !order.payment) return order;

  if (order.payment.status === "PAID") {
    await markCheckoutPaymentPaidAndConfirm(order.id, order.payment.id);
    return reloadOrder(orderId);
  }

  const providerPaymentId = order.payment.caktoPaymentId;
  if (!providerPaymentId || providerPaymentId.startsWith("demo_")) {
    return order;
  }

  const org = order.product.organization;

  try {
    const paid = await isRemotePaymentPaid({
      provider: order.payment.provider,
      providerPaymentId,
      org,
    });
    if (!paid) return order;
    await markCheckoutPaymentPaidAndConfirm(order.id, order.payment.id);
  } catch (e) {
    console.warn("[reconcile-checkout] provider check failed", orderId, e);
    return order;
  }

  return reloadOrder(orderId);
}

function reloadOrder(orderId: string) {
  return prisma.checkoutOrder.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      product: true,
    },
  });
}
