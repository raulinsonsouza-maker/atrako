import { NextRequest, NextResponse } from "next/server";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { lpDomainWorkspaceId } from "@/lib/geo-hub/lp-workspace";
import { getWorkspaceConfig, resolveTracking } from "@/lib/config/getWorkspaceConfig";

/**
 * IDs públicos de medição da LP estática do domínio (Pixel / GA4), vindos de Config → Rastreamento.
 * A LP só carrega os scripts depois do consentimento. Nunca expõe tokens.
 */
export async function GET(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const lp = LP_DOMAINS[host];
  if (!lp) return NextResponse.json({ error: "not found" }, { status: 404 });
  const clienteId = await lpDomainWorkspaceId(lp.workspaceSlug);
  const config = clienteId ? await getWorkspaceConfig(clienteId) : null;
  const tracking = config ? resolveTracking(config) : null;
  return NextResponse.json(
    {
      pixelId: tracking?.pixelId ?? null,
      ga4MeasurementId: tracking?.ga4MeasurementId ?? null,
      guidePath: lp.geoBasePath ?? null,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
