import { prisma } from "@/lib/prisma";

export async function validateCoupon(code: string, productId: string, subtotalCents: number) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: true },
  });
  if (!coupon || !coupon.active) return { ok: false as const, error: "Cupom inválido" };
  if (coupon.endsAt && coupon.endsAt < new Date()) {
    return { ok: false as const, error: "Cupom expirado" };
  }
  if (coupon.startsAt && coupon.startsAt > new Date()) {
    return { ok: false as const, error: "Cupom ainda não válido" };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false as const, error: "Cupom esgotado" };
  }
  if (coupon.products.length > 0 && !coupon.products.some((p) => p.productId === productId)) {
    return { ok: false as const, error: "Cupom não válido para este produto" };
  }

  const discountCents =
    coupon.type === "PERCENT"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(subtotalCents, coupon.value);

  return { ok: true as const, coupon, discountCents };
}
