import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db-social";
import { getSession } from "@/lib/symbius/auth";

async function getSessionWithWorkspaceFallback(request: NextRequest) {
  const wsId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (wsId) {
    const org = await prisma.organization.findFirst({
      where: { centralClienteId: wsId },
      select: { id: true },
    });
    if (org) return { organizationId: org.id, userId: "" };
    return null;
  }

  return getSession();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithWorkspaceFallback(request);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const fluxo = await prisma.igFluxo.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { nos: true },
  });

  if (!fluxo) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const [runs, clicks, emails] = await Promise.all([
    prisma.igFluxoExecucao.count({ where: { fluxoId: fluxo.id } }),
    prisma.igConversionEvent.count({ where: { fluxoId: fluxo.id, tipo: "link_clicked" } }),
    prisma.igConversionEvent.count({ where: { fluxoId: fluxo.id, tipo: "email_captured" } }),
  ]);
  const ctr = runs > 0 ? Math.round((clicks / runs) * 1000) / 10 : 0;

  return NextResponse.json({
    fluxo,
    insights: { runs, sends: runs, clicks, ctr, emails },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithWorkspaceFallback(request);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.igFluxo.deleteMany({
    where: { id, organizationId: session.organizationId },
  });

  return NextResponse.json({ ok: true });
}
