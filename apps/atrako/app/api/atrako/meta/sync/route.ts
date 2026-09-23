import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { getWorkspaceConnection, upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { discoverMetaBusinessAssets } from "@/lib/integrations/meta/business";
import { MetaGraphError } from "@/lib/integrations/meta/graph";
import { parseMetaAdsMetadata } from "@/lib/integrations/meta/types";
import { markMetaConnectionHealth } from "@/lib/integrations/meta/connection";

/** Re-descobre Business / ad accounts / pages sem apagar histórico de campanhas. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  const workspaceId =
    body.workspaceId?.trim() ||
    request.nextUrl.searchParams.get("workspaceId")?.trim() ||
    "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const row = await getWorkspaceConnection(workspaceId, "META_ADS");
  const token =
    row && typeof row.credentials.accessToken === "string"
      ? row.credentials.accessToken
      : null;
  if (!row || !token) {
    return NextResponse.json({ error: "Conexão Meta não encontrada" }, { status: 404 });
  }

  const prev = parseMetaAdsMetadata(row.metadata);

  try {
    const discovered = await discoverMetaBusinessAssets(token);
    const selectedStillValid =
      prev.selectedAdAccountId &&
      discovered.adAccounts.some((a) => a.id === prev.selectedAdAccountId);

    const metadata = {
      ...discovered,
      selectedAdAccountId: selectedStillValid ? prev.selectedAdAccountId : null,
      health: selectedStillValid
        ? ("ready" as const)
        : ("connected_pending_account" as const),
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      connectedAt: prev.connectedAt ?? discovered.connectedAt,
    };

    await upsertWorkspaceConnection({
      clienteId: workspaceId,
      provider: "META_ADS",
      label: metadata.businessName ?? row.label,
      credentials: row.credentials,
      metadata,
      status: "ACTIVE",
    });

    console.info(
      JSON.stringify({
        event: "meta_business_sync",
        workspaceId,
        adAccountsCount: metadata.adAccounts.length,
      }),
    );

    return NextResponse.json({
      ok: true,
      health: metadata.health,
      adAccountsCount: metadata.adAccounts.length,
      selectedAdAccountId: metadata.selectedAdAccountId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const needsReauth = e instanceof MetaGraphError && e.needsReauth;
    await markMetaConnectionHealth(
      workspaceId,
      needsReauth ? "needs_reauth" : "sync_error",
      message,
    );
    console.info(
      JSON.stringify({
        event: needsReauth ? "meta_token_expired" : "meta_api_error",
        workspaceId,
        phase: "asset_sync",
        message,
      }),
    );
    return NextResponse.json({ error: message, needsReauth }, { status: 502 });
  }
}
