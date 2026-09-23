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

  const [mp, google] = await Promise.all([
    prisma.workspaceConnection.findUnique({
      where: {
        clienteId_provider: {
          clienteId: workspaceId,
          provider: "MERCADO_PAGO",
        },
      },
    }),
    prisma.workspaceConnection.findUnique({
      where: {
        clienteId_provider: {
          clienteId: workspaceId,
          provider: "GOOGLE_CALENDAR",
        },
      },
    }),
  ]);

  return NextResponse.json({
    mercadoPago: Boolean(mp && mp.status === "ACTIVE"),
    googleCalendar: Boolean(google && google.status === "ACTIVE"),
  });
}
