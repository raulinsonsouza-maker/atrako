import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { selectMetaAdAccount } from "@/lib/integrations/meta/connection";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    workspaceId?: string;
    adAccountId?: string;
  };
  const workspaceId = body.workspaceId?.trim();
  const adAccountId = body.adAccountId?.trim();
  if (!workspaceId || !adAccountId) {
    return NextResponse.json(
      { error: "workspaceId e adAccountId são obrigatórios" },
      { status: 400 },
    );
  }

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const result = await selectMetaAdAccount({ workspaceId, adAccountId });
    void import("@/lib/sync/metaApiSync")
      .then(({ syncMetaCliente }) => syncMetaCliente(workspaceId))
      .catch(() => null);
    return NextResponse.json({
      ok: true,
      selectedAdAccountId: result.metadata.selectedAdAccountId,
      health: result.metadata.health,
      contaId: result.contaId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
