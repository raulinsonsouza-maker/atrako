import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import {
  attachServiceToDefaultPage,
  ensureDefaultBookingPage,
} from "@/lib/agenda/pages";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).default(60),
  priceCents: z.number().int().min(0).default(0),
  bufferBefore: z.number().int().min(0).optional(),
  bufferAfter: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await ensureDefaultBookingPage(workspaceId);

  const services = await prisma.agendaService.findMany({
    where: { clienteId: workspaceId },
    include: { _count: { select: { bookings: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    services.map((s) => ({
      ...s,
      bookingsCount: s._count.bookings,
      _count: undefined,
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = createSchema.parse(await request.json());
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const count = await prisma.agendaService.count({
      where: { clienteId: body.workspaceId },
    });

    const service = await prisma.agendaService.create({
      data: {
        clienteId: body.workspaceId,
        title: body.title,
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        durationMinutes: body.durationMinutes,
        priceCents: body.priceCents,
        bufferBefore: body.bufferBefore ?? 0,
        bufferAfter: body.bufferAfter ?? 0,
        sortOrder: count,
        active: true,
      },
    });

    await attachServiceToDefaultPage(body.workspaceId, service.id);
    return NextResponse.json(service, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar serviço" }, { status: 500 });
  }
}
