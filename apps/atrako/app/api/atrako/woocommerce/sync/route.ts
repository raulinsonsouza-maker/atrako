import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import {
  reconcileUnpaidWooOrders,
  syncWooCommerceWorkspace,
} from "@/lib/integrations/woocommerce/sync";

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

  const mode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "sync";

  try {
    if (mode === "reconcile") {
      const result = await reconcileUnpaidWooOrders({
        workspaceId,
        daysBack: typeof body.daysBack === "number" ? body.daysBack : 21,
        limitPerWorkspace: typeof body.limit === "number" ? body.limit : 80,
      });
      return NextResponse.json({ ok: true, mode, ...result });
    }

    const result = await syncWooCommerceWorkspace(workspaceId, {
      daysBack: typeof body.daysBack === "number" ? body.daysBack : 90,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : 5,
    });
    return NextResponse.json({ ok: true, mode: "sync", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}