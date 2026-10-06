import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import {
  backfillContactLocations,
  backfillOrderDetails,
  backfillOrderTimes,
} from "@/lib/commerce-attribution/backfill";
import { mergeDuplicateLeads } from "@/lib/crm/merge-leads";
import { reopenRecentExpiredCarts } from "@/lib/crm/abandoned-cart";
import { migrateAgingFlows } from "@/lib/flows/playbooks";

export const maxDuration = 300;

/**
 * Service-to-service: junta cards duplicados do mesmo contato, corrige horários e completa itens,
 * origem e cidade de pedidos de loja já importados; reabre carrinhos e pedidos não pagos dos últimos
 * 6 meses e ajusta os fluxos de janela (+30/+60/+90).
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

  const leads = await mergeDuplicateLeads(workspaceId);
  const times = await backfillOrderTimes(workspaceId);
  const result = await backfillOrderDetails(workspaceId);
  const locations = await backfillContactLocations(workspaceId);
  const carts = await reopenRecentExpiredCarts(workspaceId);
  const flows = await migrateAgingFlows(workspaceId);
  return NextResponse.json({ ok: true, leads, times, ...result, locations, carts, flows });
}
