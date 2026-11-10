import { NextRequest, NextResponse } from "next/server";

import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  disconnectWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { validateOlistToken } from "@/lib/integrations/olist/client";

export const maxDuration = 300;

/** Conectar / desconectar Olist ERP via Token API (Config → Conexões). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (b.action === "disconnect") {
    await disconnectWorkspaceConnection(workspaceId, "OLIST_ERP");
    return NextResponse.json({ ok: true, disconnected: true });
  }

  const credentials =
    b.credentials && typeof b.credentials === "object" && !Array.isArray(b.credentials)
      ? (b.credentials as Record<string, unknown>)
      : {};

  const apiToken =
    typeof credentials.apiToken === "string" ? credentials.apiToken.trim() : "";
  if (!apiToken) {
    return NextResponse.json({ error: "apiToken é obrigatório" }, { status: 400 });
  }

  const validated = await validateOlistToken(apiToken);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const row = await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "OLIST_ERP",
    label:
      typeof b.label === "string" && b.label.trim()
        ? b.label.trim()
        : "Olist ERP",
    credentials: { apiToken },
    metadata: {
      apiVersion: validated.apiVersion,
    },
    status: "ACTIVE",
  });

  let initialSync: {
    processed: number;
    pages: number;
    matchedWoo: number;
    errors: number;
  } | null = null;
  let syncError: string | null = null;
  try {
    const { syncOlistWorkspace } = await import("@/lib/integrations/olist/sync");
    initialSync = await syncOlistWorkspace(workspaceId, {
      daysBack: 90,
      maxPages: 15,
      syncContacts: false,
    });
  } catch (err) {
    syncError = err instanceof Error ? err.message : "Falha na importação inicial";
    console.error("[olist-connect] initial sync", syncError);
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    apiVersion: validated.apiVersion,
    initialSync,
    syncError,
  });
}
