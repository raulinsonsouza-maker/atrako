import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getMetaConnectionStatus } from "@/lib/integrations/meta/connection";
import { parseMetaAdsMetadata } from "@/lib/integrations/meta/types";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { listUiObjectives, SPECIAL_AD_CATEGORIES, BID_STRATEGIES, getObjectiveConfig } from "@/lib/integrations/meta/campaign-builder/objective-config";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const status = await getMetaConnectionStatus(workspaceId);
  const row = await getWorkspaceConnection(workspaceId, "META_ADS");
  const metadata = parseMetaAdsMetadata(row?.metadata);

  const pages = metadata.pages ?? [];
  const pixels = (metadata.assets ?? [])
    .filter((a) => a.type === "PIXEL")
    .map((a) => ({ id: a.id, name: a.name }));
  const instagram = (metadata.assets ?? [])
    .filter((a) => a.type === "INSTAGRAM")
    .map((a) => ({ id: a.id, name: a.name }));

  return NextResponse.json({
    connection: status,
    accounts: metadata.adAccounts,
    pages,
    pixels,
    instagram,
    objectives: listUiObjectives(),
    specialAdCategories: SPECIAL_AD_CATEGORIES,
    bidStrategies: BID_STRATEGIES,
    objectiveConfigs: Object.fromEntries(
      listUiObjectives().map((o) => [o.value, getObjectiveConfig(o.value)]),
    ),
  });
}
