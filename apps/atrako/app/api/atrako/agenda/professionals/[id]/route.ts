import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const pro = await prisma.agendaProfessional.findFirst({
    where: { id, clienteId: workspaceId },
    include: {
      services: { select: { serviceId: true } },
      availability: { orderBy: { dayOfWeek: "asc" } },
    },
  });
  if (!pro) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ...pro,
    serviceIds: pro.services.map((s) => s.serviceId),
  });
}

const patchSchema = z.object({
  workspaceId: z.string().min(1),
  displayName: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional(),
  commissionEnabled: z.boolean().optional(),
  commissionPercent: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = patchSchema.parse(await request.json());
    const access = await requireWorkspaceAccess(body.workspaceId, "operate");
    if (!access.ok) return access.response;
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const existing = await prisma.agendaProfessional.findFirst({
      where: { id, clienteId: body.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const { workspaceId: _, serviceIds, ...data } = body;

    await prisma.$transaction(async (tx) => {
      await tx.agendaProfessional.update({ where: { id }, data });
      if (serviceIds) {
        await tx.agendaProfessionalService.deleteMany({
          where: { professionalId: id },
        });
        if (serviceIds.length) {
          await tx.agendaProfessionalService.createMany({
            data: serviceIds.map((serviceId) => ({
              professionalId: id,
              serviceId,
            })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const existing = await prisma.agendaProfessional.findFirst({
    where: { id, clienteId: workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.agendaProfessional.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}
