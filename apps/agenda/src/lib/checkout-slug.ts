import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function uniqueCheckoutLinkSlug(title: string, excludeId?: string) {
  let slug = slugify(title);
  if (!slug) slug = `checkout-${Date.now().toString(36)}`;

  const taken = await prisma.checkoutLink.findFirst({
    where: {
      slug,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  if (taken) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
}

/** Garante um link de checkout por produto (1 produto = 1 URL). */
export async function ensureProductCheckoutLink(productId: string, title: string) {
  const existing = await prisma.checkoutLink.findFirst({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const slug = await uniqueCheckoutLinkSlug(title);
  return prisma.checkoutLink.create({
    data: {
      productId,
      slug,
      isActive: true,
    },
  });
}
