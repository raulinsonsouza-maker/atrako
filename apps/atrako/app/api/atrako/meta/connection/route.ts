import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { getMetaConnectionStatus } from "@/lib/integrations/meta/connection";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const status = await getMetaConnectionStatus(workspaceId);
  return NextResponse.json(status);
}
