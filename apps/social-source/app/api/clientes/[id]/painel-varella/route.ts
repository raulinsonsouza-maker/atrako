import { NextRequest, NextResponse } from "next/server";
import { endOfWeek, format, getISOWeek, getYear, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isVarellaMotos } from "@/lib/clientProfiles";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { findFatosByClienteAndPeriod } from "@/lib/repositories/fatosMidiaRepository";

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
  purchases: number;
  faturamento: number;
}) {
  const { investimento, impressoes, cliques, purchases, faturamento } = values;

  return {
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpc: cliques > 0 ? investimento / cliques : 0,
    cpa: purchases > 0 ? investimento / purchases : 0,
    roas: investimento > 0 ? faturamento / investimento : 0,
    ticketMedio: purchases > 0 ? faturamento / purchases : 0,
    taxaConversaoClique: cliques > 0 ? (purchases / cliques) * 100 : 0,
  };
}

type Accumulator = {
  investimento: number;
  impressoes: number;
  cliques: number;
  purchases: number;
  faturamento: number;
  conversasWhatsapp: number;
  alcance: number;
  checkoutIniciado: number;
};

function createAccumulator(): Accumulator {
  return {
    investimento: 0,
    impressoes: 0,
    cliques: 0,
    purchases: 0,
    faturamento: 0,
    conversasWhatsapp: 0,
    alcance: 0,
    checkoutIniciado: 0,
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
  if (!isVarellaMotos(cliente)) {
    return NextResponse.json({ error: "Painel especial indisponível para este cliente" }, { status: 404 });
  }

  const canalFilter = canal === "geral" ? undefined : canal.toUpperCase();
  const fatos = await findFatosByClienteAndPeriod(id, dataInicio, dataFim, canalFilter);

  const resumo = fatos.reduce((acc, fato) => {
    acc.investimento += Number(fato.investimento);
    acc.impressoes += fato.impressoes;
    acc.cliques += fato.cliques;
    acc.purchases += fato.purchases;
    acc.faturamento += Number(fato.websitePurchasesConversionValue);
    acc.conversasWhatsapp += fato.messagingConversationsStarted;
    acc.alcance += fato.alcance;
    acc.checkoutIniciado += fato.checkoutIniciado;
    return acc;
  }, createAccumulator());

  type BucketEntry = Accumulator & { periodo: string; inicio: Date };

  const byBucket = new Map<string, BucketEntry>();

  for (const fato of fatos) {
    const data = new Date(fato.data);
    let key: string;
    let periodoLabel: string;
    let inicio: Date;

    if (agrupamento === "mensal") {
      inicio = new Date(data.getFullYear(), data.getMonth(), 1);
      key = format(inicio, "yyyy-MM");
      periodoLabel = format(inicio, "MMM/yy", { locale: ptBR });
    } else if (agrupamento === "diario") {
      inicio = new Date(data.getFullYear(), data.getMonth(), data.getDate());
      key = format(inicio, "yyyy-MM-dd");
      periodoLabel = `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
    } else {
      inicio = startOfWeek(data, { weekStartsOn: 1 });
      const fim = endOfWeek(data, { weekStartsOn: 1 });
      key = `${getYear(inicio)}-W${getISOWeek(inicio)}`;
      periodoLabel = `${inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}-${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    }

    const existing = byBucket.get(key);
    if (existing) {
      existing.investimento += Number(fato.investimento);
      existing.impressoes += fato.impressoes;
      existing.cliques += fato.cliques;
      existing.purchases += fato.purchases;
      existing.faturamento += Number(fato.websitePurchasesConversionValue);
      existing.conversasWhatsapp += fato.messagingConversationsStarted;
      existing.alcance += fato.alcance;
      existing.checkoutIniciado += fato.checkoutIniciado;
    } else {
      byBucket.set(key, {
        periodo: periodoLabel,
        inicio,
        investimento: Number(fato.investimento),
        impressoes: fato.impressoes,
        cliques: fato.cliques,
        purchases: fato.purchases,
        faturamento: Number(fato.websitePurchasesConversionValue),
        conversasWhatsapp: fato.messagingConversationsStarted,
        alcance: fato.alcance,
        checkoutIniciado: fato.checkoutIniciado,
      });
    }
  }

  const series = Array.from(byBucket.values())
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((bucket) => ({
      ...bucket,
      ...buildDerivedMetrics(bucket),
    }));

  const mixBaseFacts = await findFatosByClienteAndPeriod(id, dataInicio, dataFim);
  const channelMixMap = mixBaseFacts.reduce(
    (acc, fato) => {
      const channel = fato.canal === "GOOGLE" ? "google" : "meta";
      acc[channel].investimento += Number(fato.investimento);
      acc[channel].cliques += fato.cliques;
      acc[channel].purchases += fato.purchases;
      acc[channel].faturamento += Number(fato.websitePurchasesConversionValue);
      return acc;
    },
    {
      meta: { investimento: 0, cliques: 0, purchases: 0, faturamento: 0 },
      google: { investimento: 0, cliques: 0, purchases: 0, faturamento: 0 },
    }
  );

  const totalInvestimentoMix = channelMixMap.meta.investimento + channelMixMap.google.investimento;
  const totalPurchasesMix = channelMixMap.meta.purchases + channelMixMap.google.purchases;
  const totalFaturamentoMix = channelMixMap.meta.faturamento + channelMixMap.google.faturamento;
  const withShare = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

  const roas = (inv: number, fat: number) => (inv > 0 ? fat / inv : 0);
  const cpc = (inv: number, cliques: number) => (cliques > 0 ? inv / cliques : 0);

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
    channelMix: {
      meta: {
        ...channelMixMap.meta,
        investimentoShare: withShare(channelMixMap.meta.investimento, totalInvestimentoMix),
        purchasesShare: withShare(channelMixMap.meta.purchases, totalPurchasesMix),
        faturamentoShare: withShare(channelMixMap.meta.faturamento, totalFaturamentoMix),
        roas: roas(channelMixMap.meta.investimento, channelMixMap.meta.faturamento),
        cpc: cpc(channelMixMap.meta.investimento, channelMixMap.meta.cliques),
      },
      google: {
        ...channelMixMap.google,
        investimentoShare: withShare(channelMixMap.google.investimento, totalInvestimentoMix),
        purchasesShare: withShare(channelMixMap.google.purchases, totalPurchasesMix),
        faturamentoShare: withShare(channelMixMap.google.faturamento, totalFaturamentoMix),
        roas: roas(channelMixMap.google.investimento, channelMixMap.google.faturamento),
        cpc: cpc(channelMixMap.google.investimento, channelMixMap.google.cliques),
      },
    },
  });
}
