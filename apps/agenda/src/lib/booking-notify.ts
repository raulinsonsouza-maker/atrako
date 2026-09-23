import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/email/templates/layout";

export function newManageToken() {
  return randomBytes(24).toString("hex");
}

export function manageBookingUrl(token: string) {
  return appUrl(`/m/${token}`);
}

export function bookingPaymentUrl(
  orgSlug: string,
  pageSlug: string,
  manageToken: string,
) {
  const path = `/p/${orgSlug}/${pageSlug}?resume=${encodeURIComponent(manageToken)}`;
  return appUrl(path);
}

export async function ensureManageToken(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { manageToken: true },
  });
  if (!booking) return null;
  if (booking.manageToken) return booking.manageToken;
  const token = newManageToken();
  await prisma.booking.update({
    where: { id: bookingId },
    data: { manageToken: token },
  });
  return token;
}

export async function getOwnerNotifyEmail(organizationId: string) {
  const owner = await prisma.membership.findFirst({
    where: { organizationId, role: "OWNER" },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (owner?.user.email) {
    return { email: owner.user.email, name: owner.user.name };
  }
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { googleEmail: true, name: true },
  });
  if (org?.googleEmail) {
    return { email: org.googleEmail, name: org.name };
  }
  return null;
}
