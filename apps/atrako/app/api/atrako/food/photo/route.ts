import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { foodCanManage, foodPanelRole } from "@/lib/food/panel";
import { saveUpload } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const workspaceId = String(form?.get("workspaceId") ?? "");
  const file = form?.get("file");
  if (!workspaceId || !(file instanceof File)) {
    return NextResponse.json({ error: "Envie a foto" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;
  if (!foodCanManage(await foodPanelRole(workspaceId))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return NextResponse.json({ error: "Use png, jpg ou webp" }, { status: 400 });
  }
  const filename = `item-${crypto.randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`;
  const url = await saveUpload("food-media", filename, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url });
}
