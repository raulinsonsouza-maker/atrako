import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { ensureDefaultBookingPage, uniquePageSlug } from "@/lib/agenda/pages";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await ensureDefaultBookingPage(workspaceId);

  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { businessMode: true },
  });
  const isSalon = settings?.businessMode === "SALON";

  const [pages, teamHoursReady, activeProfessionalCount] = await Promise.all([
    prisma.agendaBookingPage.findMany({
      where: { clienteId: workspaceId, active: true },
      include: {
        _count: { select: { bookings: true, availability: true } },
        pageServices: {
          where: { service: { active: true } },
          select: { serviceId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    isSalon
      ? prisma.agendaProfessional
          .count({
            where: {
              clienteId: workspaceId,
              isActive: true,
              availability: { some: {} },
            },
          })
          .then((n) => n > 0)
      : Promise.resolve(false),
    isSalon
      ? prisma.agendaProfessional.count({
          where: { clienteId: workspaceId, isActive: true },
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

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().optional(),
  accentColor: z.string().optional(),
  websiteUrl: z.string().optional(),
  instagram: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = createSchema.parse(await request.json());
    const access = await requireWorkspaceAccess(body.workspaceId, "operate");
    if (!access.ok) return access.response;
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const settings = await prisma.workspaceSettings.findUnique({
      where: { clienteId: body.workspaceId },
      select: { timezone: true },
    });

    let slug = uniquePageSlug(body.title);
    const clash = await prisma.agendaBookingPage.findFirst({
      where: { clienteId: body.workspaceId, slug },
    });
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const page = await prisma.agendaBookingPage.create({
      data: {
        clienteId: body.workspaceId,
        title: body.title,
        slug,
        description: body.description,
        accentColor: body.accentColor || null,
        websiteUrl: body.websiteUrl,
        instagram: body.instagram,
        timezone: settings?.timezone || "America/Sao_Paulo",
        availability: {
          create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
            dayOfWeek,
            startTime: "09:00",
            endTime: "18:00",
          })),
        },
      },
    });
    return NextResponse.json(page, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar página" }, { status: 500 });
  }
}
