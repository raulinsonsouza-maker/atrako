import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { foodCanManage, foodPanelRole } from "@/lib/food/panel";
import { asWeekHours } from "@/lib/food/availability";
import { reorderFood, saveFoodCategory, saveFoodItem, saveStoreHours, storeForWorkspace } from "@/lib/food/editor";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;
  const role = await foodPanelRole(workspaceId);
  if (!foodCanManage(role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const action = typeof body.action === "string" ? body.action : "";
  if (action === "item") {
    const groups = Array.isArray(body.groups) ? body.groups : [];
    const saved = await saveFoodItem({
      workspaceId,
      itemId: typeof body.itemId === "string" ? body.itemId : null,
      categoryId: typeof body.categoryId === "string" ? body.categoryId : "",
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : null,
      priceCents: Number(body.priceCents) || 0,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients.filter((row): row is string => typeof row === "string") : [],
      available: body.available !== false,
      schedule: body.schedule,
      groups: groups.map((row) => {
        const group = row as Record<string, unknown>;
        const options = Array.isArray(group.options) ? group.options : [];
        return {
          name: typeof group.name === "string" ? group.name : "",
          minSelect: Number(group.minSelect) || 0,
          maxSelect: Number(group.maxSelect) || 1,
          options: options.map((option) => {
            const rowOption = option as Record<string, unknown>;
            return {
              name: typeof rowOption.name === "string" ? rowOption.name : "",
              priceCents: Number(rowOption.priceCents) || 0,
            };
          }),
        };
      }),
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
  } else if (action === "category") {
    const saved = await saveFoodCategory({
      workspaceId,
      categoryId: typeof body.categoryId === "string" ? body.categoryId : null,
      name: typeof body.name === "string" ? body.name : "",
      active: typeof body.active === "boolean" ? body.active : undefined,
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
  } else if (action === "reorder") {
    const saved = await reorderFood({
      workspaceId,
      categories: Array.isArray(body.categories) ? (body.categories as Array<{ id: string; sortOrder: number }>) : [],
      items: Array.isArray(body.items) ? (body.items as Array<{ id: string; sortOrder: number }>) : [],
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
  } else if (action === "hours") {
    const saved = await saveStoreHours(workspaceId, asWeekHours(body.hours));
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  return NextResponse.json({ store: await storeForWorkspace(workspaceId) });
}
