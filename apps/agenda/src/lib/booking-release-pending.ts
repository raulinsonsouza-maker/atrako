import type { Prisma } from "@prisma/client";

/** Libera reservas pendentes anteriores do mesmo cliente na mesma agenda. */
export async function releaseCustomerPendingBookings(
  tx: Prisma.TransactionClient,
  bookingPageId: string,
  customerEmail: string,
) {
  const email = customerEmail.trim().toLowerCase();
  if (!email) return;

  const pending = await tx.booking.findMany({
    where: {
      bookingPageId,
      customerEmail: email,
      status: "PENDING_PAYMENT",
    },
    select: { id: true },
  });
  if (pending.length === 0) return;

  const ids = pending.map((b) => b.id);
  await tx.booking.updateMany({
    where: { id: { in: ids } },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
  await tx.slotHold.deleteMany({ where: { bookingId: { in: ids } } });
}
