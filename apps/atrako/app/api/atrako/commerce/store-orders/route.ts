import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureCommerceStore } from "@/lib/commerce/store";

const FULFILLMENT_NEXT: Record<string, string[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);
  const orders = await prisma.commerceOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true },
  });
  return NextResponse.json({ orders });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const fulfillmentStatus = typeof body.fulfillmentStatus === "string" ? body.fulfillmentStatus : "";
  if (!workspaceId || !orderId || !fulfillmentStatus) {
    return NextResponse.json({ error: "dados incompletos" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);
  const order = await prisma.commerceOrder.findFirst({
    where: { id: orderId, storeId: store.id },
  });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const allowed = FULFILLMENT_NEXT[order.fulfillmentStatus] ?? [];
  if (!allowed.includes(fulfillmentStatus)) {
    return NextResponse.json({ error: "Transição inválida" }, { status: 400 });
  }

  const updated = await prisma.commerceOrder.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus,
      status: fulfillmentStatus === "CANCELLED" ? "CANCELLED" : order.status,
    },
    include: { items: true },
  });
  return NextResponse.json({ order: updated });
}
