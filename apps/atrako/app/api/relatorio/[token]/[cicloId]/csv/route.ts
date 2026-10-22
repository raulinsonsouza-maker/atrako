import { NextRequest, NextResponse } from "next/server";
import { vendasMetaCsv } from "@/lib/relatorios/vendas-meta-core";
import { csvResponse, getCicloReport, getClienteComissaoByToken, vendasMetaFileName } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string; cicloId: string }> }) {
  const { token, cicloId } = await params;
  const cliente = await getClienteComissaoByToken(token);
  if (!cliente) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  const data = await getCicloReport(cliente.cliente.id, cicloId);
  if (!data) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  const tipo = request.nextUrl.searchParams.get("tipo") === "itens" ? "itens" : "pedidos";
  return csvResponse(
    vendasMetaCsv(data.report, tipo),
    vendasMetaFileName(cliente.cliente.slug, data.ciclo, "csv", tipo === "itens" ? "-itens" : ""),
  );
}
