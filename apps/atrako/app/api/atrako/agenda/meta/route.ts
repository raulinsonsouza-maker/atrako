import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { businessMode: true, timezone: true },
  });

  return NextResponse.json({
    businessMode: settings?.businessMode === "SALON" ? "SALON" : "SOLO",
    timezone: settings?.timezone ?? "America/Sao_Paulo",
  });
}
