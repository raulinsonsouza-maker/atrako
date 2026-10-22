import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { isDay } from "@/lib/relatorios/ciclos";
import { getClienteComissao, newShareToken, syncComissaoCiclos } from "@/lib/relatorios/vendas-meta";

export const dynamic = "force-dynamic";

/** Termos do contrato de comissão — só equipe interna. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "write");
  if (access.response) return access.response;
  if (!access.internalUser) {
    return NextResponse.json({ error: "Somente a equipe Atrako altera a comissão" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    percent?: unknown;
    inicio?: unknown;
    diaCorte?: unknown;
    regenerarLink?: unknown;
    desativar?: unknown;
  };

  const current = await getClienteComissao(id);
  if (!current) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  if (body.desativar === true) {
    await prisma.cliente.update({ where: { id }, data: { comissaoMetaPercent: null } });
    return NextResponse.json({ ok: true, config: null });
  }

  const percent = Number(body.percent ?? current.config?.percent);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return NextResponse.json({ error: "Percentual inválido (0 a 100)" }, { status: 400 });
  }
  const inicio = body.inicio ?? current.config?.inicio;
  if (!isDay(inicio)) return NextResponse.json({ error: "Data de início inválida" }, { status: 400 });
  const diaCorte = Number(body.diaCorte ?? current.config?.diaCorte ?? Number(inicio.slice(8, 10)));
  if (!Number.isInteger(diaCorte) || diaCorte < 1 || diaCorte > 31) {
    return NextResponse.json({ error: "Dia de corte inválido (1 a 31)" }, { status: 400 });
  }

  const shareToken =
    body.regenerarLink === true || !current.cliente.comissaoMetaShareToken
      ? newShareToken()
      : current.cliente.comissaoMetaShareToken;

  await prisma.cliente.update({
    where: { id },
    data: {
      comissaoMetaPercent: percent,
      comissaoMetaInicio: new Date(`${inicio}T00:00:00Z`),
      comissaoMetaDiaCorte: diaCorte,
      comissaoMetaShareToken: shareToken,
    },
  });
  await syncComissaoCiclos(id);
  const updated = await getClienteComissao(id);
  return NextResponse.json({ ok: true, config: updated?.config ?? null });
}
