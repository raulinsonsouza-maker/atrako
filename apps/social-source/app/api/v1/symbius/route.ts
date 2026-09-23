import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isAuthError,
  requirePublicApiOrg,
} from "@/lib/symbius/attribution/auth";

export async function GET(request: NextRequest) {
  const auth = await requirePublicApiOrg(request);
  if (isAuthError(auth)) return auth;

  const contatos = await prisma.igContato.findMany({
    where: { organizationId: auth.organizationId },
    take: 100,
    orderBy: { lastInteractionAt: "desc" },
  });

  return NextResponse.json({ contatos });
}

export async function POST(request: NextRequest) {
  const auth = await requirePublicApiOrg(request);
  if (isAuthError(auth)) return auth;

  const body = (await request.json()) as {
    action?: string;
    contatoId?: string;
    fluxoId?: string;
    tags?: string[];
  };

  if (body.action === "trigger_flow" && body.contatoId && body.fluxoId) {
    const { triggerManualFluxo } = await import("@/lib/symbius/manualFluxo");
    const ok = await triggerManualFluxo({
      organizationId: auth.organizationId,
      fluxoId: body.fluxoId,
      contatoId: body.contatoId,
      context: { manual: true, api: true },
    });
    return NextResponse.json({ ok });
  }

  if (body.action === "add_tags" && body.contatoId && body.tags?.length) {
    const contato = await prisma.igContato.findFirst({
      where: { id: body.contatoId, organizationId: auth.organizationId },
    });
    if (!contato) {
      return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    }
    const tags = Array.from(new Set([...contato.tags, ...body.tags]));
    await prisma.igContato.update({ where: { id: contato.id }, data: { tags } });
    return NextResponse.json({ ok: true, tags });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
