import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureStayWorkspace } from "@/lib/stay/catalog";
import { staySummary } from "@/lib/stay/reservations";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "hospedagem");
  if (moduleOff) return moduleOff;
  await ensureStayWorkspace(workspaceId);
  const summary = await staySummary(workspaceId);
  return NextResponse.json({ summary });
}
