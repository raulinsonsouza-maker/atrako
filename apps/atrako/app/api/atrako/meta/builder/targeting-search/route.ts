import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { searchTargeting } from "@/lib/integrations/meta/campaign-builder/publish";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const type = request.nextUrl.searchParams.get("type")?.trim() || "adinterest";
  if (!workspaceId || !q) {
    return NextResponse.json({ error: "workspaceId e q obrigatórios" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const results = await searchTargeting({ clienteId: workspaceId, q, type });
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
