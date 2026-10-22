import { NextRequest, NextResponse } from "next/server";
import { getCicloReport, getClienteComissaoByToken } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; cicloId: string }> }) {
  const { token, cicloId } = await params;
  const cliente = await getClienteComissaoByToken(token);
  if (!cliente) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  const data = await getCicloReport(cliente.cliente.id, cicloId);
  if (!data) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}
