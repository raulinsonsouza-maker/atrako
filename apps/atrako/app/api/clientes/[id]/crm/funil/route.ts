import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { getCrmFilters, buildTagFilterWhere, buildJsonStringFilterWhere } from "@/lib/crm/tagFilter";
import { buildLeadFilterWhere, buildPaidMediaWhere } from "@/lib/crm/canalFilter";
import type { Prisma } from "@/lib/generated/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireClienteAccess(request, id, "read");
  if (access.response) return access.response;
  const url = request.nextUrl;

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const filterType  = url.searchParams.get("filterType");
  const filterValue = url.searchParams.get("filterValue");
  const paidOnly = url.searchParams.get("paidOnly") === "1";

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), 0, 1);
  const dateFrom = fromParam ? new Date(fromParam) : defaultFrom;
  const dateTo = toParam
    ? (() => { const d = new Date(toParam); d.setHours(23, 59, 59, 999); return d; })()
    : now;

  const config = await prisma.crmConfig.findUnique({
    where: { clienteId: id },
    select: { id: true, tipo: true, ativo: true, ultimoSyncAt: true },
  });

  if (!config) {
    return NextResponse.json({ configured: false });
  }

  const crmFilters = await getCrmFilters(id);
  const { tagFilter, conversaoOriginalFilter, conversaoUltimoFilter, midiaFilter, origemOriginalFilter, origemUltimoFilter, paidMediaOnly } = crmFilters;
  const leadFilterWhere = buildLeadFilterWhere(filterType, filterValue);

  const andClauses: Prisma.LeadCrmWhereInput[] = [
    ...((paidOnly || paidMediaOnly) ? [buildPaidMediaWhere()] : []),
    ...(tagFilter.length > 0 ? [buildTagFilterWhere(tagFilter)] : []),
    ...(conversaoOriginalFilter.length > 0 ? [buildJsonStringFilterWhere("conversaoOriginal", conversaoOriginalFilter)] : []),
    ...(conversaoUltimoFilter.length > 0 ? [buildJsonStringFilterWhere("conversaoUltimo", conversaoUltimoFilter)] : []),
    ...(midiaFilter.length > 0 ? [buildJsonStringFilterWhere("midiaOriginal", midiaFilter)] : []),
    ...(origemOriginalFilter.length > 0 ? [buildJsonStringFilterWhere("origem", origemOriginalFilter)] : []),
    ...(origemUltimoFilter.length > 0 ? [buildJsonStringFilterWhere("origemUltimo", origemUltimoFilter)] : []),
    ...(filterType && filterValue ? [leadFilterWhere] : []),
  ];

  const [leads, investimentoPeriodo] = await Promise.all([
    prisma.leadCrm.findMany({
      where: {
        clienteId: id,
        dataEntrada: { gte: dateFrom, lte: dateTo },
        ...(andClauses.length > 0 ? { AND: andClauses } : {}),
      },
      select: {
        etapa: true,
        ordemEtapa: true,
        valor: true,
        dataEntrada: true,
        dataFechamento: true,
        status: true,
      },
    }),
    prisma.fatoMidiaDiario.aggregate({
      where: {
        clienteId: id,
        data: { gte: dateFrom, lte: dateTo },
      },
      _sum: { investimento: true },
    }),
  ]);

  const etapaMap = new Map<
    string,
    {
      etapa: string;
      count: number;
      valor: number;
      fechados: number;
      ganhos: number;
      minOrdem: number | null;
      minEntrada: Date;
    }
  >();

  function isWonFromEtapa(etapa: string | null): boolean {
    if (!etapa) return false;
    const e = etapa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return e.includes("venda") || (e.includes("contrato") && !e.includes("cancelado")) || e.includes("assinado");
  }

  for (const lead of leads) {
    const existing = etapaMap.get(lead.etapa);
    const isWon = lead.status === "won" || (lead.status === null && isWonFromEtapa(lead.etapa));
    if (!existing) {
      etapaMap.set(lead.etapa, {
        etapa: lead.etapa,
        count: 1,
        valor: lead.valor ? Number(lead.valor) : 0,
        fechados: lead.dataFechamento ? 1 : 0,
        ganhos: isWon ? 1 : 0,
        minOrdem: lead.ordemEtapa ?? null,
        minEntrada: lead.dataEntrada,
      });
    } else {
      existing.count++;
      existing.valor += lead.valor ? Number(lead.valor) : 0;
      if (lead.dataFechamento) existing.fechados++;
      if (isWon) existing.ganhos++;
      if (
        lead.ordemEtapa != null &&
        (existing.minOrdem == null || lead.ordemEtapa < existing.minOrdem)
      ) {
        existing.minOrdem = lead.ordemEtapa;
      }
      if (lead.dataEntrada < existing.minEntrada) {
        existing.minEntrada = lead.dataEntrada;
      }
    }
  }

  const sorted = [...etapaMap.values()].sort((a, b) => {
    if (a.minOrdem != null && b.minOrdem != null) return a.minOrdem - b.minOrdem;
    if (a.minOrdem != null) return -1;
    if (b.minOrdem != null) return 1;
    return a.minEntrada.getTime() - b.minEntrada.getTime();
  });

  const totalLeads = leads.length;
  const totalValor = sorted.reduce((s, e) => s + e.valor, 0);
  const totalFechados = sorted.reduce((s, e) => s + e.fechados, 0);
  const totalGanhos = sorted.reduce((s, e) => s + e.ganhos, 0);
  const vgvTotal = leads.reduce((total, lead) => {
    const isWon = lead.status === "won" || (lead.status === null && isWonFromEtapa(lead.etapa));
    return total + (isWon && lead.valor ? Number(lead.valor) : 0);
  }, 0);
  const investimentoTotal = Number(investimentoPeriodo._sum.investimento ?? 0);
  const custoPorVenda = totalGanhos > 0 ? investimentoTotal / totalGanhos : 0;

  const etapas = sorted.map((e) => ({
    etapa: e.etapa,
    count: e.count,
    valor: e.valor,
    fechados: e.fechados,
    ganhos: e.ganhos,
    pctTotal: totalLeads > 0 ? Math.round((e.count / totalLeads) * 1000) / 10 : 0,
  }));

  return NextResponse.json({
    configured: true,
    tipo: config.tipo,
    ultimoSyncAt: config.ultimoSyncAt,
    totalLeads,
    totalValor,
    totalFechados,
    totalGanhos,
    investimentoTotal,
    custoPorVenda,
    vgvTotal,
    etapas,
  });
}
