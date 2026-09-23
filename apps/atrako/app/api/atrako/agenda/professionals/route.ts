import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const pros = await prisma.agendaProfessional.findMany({
    where: { clienteId: workspaceId },
    include: {
      services: { select: { serviceId: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    pros.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      phone: p.phone,
      photoUrl: p.photoUrl,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      serviceIds: p.services.map((s) => s.serviceId),
      bookingsCount: p._count.bookings,
      commissionEnabled: p.commissionEnabled,
      commissionPercent: p.commissionPercent,
      workspaceMemberId: p.workspaceMemberId,
    })),
  );
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  displayName: z.string().min(2),
  phone: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  serviceIds: z.array(z.string()).optional(),
  copyHoursFromPageId: z.string().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionPercent: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = createSchema.parse(await request.json());
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const settings = await prisma.workspaceSettings.findUnique({
      where: { clienteId: body.workspaceId },
      select: { businessMode: true },
    });
    if (settings?.businessMode !== "SALON") {
      return NextResponse.json(
        { error: "Ative o modo equipe em Config → Empresa" },
        { status: 400 },
      );
    }

    if (body.serviceIds?.length) {
      const valid = await prisma.agendaService.count({
        where: {
          id: { in: body.serviceIds },
          clienteId: body.workspaceId,
        },
      });
      if (valid !== body.serviceIds.length) {
        return NextResponse.json({ error: "Serviço inválido" }, { status: 400 });
      }
    }

    const maxOrder = await prisma.agendaProfessional.aggregate({
      where: { clienteId: body.workspaceId },
      _max: { sortOrder: true },
    });

    const professional = await prisma.$transaction(async (tx) => {
      const pro = await tx.agendaProfessional.create({
        data: {
          clienteId: body.workspaceId,
          displayName: body.displayName,
          phone: body.phone || null,
          photoUrl: body.photoUrl || null,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
          commissionEnabled: Boolean(body.commissionEnabled),
          commissionPercent: body.commissionPercent ?? 50,
          services: body.serviceIds?.length
            ? {
                create: body.serviceIds.map((serviceId) => ({ serviceId })),
              }
            : undefined,
        },
      });

      const pageId =
        body.copyHoursFromPageId ||
        (
          await tx.agendaBookingPage.findFirst({
            where: { clienteId: body.workspaceId, isDefault: true },
          })
        )?.id;

      if (pageId) {
        const rules = await tx.agendaAvailabilityRule.findMany({
          where: { bookingPageId: pageId, professionalId: null },
        });
        if (rules.length) {
          await tx.agendaAvailabilityRule.createMany({
            data: rules.map((r) => ({
              professionalId: pro.id,
              dayOfWeek: r.dayOfWeek,
              startTime: r.startTime,
              endTime: r.endTime,
            })),
          });
        }
      }

      return pro;
    });

    return NextResponse.json({ id: professional.id }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar profissional" }, { status: 500 });
  }
}
