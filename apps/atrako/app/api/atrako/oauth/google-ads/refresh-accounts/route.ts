import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { getWorkspaceConnection, upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { listAccessibleCustomerIds } from "@/lib/googleAds/googleAdsClient";
import { parseGoogleAdsConnectionMetadata } from "@/lib/googleAds/types";

/**
 * Re-lista CIDs acessíveis com descriptive_name (sem novo OAuth).
 * Útil quando o metadata antigo só tinha IDs / nomes = CID.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  const workspaceId = body.workspaceId?.trim() || "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const platform = await resolvePlatformApp("GOOGLE_ADS");
  const clientId = platform?.credentials.clientId?.trim();
  const clientSecret = platform?.credentials.clientSecret?.trim();
  if (!platform?.enabled || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Configure GOOGLE_ADS em /admin/apps" },
      { status: 503 },
    );
  }

  const existing = await getWorkspaceConnection(workspaceId, "GOOGLE_ADS");
  if (!existing) {
    return NextResponse.json({ error: "Google Ads não conectado" }, { status: 400 });
  }
  const refreshToken =
    typeof existing.credentials.refreshToken === "string"
      ? existing.credentials.refreshToken
      : "";
  const accessToken =
    typeof existing.credentials.accessToken === "string"
      ? existing.credentials.accessToken
      : null;
  if (!refreshToken) {
    return NextResponse.json({ error: "Google Ads não conectado" }, { status: 400 });
  }

  const listed = await listAccessibleCustomerIds({
    refreshToken,
    accessToken,
    clientId,
    clientSecret,
    developerToken: platform.credentials.developerToken,
  });

  const prevMeta = parseGoogleAdsConnectionMetadata(existing.metadata);
  const prevCustomerId = prevMeta.customerId ?? "";
  const matched = listed.accounts.find((a) => a.id === prevCustomerId);

  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "GOOGLE_ADS",
    label: matched?.name || existing.label || "Google Ads",
    status: existing.status || "ACTIVE",
    credentials: existing.credentials,
    metadata: {
      ...prevMeta,
      accessibleCustomerIds: listed.ids,
      accessibleCustomers: listed.accounts,
      customerName: matched?.name ?? prevMeta.customerName,
      loginCustomerId: matched?.loginCustomerId ?? listed.loginCustomerId ?? prevMeta.loginCustomerId,
      needsAccountPick: !prevCustomerId && listed.accounts.length > 0,
      listError: listed.error,
      accountsRefreshedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    accounts: listed.accounts,
    loginCustomerId: listed.loginCustomerId,
    error: listed.error,
  });
}
