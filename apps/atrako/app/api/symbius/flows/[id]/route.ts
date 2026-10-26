import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db-social";
import { getSession } from "@/lib/symbius/auth";

async function getSessionWithWorkspaceFallback(request: NextRequest) {
  let session = await getSession();

  // Fallback: resolve via Atrako workspaceId when no symbius session
  if (!session) {
    const wsId = request.nextUrl.searchParams.get("workspaceId");
    if (wsId) {
      const org = await prisma.organization.findFirst({
        where: { centralClienteId: wsId },
      });
      if (org) {
        session = { organizationId: org.id, userId: "" } as any;
      }
    }
  }

  return session;
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

  return NextResponse.json({ fluxo });
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
