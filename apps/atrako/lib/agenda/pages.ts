import { prisma } from "@/lib/db";
import { slugify } from "@/lib/criar/slug";

const DEFAULT_HOURS = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
] as const;

/** Garante página default + horários básicas para o workspace. */
export async function ensureDefaultBookingPage(clienteId: string) {
  const existing = await prisma.agendaBookingPage.findFirst({
    where: { clienteId, isDefault: true },
  });
  if (existing) return existing;

  const bySlug = await prisma.agendaBookingPage.findFirst({
    where: { clienteId, slug: "agenda" },
  });
  if (bySlug) {
    return prisma.agendaBookingPage.update({
      where: { id: bySlug.id },
      data: { isDefault: true },
    });
  }

  const page = await prisma.agendaBookingPage.create({
    data: {
      clienteId,
      title: "Agenda",
      slug: "agenda",
      isDefault: true,
      active: true,
      availability: {
        create: DEFAULT_HOURS.map((h) => ({ ...h })),
      },
    },
  });

  const services = await prisma.agendaService.findMany({
    where: { clienteId, active: true },
    select: { id: true, sortOrder: true },
  });
  if (services.length) {
    await prisma.agendaBookingPageService.createMany({
      data: services.map((s) => ({
        bookingPageId: page.id,
        serviceId: s.id,
        sortOrder: s.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  return page;
}

export async function attachServiceToDefaultPage(
  clienteId: string,
  serviceId: string,
) {
  const page = await ensureDefaultBookingPage(clienteId);
  await prisma.agendaBookingPageService.upsert({
    where: {
      bookingPageId_serviceId: {
        bookingPageId: page.id,
        serviceId,
      },
    },
    create: { bookingPageId: page.id, serviceId, sortOrder: 0 },
    update: {},
  });
  return page;
}

export function uniquePageSlug(title: string, fallback = "agenda") {
  const base = slugify(title || fallback) || fallback;
  return base.slice(0, 100);
}

export async function uniqueBookingPageSlug(
  clienteId: string,
  title: string,
  excludeId?: string,
) {
  let base = uniquePageSlug(title);
  let slug = base;
  let n = 0;
  for (;;) {
    const existing = await prisma.agendaBookingPage.findFirst({
      where: {
        clienteId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`.slice(0, 120);
  }
}
