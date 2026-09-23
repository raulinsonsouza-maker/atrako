import { prisma } from "@/lib/prisma";

const orgSelect = {
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  accentColor: true,
  businessMode: true,
  caktoSdkClientId: true,
  caktoClientId: true,
  caktoClientSecret: true,
  caktoOfferId: true,
  paymentProvider: true,
  mercadoPagoAccessToken: true,
  mercadoPagoPublicKey: true,
  cardMaxInstallments: true,
  asaasApiKey: true,
} as const;

export async function findPublicBookingPage(orgSlug: string, pageSlug: string) {
  return prisma.bookingPage.findFirst({
    where: {
      slug: pageSlug,
      isActive: true,
      organization: { slug: orgSlug },
    },
    include: {
      services: {
        where: { isActive: true },
        include: {
          customFields: { orderBy: { sortOrder: "asc" } },
          intakeProduct: {
            include: {
              checkoutLinks: {
                where: { isActive: true },
                take: 1,
                orderBy: { createdAt: "asc" },
                select: { slug: true },
              },
            },
          },
          professionals: {
            where: { professional: { isActive: true } },
            include: {
              professional: {
                select: {
                  id: true,
                  displayName: true,
                  photoUrl: true,
                  sortOrder: true,
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      organization: { select: orgSelect },
    },
  });
}

/** Links antigos /p/{slug} — só funciona se o slug ainda for único no sistema. */
export async function findPublicBookingPageByLegacySlug(pageSlug: string) {
  const matches = await prisma.bookingPage.findMany({
    where: { slug: pageSlug, isActive: true },
    include: {
      organization: { select: { slug: true } },
    },
    take: 2,
  });
  if (matches.length !== 1) return null;
  return matches[0];
}

export function professionalsForService(
  service: {
    professionals: {
      professional: {
        id: string;
        displayName: string;
        photoUrl: string | null;
        sortOrder: number;
        isActive: boolean;
      };
    }[];
  },
) {
  return service.professionals
    .map((ps) => ps.professional)
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
}
