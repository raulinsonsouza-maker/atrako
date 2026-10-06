import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";

/** Página pública de agendamento; `null` também quando o módulo Agenda está desligado. */
export async function findPublicBookingPage(
  workspaceSlug: string,
  pageSlug: string,
) {
  const page = await loadPublicBookingPage(workspaceSlug, pageSlug);
  if (!page) return null;
  if (!(await isPublicModuleEnabled(page.cliente.id, "agenda"))) return null;
  return page;
}

function loadPublicBookingPage(workspaceSlug: string, pageSlug: string) {
  return prisma.agendaBookingPage.findFirst({
    where: {
      slug: pageSlug,
      active: true,
      cliente: { slug: workspaceSlug, ativo: true },
    },
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          slug: true,
          logoUrl: true,
          workspaceSettings: {
            select: {
              timezone: true,
              primaryColor: true,
              currency: true,
              businessMode: true,
              tracking: true,
            },
          },
        },
      },
      pageServices: {
        orderBy: { sortOrder: "asc" },
        include: {
          service: {
            include: {
              customFields: { orderBy: { sortOrder: "asc" } },
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
            },
          },
        },
      },
    },
  });
}

export function professionalsForService(service: {
  professionals: Array<{
    professional: {
      id: string;
      displayName: string;
      photoUrl: string | null;
      sortOrder: number;
      isActive: boolean;
    };
  }>;
}) {
  return service.professionals
    .map((ps) => ps.professional)
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
}
