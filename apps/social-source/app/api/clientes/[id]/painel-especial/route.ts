import { NextRequest, NextResponse } from "next/server";
import { startOfWeek, endOfWeek, getISOWeek, getYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { findFatosByClienteAndPeriod } from "@/lib/repositories/fatosMidiaRepository";
import { isHotelFazendaSaoJoao } from "@/lib/clientProfiles";

function parseDateOnly(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDerivedMetrics(values: {
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  purchases: number;
  faturamento: number;
}) {
  const { investimento, impressoes, cliques, leads, purchases, faturamento } = values;

  return {
    cpl: leads > 0 ? investimento / leads : 0,
    cpa: purchases > 0 ? investimento / purchases : 0,
    roas: investimento > 0 ? faturamento / investimento : 0,
    ticketMedio: purchases > 0 ? faturamento / purchases : 0,
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    taxaVendaLead: leads > 0 ? (purchases / leads) * 100 : 0,
    taxaVendaClique: cliques > 0 ? (purchases / cliques) * 100 : 0,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canal = request.nextUrl.searchParams.get("canal") ?? "geral";
  const agrupamento = request.nextUrl.searchParams.get("agrupamento") ?? "semanal";
  const periodo = request.nextUrl.searchParams.get("periodo") ?? "90";
  const dataInicioParam = request.nextUrl.searchParams.get("dataInicio");
  const dataFimParam = request.nextUrl.searchParams.get("dataFim");
  const diasFallback = Math.min(365, Math.max(7, parseInt(periodo, 10) || 90));

  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasFallback);

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
  if (!isHotelFazendaSaoJoao(cliente)) {
    return NextResponse.json({ error: "Painel especial indisponível para este cliente" }, { status: 404 });
  }

  const canalFilter = canal === "geral" ? undefined : canal.toUpperCase();
  const fatos = await findFatosByClienteAndPeriod(id, dataInicio, dataFim, canalFilter);

  const resumo = fatos.reduce(
    (acc, fato) => {
      acc.investimento += Number(fato.investimento);
      acc.impressoes += fato.impressoes;
      acc.cliques += fato.cliques;
      acc.leads += fato.leads;
      acc.onFacebookLeads += fato.onFacebookLeads;
      acc.websiteLeads += fato.websiteLeads;
      acc.messagingConversationsStarted += fato.messagingConversationsStarted;
      acc.contacts += fato.contacts;
      acc.purchases += fato.purchases;
      acc.faturamento += Number(fato.websitePurchasesConversionValue);
      return acc;
    },
    {
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      leads: 0,
      onFacebookLeads: 0,
      websiteLeads: 0,
      messagingConversationsStarted: 0,
      contacts: 0,
      purchases: 0,
      faturamento: 0,
    }
  );

  type BucketEntry = {
    periodo: string;
    inicio: Date;
    investimento: number;
    impressoes: number;
    cliques: number;
    leads: number;
    onFacebookLeads: number;
    websiteLeads: number;
    messagingConversationsStarted: number;
    contacts: number;
    purchases: number;
    faturamento: number;
  };

  const byBucket = new Map<string, BucketEntry>();

  for (const fato of fatos) {
    const data = new Date(fato.data);
    const investimento = Number(fato.investimento);
    const faturamento = Number(fato.websitePurchasesConversionValue);

    let key: string;
    let periodo: string;
    let inicio: Date;

    if (agrupamento === "mensal") {
      inicio = new Date(data.getFullYear(), data.getMonth(), 1);
      key = format(inicio, "yyyy-MM");
      periodo = format(inicio, "MMM/yy", { locale: ptBR });
    } else if (agrupamento === "diario") {
      inicio = new Date(data.getFullYear(), data.getMonth(), data.getDate());
      key = format(inicio, "yyyy-MM-dd");
      periodo = `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
    } else {
      inicio = startOfWeek(data, { weekStartsOn: 1 });
      const fim = endOfWeek(data, { weekStartsOn: 1 });
      key = `${getYear(inicio)}-W${getISOWeek(inicio)}`;
      periodo = `${inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}-${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    }

    const existing = byBucket.get(key);
    if (existing) {
      existing.investimento += investimento;
      existing.impressoes += fato.impressoes;
      existing.cliques += fato.cliques;
      existing.leads += fato.leads;
      existing.onFacebookLeads += fato.onFacebookLeads;
      existing.websiteLeads += fato.websiteLeads;
      existing.messagingConversationsStarted += fato.messagingConversationsStarted;
      existing.contacts += fato.contacts;
      existing.purchases += fato.purchases;
      existing.faturamento += faturamento;
    } else {
      byBucket.set(key, {
        periodo,
        inicio,
        investimento,
        impressoes: fato.impressoes,
        cliques: fato.cliques,
        leads: fato.leads,
        onFacebookLeads: fato.onFacebookLeads,
        websiteLeads: fato.websiteLeads,
        messagingConversationsStarted: fato.messagingConversationsStarted,
        contacts: fato.contacts,
        purchases: fato.purchases,
        faturamento,
      });
    }
  }

  const series = Array.from(byBucket.values())
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((bucket) => ({
      ...bucket,
      ...buildDerivedMetrics(bucket),
    }));

  // Group by campaign name — only campaigns that generated at least 1 sale
  const byCampanha = new Map<string, { investimento: number; purchases: number; faturamento: number }>();
  for (const fato of fatos) {
    if (!fato.purchases) continue;
    const nome = fato.campaignName.trim() || "Campanha sem nome";
    const existing = byCampanha.get(nome);
    if (existing) {
      existing.investimento += Number(fato.investimento);
      existing.purchases += fato.purchases;
      existing.faturamento += Number(fato.websitePurchasesConversionValue);
    } else {
      byCampanha.set(nome, {
        investimento: Number(fato.investimento),
        purchases: fato.purchases,
        faturamento: Number(fato.websitePurchasesConversionValue),
      });
    }
  }

  const campanhas = Array.from(byCampanha.entries())
    .map(([nome, v]) => ({
      nome,
      investimento: v.investimento,
      vendas: v.purchases,
      faturamento: v.faturamento,
      custoporVenda: v.purchases > 0 ? v.investimento / v.purchases : 0,
      ticketMedio: v.purchases > 0 ? v.faturamento / v.purchases : 0,
    }))
    .filter((c) => c.faturamento > 0)
    .sort((a, b) => b.faturamento - a.faturamento);

  const diasSelecionados = Math.max(
    1,
    Math.floor((dataFim.getTime() - dataInicio.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  return NextResponse.json({
    clienteId: id,
    canal,
    agrupamento,
    periodo: `${diasSelecionados} dias`,
    resumo: {
      ...resumo,
      ...buildDerivedMetrics(resumo),
    },
    series,
    campanhas,
    leadMix: {
      onFacebookLeads: resumo.onFacebookLeads,
      websiteLeads: resumo.websiteLeads,
      messagingConversationsStarted: resumo.messagingConversationsStarted,
      contacts: resumo.contacts,
    },
  });
}
