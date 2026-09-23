import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  workspaceId: z.string().min(1),
  serviceIds: z.array(z.string()),
});

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = schema.parse(await request.json());
    const access = await requireWorkspaceAccess(body.workspaceId, "operate");
    if (!access.ok) return access.response;
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const page = await prisma.agendaBookingPage.findFirst({
      where: { id, clienteId: body.workspaceId },
    });
    if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (body.serviceIds.length) {
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

    await prisma.$transaction([
      prisma.agendaBookingPageService.deleteMany({
        where: { bookingPageId: id },
      }),
      prisma.agendaBookingPageService.createMany({
        data: body.serviceIds.map((serviceId, sortOrder) => ({
          bookingPageId: id,
          serviceId,
          sortOrder,
        })),
      }),
    ]);

    const pageServices = await prisma.agendaBookingPageService.findMany({
      where: { bookingPageId: id },
      include: { service: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(pageServices);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
