import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const page = await prisma.agendaBookingPage.findFirst({
    where: { id, clienteId: workspaceId },
    include: {
      pageServices: {
        orderBy: { sortOrder: "asc" },
        include: { service: true },
      },
      availability: { orderBy: { dayOfWeek: "asc" } },
      exceptions: true,
    },
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(page);
}

const patchSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  accentColor: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  timezone: z.string().optional(),
  slotStepMinutes: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  funnelConfig: z.unknown().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = patchSchema.parse(await request.json());
    if (!(await findWorkspaceById(body.workspaceId))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const existing = await prisma.agendaBookingPage.findFirst({
      where: { id, clienteId: body.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    if (body.isDefault) {
      await prisma.agendaBookingPage.updateMany({
        where: { clienteId: body.workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const { workspaceId: _, ...data } = body;
    const page = await prisma.agendaBookingPage.update({
      where: { id },
      data: {
        ...data,
        funnelConfig: data.funnelConfig === undefined
          ? undefined
          : (data.funnelConfig as object),
      },
    });
    return NextResponse.json(page);
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
  const existing = await prisma.agendaBookingPage.findFirst({
    where: { id, clienteId: workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.isDefault) {
    return NextResponse.json(
      { error: "Não é possível excluir a página padrão" },
      { status: 400 },
    );
  }
  await prisma.agendaBookingPage.update({
    where: { id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
