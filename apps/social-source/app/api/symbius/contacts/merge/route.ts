import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const body = (await request.json()) as {
    sourceId: string;
    targetId: string;
  };

  const [source, target] = await Promise.all([
    prisma.igContato.findFirst({
      where: { id: body.sourceId, organizationId: session.organizationId },
    }),
    prisma.igContato.findFirst({
      where: { id: body.targetId, organizationId: session.organizationId },
    }),
  ]);

  if (!source || !target || source.id === target.id) {
    return NextResponse.json({ error: "Contatos inválidos" }, { status: 400 });
  }

  const mergedTags = Array.from(new Set([...target.tags, ...source.tags]));
  const mergedCampos = {
    ...(target.campos as object),
    ...(source.campos as object),
  };

  await prisma.$transaction([
    prisma.igConversa.updateMany({
      where: { contatoId: source.id },
      data: { contatoId: target.id },
    }),
    prisma.igFluxoExecucao.updateMany({
      where: { contatoId: source.id },
      data: { contatoId: target.id },
    }),
    prisma.igContato.update({
      where: { id: target.id },
      data: {
        tags: mergedTags,
        campos: mergedCampos as object,
        phone: target.phone ?? source.phone,
        nome: target.nome ?? source.nome,
        username: target.username ?? source.username,
      },
    }),
    prisma.igContato.delete({ where: { id: source.id } }),
  ]);

  return NextResponse.json({ ok: true, mergedInto: target.id });
}
