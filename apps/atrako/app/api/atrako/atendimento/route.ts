import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";
import { resolveLogoOnDark } from "@/lib/brand/logo";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;

  const cliente = await prisma.cliente.findUnique({
    where: { id: workspaceId },
    select: {
      nome: true,
      slug: true,
      logoUrl: true,
      workspaceSettings: { select: { logoOnDarkUrl: true } },
      contas: { select: { plataforma: true } },
    },
  });
  if (!cliente) return NextResponse.json({ error: "not found" }, { status: 404 });

  const member = await getWorkspaceMember();
  const role = member && member.clienteId === workspaceId ? member.role : "ADMIN";
  const plataformas = new Set(cliente.contas.map((conta) => conta.plataforma));
  return NextResponse.json({
    name: cliente.nome,
    logoUrl: cliente.logoUrl,
    logoOnDark: resolveLogoOnDark(cliente.workspaceSettings?.logoOnDarkUrl, cliente.slug),
    role,
    channels: { meta: plataformas.has("META"), instagram: plataformas.has("INSTAGRAM") },
  });
}
