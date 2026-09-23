import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const bookingPageId = request.nextUrl.searchParams.get("bookingPageId");
  const professionalId = request.nextUrl.searchParams.get("professionalId");

  if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  if (professionalId) {
    const exceptions = await prisma.agendaAvailabilityException.findMany({
      where: { professionalId },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(exceptions);
  }

  if (!bookingPageId) {
    return NextResponse.json(
      { error: "bookingPageId ou professionalId" },
      { status: 400 },
    );
  }

  const exceptions = await prisma.agendaAvailabilityException.findMany({
    where: { bookingPageId, professionalId: null },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(exceptions);
}

const putSchema = z.object({
  workspaceId: z.string().min(1),
  bookingPageId: z.string().optional(),
  professionalId: z.string().optional(),
  exceptions: z.array(
    z.object({
      date: z.string(),
      isBlocked: z.boolean().default(true),
      startTime: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
    }),
  ),
});

export async function PUT(request: NextRequest) {
  try {
    const body = putSchema.parse(await request.json());
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    if (body.professionalId) {
      await prisma.$transaction([
        prisma.agendaAvailabilityException.deleteMany({
          where: { professionalId: body.professionalId },
        }),
        prisma.agendaAvailabilityException.createMany({
          data: body.exceptions.map((e) => ({
            professionalId: body.professionalId!,
            date: e.date,
            isBlocked: e.isBlocked,
            startTime: e.startTime ?? null,
            endTime: e.endTime ?? null,
          })),
        }),
      ]);
      return NextResponse.json(body.exceptions);
    }

    if (!body.bookingPageId) {
      return NextResponse.json(
        { error: "bookingPageId ou professionalId" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.agendaAvailabilityException.deleteMany({
        where: {
          bookingPageId: body.bookingPageId,
          professionalId: null,
        },
      }),
      prisma.agendaAvailabilityException.createMany({
        data: body.exceptions.map((e) => ({
          bookingPageId: body.bookingPageId!,
          date: e.date,
          isBlocked: e.isBlocked,
          startTime: e.startTime ?? null,
          endTime: e.endTime ?? null,
        })),
      }),
    ]);
    return NextResponse.json(body.exceptions);
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
