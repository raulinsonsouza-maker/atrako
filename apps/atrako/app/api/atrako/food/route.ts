import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureFoodWorkspace } from "@/lib/food/catalog";
import { foodCanManage, foodPanelRole } from "@/lib/food/panel";
import { storeForWorkspace } from "@/lib/food/editor";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;

  let store = await storeForWorkspace(workspaceId);
  if (!store) {
    await ensureFoodWorkspace(workspaceId);
    store = await storeForWorkspace(workspaceId);
  }
  return NextResponse.json({ store, role: await foodPanelRole(workspaceId) });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!foodCanManage(await foodPanelRole(workspaceId))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;

  const store = await prisma.foodStore.findUnique({ where: { clienteId: workspaceId } });
  if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });

  if (typeof body.acceptingOrders === "boolean") {
    await prisma.foodStore.update({
      where: { id: store.id },
      data: { acceptingOrders: body.acceptingOrders, status: body.acceptingOrders ? "PUBLISHED" : "PAUSED" },
    });
  }

  if (typeof body.itemId === "string") {
    const data: { available?: boolean; priceCents?: number } = {};
    if (typeof body.available === "boolean") data.available = body.available;
    if (Number.isInteger(body.priceCents) && Number(body.priceCents) >= 0) data.priceCents = Number(body.priceCents);
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    const item = await prisma.foodItem.updateMany({
      where: { id: body.itemId, storeId: store.id },
      data,
    });
    if (!item.count) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  const fresh = await prisma.foodStore.findUnique({
    where: { id: store.id },
    include: { items: { orderBy: { sortOrder: "asc" } }, categories: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ store: fresh });
}
