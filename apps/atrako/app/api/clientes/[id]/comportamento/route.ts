import { NextRequest, NextResponse } from "next/server";
import { requireClienteAccess } from "@/lib/portalSession";
import { comportamentoRange, getComportamento } from "@/lib/commerce/comportamento";

/** Comportamento de compra do período da aba Geral. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "public-read");
  if (access.response) return access.response;

  const sp = request.nextUrl.searchParams;
  const range = comportamentoRange({
    dataInicio: sp.get("dataInicio"),
    dataFim: sp.get("dataFim"),
    periodo: sp.get("periodo"),
  });
  const data = await getComportamento(id, range);
  return NextResponse.json(data);
}
