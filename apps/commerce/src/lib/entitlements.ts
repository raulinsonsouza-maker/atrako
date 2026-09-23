import { prisma } from "@/lib/prisma";
import { sendPurchaseDeliveryEmail } from "@/lib/email/templates/purchase-delivery";

export async function sendOrderDeliveryEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              files: { orderBy: { createdAt: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const primary = order.items[0];
  if (!primary) return null;

  return sendPurchaseDeliveryEmail({
    to: order.email,
    name: order.name || "Cliente",
    orderId: order.id,
    product: {
      name: primary.product?.name ?? primary.name,
      slug: primary.product?.slug,
      fileId: primary.product?.files[0]?.id ?? null,
    },
  });
}

export async function grantEntitlementsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "APPROVED") return null;

  let user = order.userId
    ? await prisma.user.findUnique({ where: { id: order.userId } })
    : await prisma.user.findUnique({ where: { email: order.email.toLowerCase() } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: order.email.toLowerCase(),
        name: order.name,
        phone: order.phone,
        role: "BUYER",
      },
    });
  }

  if (!order.userId) {
    await prisma.order.update({ where: { id: order.id }, data: { userId: user.id } });
  }

  for (const item of order.items) {
    await prisma.entitlement.upsert({
      where: { userId_productId: { userId: user.id, productId: item.productId } },
      update: { revokedAt: null, orderId: order.id },
      create: { userId: user.id, productId: item.productId, orderId: order.id },
    });
  }

  try {
    await sendOrderDeliveryEmail(order.id);
  } catch (err) {
    // Não bloqueia a liberação do download se o e-mail falhar
    console.error("[email:delivery] failed for order", order.id, err);
  }

  return user;
}

export async function revokeEntitlementsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order?.userId) return;
  for (const item of order.items) {
    await prisma.entitlement.updateMany({
      where: { userId: order.userId, productId: item.productId },
      data: { revokedAt: new Date() },
    });
  }
}

export async function userHasProductAccess(userId: string, productId: string) {
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  return Boolean(entitlement && !entitlement.revokedAt);
}
