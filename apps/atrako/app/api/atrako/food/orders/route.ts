import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;

  const status = request.nextUrl.searchParams.get("status")?.trim();
  const orders = await prisma.foodOrder.findMany({
    where: {
      clienteId: workspaceId,
      ...(status ? { fulfillmentStatus: status } : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ orders });
}
