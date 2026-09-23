import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { uniqueBookingPageSlug } from "@/lib/booking-page-slug";
import { DEFAULT_TIMEZONE } from "@/lib/utils";
import { apiRequireAdmin } from "@/lib/rbac";

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  accentColor: z.string().optional(),
  websiteUrl: z.string().optional(),
  instagram: z.string().optional(),
});

export async function GET() {
  const auth = await apiRequireAdmin();
  if ("error" in auth) return auth.error;

  const orgId = auth.ctx.organizationId;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { businessMode: true },
  });
  const isSalon = org?.businessMode === "SALON";

  const [pages, teamHoursReady, activeProfessionalCount] = await Promise.all([
    prisma.bookingPage.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      include: {
        _count: {
          select: { bookings: true, availability: true },
        },
        pageServices: {
          where: { service: { isActive: true } },
          select: { serviceId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    isSalon
      ? prisma.professional.count({
          where: {
            organizationId: orgId,
            isActive: true,
            availability: { some: {} },
          },
        }).then((n) => n > 0)
      : Promise.resolve(false),
    isSalon
      ? prisma.professional.count({
          where: { organizationId: orgId, isActive: true },
        })
      : Promise.resolve(0),
  ]);

  return NextResponse.json(
    pages.map(({ pageServices, ...p }) => ({
      ...p,
      activeServiceCount: pageServices.length,
      teamHoursReady,
      activeProfessionalCount,
    })),
  );
}

export async function POST(req: Request) {
  const auth = await apiRequireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const body = schema.parse(await req.json());
    const org = await prisma.organization.findUnique({
      where: { id: auth.ctx.organizationId },
      select: { timezone: true },
    });
    const slug = await uniqueBookingPageSlug(
      auth.ctx.organizationId,
      body.title,
    );

    const page = await prisma.bookingPage.create({
      data: {
        organizationId: auth.ctx.organizationId,
        title: body.title,
        slug,
        description: body.description,
        accentColor: body.accentColor || "#0a0a0a",
        websiteUrl: body.websiteUrl,
        instagram: body.instagram,
        timezone: org?.timezone || DEFAULT_TIMEZONE,
      },
    });
    return NextResponse.json(page);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar agenda" }, { status: 500 });
  }
}