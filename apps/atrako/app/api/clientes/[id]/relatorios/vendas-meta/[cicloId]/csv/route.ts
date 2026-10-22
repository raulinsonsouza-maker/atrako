import { NextRequest, NextResponse } from "next/server";
import { requireClienteAccess } from "@/lib/portalSession";
import { vendasMetaCsv } from "@/lib/relatorios/vendas-meta-core";
import { csvResponse, getCicloReport, getClienteComissao, vendasMetaFileName } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; cicloId: string }> }) {
  const { id, cicloId } = await params;
  const access = await requireClienteAccess(request, id, "read");
  if (access.response) return access.response;
  const [data, cliente] = await Promise.all([getCicloReport(id, cicloId), getClienteComissao(id)]);
  if (!data || !cliente) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  const tipo = request.nextUrl.searchParams.get("tipo") === "itens" ? "itens" : "pedidos";
  return csvResponse(
    vendasMetaCsv(data.report, tipo),
    vendasMetaFileName(cliente.cliente.slug, data.ciclo, "csv", tipo === "itens" ? "-itens" : ""),
  );
}
