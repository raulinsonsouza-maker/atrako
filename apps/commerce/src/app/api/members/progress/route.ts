import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProductAccess } from "@/lib/entitlements";

const schema = z.object({
  lessonId: z.string(),
  completed: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const lesson = await prisma.lesson.findUnique({
      where: { id: body.lessonId },
      include: { module: true },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
    }

    const hasAccess = await userHasProductAccess(session.user.id, lesson.module.productId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
    }

    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: session.user.id, lessonId: lesson.id },
      },
      update: {
        completedAt: body.completed ? new Date() : null,
      },
      create: {
        userId: session.user.id,
        lessonId: lesson.id,
        completedAt: body.completed ? new Date() : null,
      },
    });

    return NextResponse.json({ ok: true, progress });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao salvar progresso";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
