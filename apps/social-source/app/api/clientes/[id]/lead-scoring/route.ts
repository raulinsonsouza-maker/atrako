import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(weekNo).padStart(2, "0")}`;
}

const GRADE_FAIXAS: Record<string, string[]> = {
  A: ["acima_de_r$1.000.000/mês"],
  B: ["de_r$500.000/mês_a_r$1.000.000/mês"],
  C: ["de_r$100.000/mês_a_r$300.000/mês", "de_r$300.000/mês_a_r$500.000/mês"],
  D: ["de_r$50.000/mês_a_r$75.000/mês", "de_r$75.000/mês_a_r$100.000/mês"],
};

const GRADE_E_FAIXAS = ["até_r$50.000/mês", "ainda_não_faturo_nada"];

function getFaixaGrade(faixa: string | null | undefined): "A" | "B" | "C" | "D" | "E" {
  if (!faixa) return "E";
  const key = faixa.toLowerCase().trim();
  if (GRADE_FAIXAS.A.includes(key)) return "A";
  if (GRADE_FAIXAS.B.includes(key)) return "B";
  if (GRADE_FAIXAS.C.includes(key)) return "C";
  if (GRADE_FAIXAS.D.includes(key)) return "D";
  return "E";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params;

  const searchParams = request.nextUrl.searchParams;
  const dataInicioParam = searchParams.get("dataInicio");
  const dataFimParam = searchParams.get("dataFim");
  const agrupamento = searchParams.get("agrupamento") ?? "mensal";
  const tipoEmpresaFilter = searchParams.get("tipoEmpresa");
  const estadoFilter = searchParams.get("estado");
  const platformFilter = searchParams.get("platform");
  const faixaFilter = searchParams.get("faixaFaturamento");
  const gradeFilter = searchParams.get("grade");
  const fallbackDays = Math.min(365, Math.max(1, parseInt(searchParams.get("periodo") ?? "90", 10) || 90));

  const dataFim = parseDateOnly(dataFimParam) ?? new Date();
  const dataInicio =
    parseDateOnly(dataInicioParam) ??
    new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate() - (fallbackDays - 1));

  const dataInicioStr = formatDateOnly(dataInicio);
  const dataFimStr = formatDateOnly(dataFim);

  const whereBase = {
    clienteId,
    createdTime: {
      gte: new Date(dataInicioStr + "T00:00:00Z"),
      lte: new Date(dataFimStr + "T23:59:59Z"),
    },
  };

  let faixaCondition: Record<string, unknown> = {};
  if (gradeFilter && gradeFilter !== "E") {
    faixaCondition = { faixaFaturamento: { in: GRADE_FAIXAS[gradeFilter] ?? [] } };
  } else if (gradeFilter === "E") {
    faixaCondition = {
      OR: [
        { faixaFaturamento: { in: GRADE_E_FAIXAS } },
        { faixaFaturamento: null },
      ],
    };
  } else if (faixaFilter) {
    faixaCondition = { faixaFaturamento: faixaFilter };
  }

  const whereFiltered = {
    ...whereBase,
    ...(tipoEmpresaFilter ? { tipoEmpresa: tipoEmpresaFilter } : {}),
    ...(estadoFilter ? { estado: estadoFilter } : {}),
    ...(platformFilter ? { platform: platformFilter } : {}),
    ...faixaCondition,
  };

  const LEADS_PAGE_LIMIT = 500;

  const [allLeads, filteredLeadsPage, totalFilteredCount] = await Promise.all([
    prisma.metaLeadIndividual.findMany({
      where: whereBase,
      orderBy: { createdTime: "desc" },
    }),
    prisma.metaLeadIndividual.findMany({
      where: whereFiltered,
      orderBy: { createdTime: "desc" },
      take: LEADS_PAGE_LIMIT,
    }),
    prisma.metaLeadIndividual.count({ where: whereFiltered }),
  ]);

  const filteredLeads = await prisma.metaLeadIndividual.findMany({
    where: whereFiltered,
    orderBy: { createdTime: "desc" },
  });

  const totalLeads = allLeads.length;
  const totalFilteredLeads = filteredLeads.length;
  const campanhasDistintas = new Set(allLeads.map((l) => l.campaignId).filter(Boolean)).size;
  const statusCrmCount = filteredLeads.filter((l) => l.statusCrm).length;

  const tiposCount: Record<string, number> = {};
  for (const lead of filteredLeads) {
    const tipo = lead.tipoEmpresa ?? "Não informado";
    tiposCount[tipo] = (tiposCount[tipo] ?? 0) + 1;
  }

  const estadosCount: Record<string, number> = {};
  for (const lead of filteredLeads) {
    const estado = lead.estado ?? "Outros";
    estadosCount[estado] = (estadosCount[estado] ?? 0) + 1;
  }

  const faturamentoCount: Record<string, number> = {};
  for (const lead of filteredLeads) {
    const faixa = lead.faixaFaturamento ?? "Não informado";
    faturamentoCount[faixa] = (faturamentoCount[faixa] ?? 0) + 1;
  }

  const platformCount: Record<string, number> = {};
  for (const lead of filteredLeads) {
    const plat = lead.platform ?? "Não informado";
    platformCount[plat] = (platformCount[plat] ?? 0) + 1;
  }

  const gradeCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const lead of filteredLeads) {
    const grade = getFaixaGrade(lead.faixaFaturamento);
    gradeCount[grade]++;
  }

  const periodoMap: Record<string, { total: number; tipos: Record<string, number> }> = {};
  for (const lead of filteredLeads) {
    const key = agrupamento === "semanal"
      ? getWeekKey(new Date(lead.createdTime))
      : getMonthKey(new Date(lead.createdTime));
    if (!periodoMap[key]) periodoMap[key] = { total: 0, tipos: {} };
    periodoMap[key].total++;
    const tipo = lead.tipoEmpresa ?? "Não informado";
    periodoMap[key].tipos[tipo] = (periodoMap[key].tipos[tipo] ?? 0) + 1;
  }

  const fatosMidia = await prisma.fatoMidiaDiario.findMany({
    where: {
      clienteId,
      data: {
        gte: new Date(dataInicioStr),
        lte: new Date(dataFimStr),
      },
      canal: "META",
    },
    select: { data: true, investimento: true, leads: true, cpl: true },
  });

  const totalInvestimento = fatosMidia.reduce((sum, f) => sum + Number(f.investimento), 0);
  const cplMedio = totalLeads > 0 && totalInvestimento > 0 ? totalInvestimento / totalLeads : null;

  // Build investimento-per-period map for CPL line
  const investPorPeriodo: Record<string, number> = {};
  for (const f of fatosMidia) {
    const key = agrupamento === "semanal"
      ? getWeekKey(new Date(f.data))
      : getMonthKey(new Date(f.data));
    investPorPeriodo[key] = (investPorPeriodo[key] ?? 0) + Number(f.investimento);
  }

  const periodoSeries = Object.entries(periodoMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, data]) => {
      const invest = investPorPeriodo[periodo] ?? 0;
      const cpl = invest > 0 && data.total > 0 ? Math.round((invest / data.total) * 100) / 100 : null;
      return { periodo, ...data, cpl };
    });

  const campanhasLeadsMap: Record<string, { campaignId: string; campaignName: string | null; leads: number }> = {};
  for (const lead of filteredLeads) {
    if (!lead.campaignId) continue;
    if (!campanhasLeadsMap[lead.campaignId]) {
      campanhasLeadsMap[lead.campaignId] = { campaignId: lead.campaignId, campaignName: lead.campaignName, leads: 0 };
    }
    campanhasLeadsMap[lead.campaignId].leads++;
  }

  const totalLeadsWithCampaign = filteredLeads.filter((l) => l.campaignId).length;

  const campanhasRanking = Object.values(campanhasLeadsMap)
    .map((c) => {
      const participacao = totalFilteredLeads > 0 ? Math.round((c.leads / totalFilteredLeads) * 1000) / 10 : 0;
      const investimentoAtribuidoEst =
        totalLeadsWithCampaign > 0 && totalInvestimento > 0
          ? Math.round(totalInvestimento * (c.leads / totalLeadsWithCampaign) * 100) / 100
          : null;
      return { campaignId: c.campaignId, campaignName: c.campaignName, leads: c.leads, participacao, investimentoAtribuidoEst };
    })
    .sort((a, b) => b.leads - a.leads);

  const leadsList = filteredLeadsPage.map((l) => ({
    id: l.id,
    createdTime: l.createdTime.toISOString(),
    fullName: l.fullName,
    nomeEmpresa: l.nomeEmpresa,
    tipoEmpresa: l.tipoEmpresa,
    faixaFaturamento: l.faixaFaturamento,
    grade: getFaixaGrade(l.faixaFaturamento),
    estado: l.estado,
    campaignName: l.campaignName,
    adName: l.adName,
    adsetName: l.adsetName,
    formName: l.formName,
    platform: l.platform,
    statusCrm: l.statusCrm,
    emailLead: l.emailLead,
    telefone: l.telefone,
  }));

  const GRADE_LABELS: Record<string, string> = {
    A: "Acima de R$ 1M/mês",
    B: "R$ 500k – R$ 1M/mês",
    C: "R$ 100k – R$ 500k/mês",
    D: "R$ 50k – R$ 100k/mês",
    E: "Abaixo de R$ 50k / Não declarado",
  };

  const gradeDistribuicao = ["A", "B", "C", "D", "E"].map((grade) => ({
    grade,
    total: gradeCount[grade] ?? 0,
    label: GRADE_LABELS[grade],
  }));

  return NextResponse.json({
    dataInicio: dataInicioStr,
    dataFim: dataFimStr,
    kpis: {
      totalLeads: totalFilteredLeads,
      totalLeadsAll: totalLeads,
      campanhasDistintas,
      statusCrmCount,
      totalInvestimento,
      cplMedio,
    },
    periodoSeries,
    tiposDistribuicao: Object.entries(tiposCount)
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total),
    estadosDistribuicao: Object.entries(estadosCount)
      .map(([estado, total]) => ({ estado, total }))
      .sort((a, b) => b.total - a.total),
    faturamentoDistribuicao: Object.entries(faturamentoCount)
      .map(([faixa, total]) => ({ faixa, total }))
      .sort((a, b) => b.total - a.total),
    platformDistribuicao: Object.entries(platformCount)
      .map(([platform, total]) => ({ platform, total }))
      .sort((a, b) => b.total - a.total),
    gradeDistribuicao,
    campanhasRanking,
    leads: leadsList,
    leadsTruncated: totalFilteredCount > LEADS_PAGE_LIMIT,
    totalFilteredCount,
    agrupamento,
    activeFilters: {
      tipoEmpresa: tipoEmpresaFilter,
      estado: estadoFilter,
      platform: platformFilter,
      faixaFaturamento: faixaFilter,
      grade: gradeFilter,
    },
  });
}
