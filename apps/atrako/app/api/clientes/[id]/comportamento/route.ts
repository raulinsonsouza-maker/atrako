import { NextRequest, NextResponse } from "next/server";
import { requireClienteAccess } from "@/lib/portalSession";
import { comportamentoRange, getComportamento, type FiltroComportamento } from "@/lib/commerce/comportamento";

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
  const genero = sp.get("genero");
  const dia = sp.get("dia");
  const hora = sp.get("hora");
  const filtro: FiltroComportamento = {};
  if (genero === "f" || genero === "m" || genero === "u") filtro.genero = genero;
  const produto = sp.get("produto");
  if (produto) filtro.produto = produto;
  if (dia != null && dia !== "") {
    const n = Number(dia);
    if (Number.isInteger(n) && n >= 0 && n <= 6) filtro.dia = n;
  }
  if (hora != null && hora !== "") {
    const n = Number(hora);
    if (Number.isInteger(n) && n >= 0 && n <= 23) filtro.hora = n;
  }
  if (sp.has("uf")) filtro.uf = sp.get("uf") ?? "";
  const cidade = sp.get("cidade");
  if (cidade) filtro.cidade = cidade;
  const data = await getComportamento(id, range, filtro);
  return NextResponse.json(data);
}
