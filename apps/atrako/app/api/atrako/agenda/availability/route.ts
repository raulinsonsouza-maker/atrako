import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { normalizeRules } from "@/lib/agenda/availability-core";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const bookingPageId = request.nextUrl.searchParams.get("bookingPageId");
  const professionalId = request.nextUrl.searchParams.get("professionalId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (professionalId) {
    const pro = await prisma.agendaProfessional.findFirst({
      where: { id: professionalId, clienteId: workspaceId },
    });
    if (!pro) return NextResponse.json({ error: "not found" }, { status: 404 });
    const rules = await prisma.agendaAvailabilityRule.findMany({
      where: { professionalId },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(rules);
  }

  if (!bookingPageId) {
    return NextResponse.json(
      { error: "bookingPageId ou professionalId" },
      { status: 400 },
    );
  }

  const page = await prisma.agendaBookingPage.findFirst({
    where: { id: bookingPageId, clienteId: workspaceId },
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rules = await prisma.agendaAvailabilityRule.findMany({
    where: { bookingPageId, professionalId: null },
    orderBy: { dayOfWeek: "asc" },
  });
  return NextResponse.json(rules);
}

const putSchema = z
  .object({
    workspaceId: z.string().min(1),
    bookingPageId: z.string().optional(),
    professionalId: z.string().optional(),
    applyToAllProfessionals: z.boolean().optional(),
    rules: z.array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
      }),
    ),
  })
  .refine(
    (d) =>
      Boolean(d.applyToAllProfessionals) ||
      Boolean(d.bookingPageId) ||
      Boolean(d.professionalId),
    { message: "Informe bookingPageId, professionalId ou applyToAllProfessionals" },
  );

export async function PUT(request: NextRequest) {
  try {
    const body = putSchema.parse(await request.json());
    const access = await requireWorkspaceAccess(body.workspaceId, "operate");
    if (!access.ok) return access.response;
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const normalized = normalizeRules(body.rules);

    if (body.applyToAllProfessionals) {
      const pros = await prisma.agendaProfessional.findMany({
        where: { clienteId: body.workspaceId, isActive: true },
        select: { id: true },
      });
      if (!pros.length) {
        return NextResponse.json(
          { error: "Cadastre pelo menos um profissional ativo" },
          { status: 400 },
        );
      }
      const proIds = pros.map((p) => p.id);
      await prisma.$transaction([
        prisma.agendaAvailabilityRule.deleteMany({
          where: { professionalId: { in: proIds } },
        }),
        prisma.agendaAvailabilityRule.createMany({
          data: proIds.flatMap((professionalId) =>
            normalized.map((r) => ({
              professionalId,
              dayOfWeek: r.dayOfWeek,
              startTime: r.startTime,
              endTime: r.endTime,
            })),
          ),
        }),
      ]);
      return NextResponse.json(normalized);
    }

    if (body.professionalId) {
      const pro = await prisma.agendaProfessional.findFirst({
        where: { id: body.professionalId, clienteId: body.workspaceId },
      });
      if (!pro) return NextResponse.json({ error: "not found" }, { status: 404 });

      await prisma.$transaction([
        prisma.agendaAvailabilityRule.deleteMany({
          where: { professionalId: body.professionalId },
        }),
        prisma.agendaAvailabilityRule.createMany({
          data: normalized.map((r) => ({
            professionalId: body.professionalId!,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        }),
      ]);

      const rules = await prisma.agendaAvailabilityRule.findMany({
        where: { professionalId: body.professionalId },
        orderBy: { dayOfWeek: "asc" },
      });
      return NextResponse.json(rules);
    }

    const page = await prisma.agendaBookingPage.findFirst({
      where: { id: body.bookingPageId!, clienteId: body.workspaceId },
    });
    if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.agendaAvailabilityRule.deleteMany({
        where: {
          bookingPageId: body.bookingPageId!,
          professionalId: null,
        },
      }),
      prisma.agendaAvailabilityRule.createMany({
        data: normalized.map((r) => ({
          bookingPageId: body.bookingPageId!,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      }),
    ]);

    const rules = await prisma.agendaAvailabilityRule.findMany({
      where: {
        bookingPageId: body.bookingPageId!,
        professionalId: null,
      },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
