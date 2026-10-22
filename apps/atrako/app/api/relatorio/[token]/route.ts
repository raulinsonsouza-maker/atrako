import { NextRequest, NextResponse } from "next/server";
import { getClienteComissaoByToken, listCiclosResumo, syncComissaoCiclos } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

/** Link público do relatório de comissão: cliente + ciclos. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getClienteComissaoByToken(token);
  if (!data) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  await syncComissaoCiclos(data.cliente.id).catch((err) => console.error("[comissao-ciclos]", err));
  return NextResponse.json({
    cliente: { nome: data.cliente.nome, logoUrl: data.cliente.logoUrl },
    config: { percent: data.config.percent },
    ciclos: await listCiclosResumo(data.cliente.id),
  });
}
