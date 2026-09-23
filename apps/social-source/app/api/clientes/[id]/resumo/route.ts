import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { outcomeCountForFato } from "@/lib/metrics/fatoMidiaOutcome";
import { isFlorien, isDor, isGranarolo, isKombucha, isBeBlueSchool, isAcademyAmericana, isClinicaESpa, isImobClient } from "@/lib/clientProfiles";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canal = request.nextUrl.searchParams.get("canal") ?? "geral";
  const periodo = request.nextUrl.searchParams.get("periodo") ?? "30"; // dias
  const dataInicioParam = request.nextUrl.searchParams.get("dataInicio");
  const dataFimParam = request.nextUrl.searchParams.get("dataFim");

  const diasFallback = Math.min(365, Math.max(7, parseInt(periodo, 10) || 30));
  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasFallback);

  const parseDateOnly = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    const parsed = new Date(y, m - 1, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  if (dataInicioParam && dataFimParam) {
    const parsedInicio = parseDateOnly(dataInicioParam);
    const parsedFim = parseDateOnly(dataFimParam);
    if (parsedInicio && parsedFim && parsedInicio <= parsedFim) {
      dataInicio.setTime(parsedInicio.getTime());
      dataFim.setTime(parsedFim.getTime());
      dataFim.setHours(23, 59, 59, 999);
    }
  }

  const cliente = await findClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const rows = await prisma.fatoMidiaDiario.findMany({
    where: {
      clienteId: id,
      data: { gte: dataInicio, lte: dataFim },
      ...(canal !== "geral" ? { canal: canal.toUpperCase() } : {}),
    },
    select: {
      canal: true,
      leads: true,
      conversoes: true,
      investimento: true,
      impressoes: true,
      cliques: true,
      messagingConversationsStarted: true,
      profileVisits: true,
      purchases: true,
      websitePurchasesConversionValue: true,
      addToCart: true,
      landingPageViews: true,
      campaignName: true,
    },
  });

  const isVisitasCliente = isFlorien(cliente);
  const isComprasCliente = isDor(cliente) || isGranarolo(cliente);
  const isKombuchaCliente = isKombucha(cliente);
  const isBeBlueCliente = isBeBlueSchool(cliente);
  const isAcademyCliente = isAcademyAmericana(cliente);
  const isConversasCliente = isClinicaESpa(cliente) && !isImobClient(cliente);

  let totalInvestimento = 0;
  let totalLeads = 0;
  let totalImpressoes = 0;
  let totalCliques = 0;
  let totalConversas = 0;
  let totalPurchases = 0;
  let totalValorConversao = 0;
  let totalProfileVisits = 0;
  let totalAddToCart = 0;
  let totalLandingPageViews = 0;

  // 2-pass grouping by campaign to correctly attribute investment per objective.
  // Applies to all clients: a campaign is classified by its primary result type.
  // This ensures days with $0 results still count toward cost-per-result (campaigns spend on zero-result days).
  let investimentoLeads = 0;
  let investimentoProfileVisits = 0;
  let investimentoConversas = 0;
  {
    type CampAgg = { leads: number; pv: number; conversas: number; inv: number };
    const bycamp = new Map<string, CampAgg>();
    for (const r of rows) {
      const cn = (r as { campaignName?: string }).campaignName ?? "";
      const existing = bycamp.get(cn) ?? { leads: 0, pv: 0, conversas: 0, inv: 0 };
      bycamp.set(cn, {
        leads: existing.leads + r.leads,
        pv: existing.pv + ((r as { profileVisits?: number }).profileVisits ?? 0),
        conversas: existing.conversas + (r.messagingConversationsStarted ?? 0),
        inv: existing.inv + Number(r.investimento),
      });
    }
    for (const totals of bycamp.values()) {
      if (totals.leads > 0) investimentoLeads += totals.inv;
      if (totals.pv > 0) investimentoProfileVisits += totals.inv;
      if (totals.conversas > 0) investimentoConversas += totals.inv;
    }
  }

  for (const r of rows) {
    const inv = Number(r.investimento);
    totalInvestimento += inv;
    totalConversas += r.messagingConversationsStarted ?? 0;
    const pv = (r as { profileVisits?: number }).profileVisits ?? 0;
    totalProfileVisits += pv;
    totalAddToCart += (r as { addToCart?: number }).addToCart ?? 0;
    totalLandingPageViews += (r as { landingPageViews?: number }).landingPageViews ?? 0;
    totalLeads += isVisitasCliente && r.canal !== "GOOGLE"
      ? pv
      : isKombuchaCliente && r.canal !== "GOOGLE"
        ? ((r as { addToCart?: number }).addToCart ?? 0)
        : isBeBlueCliente && r.canal !== "GOOGLE"
          ? ((r as { landingPageViews?: number }).landingPageViews ?? 0)
          : isConversasCliente && r.canal !== "GOOGLE"
            ? (r.messagingConversationsStarted ?? 0)
            : outcomeCountForFato(r.canal, r.leads, r.conversoes, undefined, isComprasCliente && r.canal !== "GOOGLE");
    totalImpressoes += r.impressoes;
    totalCliques += r.cliques;
    totalPurchases += r.purchases ?? 0;
    totalValorConversao += Number(r.websitePurchasesConversionValue ?? 0);
  }
  // Use per-objective investment for all clients to avoid cross-campaign cost dilution
  const investimentoParaCpl = isConversasCliente
    ? (investimentoConversas > 0 ? investimentoConversas : totalInvestimento)
    : (investimentoLeads > 0 ? investimentoLeads : totalInvestimento);
  const investimentoParaVisita = investimentoProfileVisits > 0 ? investimentoProfileVisits : totalInvestimento;
  const investimentoParaConversa = investimentoConversas > 0 ? investimentoConversas : totalInvestimento;
  const cpl = totalLeads > 0 ? investimentoParaCpl / totalLeads : 0;
  const custoPorVisita = totalProfileVisits > 0 ? investimentoParaVisita / totalProfileVisits : 0;
  const cpm = totalImpressoes > 0 ? (totalInvestimento / totalImpressoes) * 1000 : 0;
  const custoPorConversa = totalConversas > 0 ? investimentoParaConversa / totalConversas : 0;
  const custoPorCompra = totalPurchases > 0 ? totalInvestimento / totalPurchases : 0;
  const roas = totalInvestimento > 0 ? totalValorConversao / totalInvestimento : 0;
  const ticketMedio = totalPurchases > 0 ? totalValorConversao / totalPurchases : 0;
  const diasSelecionados = Math.max(
    1,
    Math.floor((dataFim.getTime() - dataInicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  const lastFatoRow = await prisma.fatoMidiaDiario.findFirst({
    where: { clienteId: id },
    orderBy: { data: "desc" },
    select: { data: true },
  });

  return NextResponse.json({
    clienteId: id,
    periodo: `${diasSelecionados} dias`,
    lastFatoDate: lastFatoRow?.data ?? null,
    investimento: Math.round(totalInvestimento * 100) / 100,
    leads: totalLeads,
    impressoes: totalImpressoes,
    cliques: totalCliques,
    cpl: Math.round(cpl * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    messagingConversationsStarted: totalConversas,
    custoPorConversa: Math.round(custoPorConversa * 100) / 100,
    purchases: totalPurchases,
    valorConversao: Math.round(totalValorConversao * 100) / 100,
    custoPorCompra: Math.round(custoPorCompra * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    profileVisits: totalProfileVisits,
    custoPorVisita: Math.round(custoPorVisita * 100) / 100,
    addToCart: totalAddToCart,
    landingPageViews: totalLandingPageViews,
  });
}
