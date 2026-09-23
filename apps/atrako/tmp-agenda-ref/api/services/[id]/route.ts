import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ownedService(id: string, organizationId: string) {
  return prisma.service.findFirst({
    where: { id, organizationId },
  });
}

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  priceCents: z.number().int().min(0).optional(),
  caktoOfferId: z.string().nullable().optional(),
  bufferBefore: z.number().int().min(0).optional(),
  bufferAfter: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const svc = await ownedService(id, session.user.organizationId);
  if (!svc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = updateSchema.parse(await req.json());
    const updated = await prisma.service.update({
      where: { id },
      data: body,
      include: { customFields: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Dados inv├ílidos" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const svc = await ownedService(id, session.user.organizationId);
  if (!svc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}