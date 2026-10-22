import { NextRequest, NextResponse } from "next/server";
import { requireClienteAccess } from "@/lib/portalSession";
import { getClienteComissao, listCiclosResumo, syncComissaoCiclos } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

/** Configuração da comissão + ciclos mensais (garante o ciclo atual antes de listar). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "read");
  if (access.response) return access.response;

  const data = await getClienteComissao(id);
  if (!data) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (data.config) {
    await syncComissaoCiclos(id).catch((err) => console.error("[comissao-ciclos]", err));
  }
  return NextResponse.json({
    cliente: { id: data.cliente.id, nome: data.cliente.nome, slug: data.cliente.slug },
    config: data.config,
    podeEditar: Boolean(access.internalUser),
    ciclos: data.config ? await listCiclosResumo(id) : [],
  });
}
