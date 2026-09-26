import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { syncMercadoLivreWorkspace } from "@/lib/integrations/mercadolivre/sync";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId =
    (typeof body.workspaceId === "string" && body.workspaceId.trim()) ||
    request.nextUrl.searchParams.get("workspaceId")?.trim() ||
    "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const result = await syncMercadoLivreWorkspace(workspaceId, {
      dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : "2026-01-01",
      dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
