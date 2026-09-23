import { NextRequest, NextResponse } from "next/server";
import { enrichCrmLeads } from "@/lib/rdMarketing/enrich";
import { syncRdMarketingContacts } from "@/lib/rdMarketing/syncContacts";

/**
 * POST /api/clientes/[id]/crm/enrich
 * Dispara enriquecimento de leads CRM com dados do RD Station Marketing.
 *
 * Query params:
 *   background=1   Fire-and-forget (responde imediatamente)
 *   mode=rd_contacts  Usa sync invertido (RD como fonte primária)
 *   full=1         Ignora janela incremental (re-processa todos)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const background = request.nextUrl.searchParams.get("background") === "1";
  const mode = request.nextUrl.searchParams.get("mode");
  const full = request.nextUrl.searchParams.get("full") === "1";

  const isRdContacts = mode === "rd_contacts";

  if (background) {
    if (isRdContacts) {
      syncRdMarketingContacts(id, { full }).catch(() => {});
    } else {
      enrichCrmLeads(id).catch(() => {});
    }
    return NextResponse.json({ ok: true, queued: true });
  }

  if (isRdContacts) {
    const result = await syncRdMarketingContacts(id, { full });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  const result = await enrichCrmLeads(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
