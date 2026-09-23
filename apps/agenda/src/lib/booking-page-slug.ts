import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/** Slug da agenda único dentro da organização (duas empresas podem ter "consultoria"). */
export async function uniqueBookingPageSlug(
  organizationId: string,
  title: string,
  excludeId?: string,
) {
  let slug = slugify(title);
  if (!slug) slug = `agenda-${Date.now().toString(36)}`;

  const taken = await prisma.bookingPage.findFirst({
    where: {
      organizationId,
      slug,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (taken) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
}

export function bookingPublicPath(orgSlug: string, pageSlug: string) {
  return `/p/${orgSlug}/${pageSlug}`;
}

export function bookingPublicUrl(orgSlug: string, pageSlug: string) {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://book.symbius.com.br"
  ).replace(/\/$/, "");
  return `${base}${bookingPublicPath(orgSlug, pageSlug)}`;
}
