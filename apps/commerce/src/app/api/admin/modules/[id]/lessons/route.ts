import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id: moduleId } = await params;
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
  }

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) {
    return NextResponse.json({ error: "Módulo não encontrado." }, { status: 404 });
  }

  const last = await prisma.lesson.findFirst({
    where: { moduleId },
    orderBy: { position: "desc" },
  });

  const lesson = await prisma.lesson.create({
    data: {
      moduleId,
      title,
      position: (last?.position ?? 0) + 1,
      bunnyVideoId: body.bunnyVideoId ? String(body.bunnyVideoId) : null,
      content: body.content ? String(body.content) : null,
    },
  });

  return NextResponse.json(lesson, { status: 201 });
}
