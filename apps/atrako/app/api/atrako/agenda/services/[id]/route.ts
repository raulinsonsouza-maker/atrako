import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";

const patchSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  priceCents: z.number().int().min(0).optional(),
  bufferBefore: z.number().int().min(0).optional(),
  bufferAfter: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const service = await prisma.agendaService.findFirst({
    where: { id, clienteId: workspaceId },
    include: { customFields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!service) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(service);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = patchSchema.parse(await request.json());
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const existing = await prisma.agendaService.findFirst({
      where: { id, clienteId: body.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const { workspaceId: _, ...data } = body;
    const service = await prisma.agendaService.update({
      where: { id },
      data,
    });
    return NextResponse.json(service);
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
  const existing = await prisma.agendaService.findFirst({
    where: { id, clienteId: workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.agendaService.update({
    where: { id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
