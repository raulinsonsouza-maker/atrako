import { prisma } from "@/lib/prisma";
import { sendCheckoutConfirmation, sendIntakeAlertToTeam } from "@/lib/email";
import { parseIntakeData } from "@/lib/intake/validation/company-opening-br";

export async function confirmCheckoutOrder(orderId: string) {
  const existing = await prisma.checkoutOrder.findUnique({
    where: { id: orderId },
    include: {
      product: { include: { organization: true } },
      checkoutLink: true,
      payment: true,
      intakeSubmission: true,
    },
  });

  if (!existing) {
    throw new Error("Pedido não encontrado");
  }

  if (existing.status === "PAID") {
    return existing;
  }

  const now = new Date();
  const order = await prisma.checkoutOrder.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      paidAt: now,
      confirmedAt: now,
      holdExpiresAt: null,
    },
    include: {
      product: { include: { organization: true } },
      checkoutLink: true,
      payment: true,
      intakeSubmission: true,
    },
  });

  if (order.payment && order.payment.status !== "PAID") {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { status: "PAID", paidAt: now },
    });
  }

  if (order.intakeSubmission) {
    await prisma.intakeSubmission.update({
      where: { id: order.intakeSubmission.id },
      data: { status: "PAID" },
    });
  }

  await sendCheckoutConfirmation({
    to: order.customerEmail,
    customerName: order.customerName,
    productTitle: order.product.title,
    linkTitle: order.checkoutLink.title || order.product.title,
    priceCents: order.product.priceCents,
    orderId: order.id,
    intakeDocuments: Boolean(order.intakeSubmission),
  });

  if (order.intakeSubmission && order.product.productKind === "INTAKE") {
    const data = parseIntakeData(order.intakeSubmission.data);
    await sendIntakeAlertToTeam({
      submissionId: order.intakeSubmission.id,
      productTitle: order.product.title,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      priceCents: order.product.priceCents,
      partnerCount: data?.partners.length ?? 0,
      tradeName: data?.tradeName,
      paidAt: now,
      organizationId: order.product.organizationId,
      productNotifyEmails: order.product.notifyEmails,
      productAlertsEnabled: order.product.intakeEmailAlerts,
      orgNotifyEmails: order.product.organization.intakeNotifyEmails,
      orgAlertsEnabled: order.product.organization.intakeEmailAlerts,
    });
  }

  return order;
}

export async function markCheckoutPaymentPaidAndConfirm(orderId: string, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      checkoutOrder: {
        include: { product: true, checkoutLink: true },
      },
    },
  });

  if (!payment || payment.checkoutOrderId !== orderId) return null;
  if (payment.checkoutOrder?.status === "PAID") {
    if (payment.status !== "PAID") {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
    return payment.checkoutOrder;
  }

  const order = await confirmCheckoutOrder(orderId);

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  return order;
}
