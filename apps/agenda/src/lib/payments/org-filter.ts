import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";

type PaymentTypeFilter = "booking" | "checkout" | null | undefined;

function paymentOrgFilter(
  orgId: string,
  type: PaymentTypeFilter,
  bookingPageId?: string | null,
): Prisma.PaymentWhereInput {
  if (type === "booking") {
    return {
      booking: {
        bookingPage: {
          organizationId: orgId,
          ...(bookingPageId ? { id: bookingPageId } : {}),
        },
      },
    };
  }

  if (type === "checkout") {
    return {
      checkoutOrder: {
        product: { organizationId: orgId },
      },
    };
  }

  return {
    OR: [
      {
        booking: {
          bookingPage: {
            organizationId: orgId,
            ...(bookingPageId ? { id: bookingPageId } : {}),
          },
        },
      },
      {
        checkoutOrder: {
          product: { organizationId: orgId },
        },
      },
    ],
  };
}

export function paymentPeriodFilter(
  from: string | null,
  to: string | null,
): Prisma.PaymentWhereInput | undefined {
  if (!from && !to) return undefined;

  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(`${to}T23:59:59.999Z`);

  return {
    OR: [{ paidAt: range }, { paidAt: null, createdAt: range }],
  };
}

export function buildPaymentWhere(
  orgId: string,
  filters: {
    from?: string | null;
    to?: string | null;
    status?: PaymentStatus | null;
    method?: PaymentMethod | null;
    bookingPageId?: string | null;
    type?: string | null;
    professionalId?: string | null;
  },
): Prisma.PaymentWhereInput {
  const clauses: Prisma.PaymentWhereInput[] = [
    paymentOrgFilter(
      orgId,
      filters.type === "booking" || filters.type === "checkout"
        ? filters.type
        : undefined,
      filters.bookingPageId,
    ),
  ];

  if (filters.professionalId) {
    clauses.push({
      bookingId: { not: null },
      booking: { professionalId: filters.professionalId },
    });
  }

  const period = paymentPeriodFilter(filters.from ?? null, filters.to ?? null);
  if (period) clauses.push(period);
  if (filters.status) clauses.push({ status: filters.status });
  if (filters.method) clauses.push({ method: filters.method });

  return clauses.length === 1 ? clauses[0]! : { AND: clauses };
}
