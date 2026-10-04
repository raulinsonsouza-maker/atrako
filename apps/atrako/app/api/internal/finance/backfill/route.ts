import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { backfillTrayLedger } from "@/lib/integrations/tray/ledger";

/**
 * Service-to-service: reconstrói o Caixa a partir de pedidos já importados.
 *
 * Auth: Bearer ATRAKO_INTERNAL_TOKEN (fallback: ATRAKO_CONNECTIONS_TOKEN / ATRAKO_EVENTS_TOKEN).
 */
function isServiceAuthorized(request: NextRequest): boolean {
  const expected =
    process.env.ATRAKO_INTERNAL_TOKEN?.trim() ||
    process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() ||
    process.env.ATRAKO_EVENTS_TOKEN?.trim();
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  if (!isServiceAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const tray = await backfillTrayLedger(workspaceId);
  return NextResponse.json({ ok: true, tray });
}
