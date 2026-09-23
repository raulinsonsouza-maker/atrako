import { NextRequest, NextResponse } from "next/server";
import { endOfWeek, format, getISOWeek, getYear, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { findClienteById } from "@/lib/repositories/clientesRepository";
import { findFatosByClienteAndPeriod } from "@/lib/repositories/fatosMidiaRepository";
import { isTertulia } from "@/lib/clientProfiles";

function parseDateOnly(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDerivedMetrics(values: {
  investimento: number;
  impressoes: number;
  cliquesDelivery: number;
  conversasWhatsapp: number;
  intencoesPedido: number;
}) {
  const { investimento, impressoes, cliquesDelivery, conversasWhatsapp, intencoesPedido } = values;

  return {
    ctr: impressoes > 0 ? (cliquesDelivery / impressoes) * 100 : 0,
    cpcDelivery: cliquesDelivery > 0 ? investimento / cliquesDelivery : 0,
    custoPorConversa: conversasWhatsapp > 0 ? investimento / conversasWhatsapp : 0,
    custoPorIntencao: intencoesPedido > 0 ? investimento / intencoesPedido : 0,
    shareWhatsapp: intencoesPedido > 0 ? (conversasWhatsapp / intencoesPedido) * 100 : 0,
    shareDelivery: intencoesPedido > 0 ? (cliquesDelivery / intencoesPedido) * 100 : 0,
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
  if (!isTertulia(cliente)) {
    return NextResponse.json({ error: "Painel especial indisponível para este cliente" }, { status: 404 });
  }

  const canalFilter = canal === "geral" ? undefined : canal.toUpperCase();
  const fatos = await findFatosByClienteAndPeriod(id, dataInicio, dataFim, canalFilter);

  const resumo = fatos.reduce(
    (acc, fato) => {
      acc.investimento += Number(fato.investimento);
      acc.impressoes += fato.impressoes;
      acc.cliquesDelivery += fato.cliques;
      acc.conversasWhatsapp += fato.messagingConversationsStarted;
      acc.leadsFormulario += fato.onFacebookLeads + fato.websiteLeads;
      acc.intencoesPedido += fato.cliques + fato.messagingConversationsStarted;
      return acc;
    },
    {
      investimento: 0,
      impressoes: 0,
      cliquesDelivery: 0,
      conversasWhatsapp: 0,
      leadsFormulario: 0,
      intencoesPedido: 0,
    }
  );

  type BucketEntry = {
    periodo: string;
    inicio: Date;
    investimento: number;
    impressoes: number;
    cliquesDelivery: number;
    conversasWhatsapp: number;
    leadsFormulario: number;
    intencoesPedido: number;
  };

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
      existing.cliquesDelivery += fato.cliques;
      existing.conversasWhatsapp += fato.messagingConversationsStarted;
      existing.leadsFormulario += fato.onFacebookLeads + fato.websiteLeads;
      existing.intencoesPedido += fato.cliques + fato.messagingConversationsStarted;
    } else {
      byBucket.set(key, {
        periodo: periodoLabel,
        inicio,
        investimento: Number(fato.investimento),
        impressoes: fato.impressoes,
        cliquesDelivery: fato.cliques,
        conversasWhatsapp: fato.messagingConversationsStarted,
        leadsFormulario: fato.onFacebookLeads + fato.websiteLeads,
        intencoesPedido: fato.cliques + fato.messagingConversationsStarted,
      });
    }
  }

  const series = Array.from(byBucket.values())
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((bucket) => ({
      ...bucket,
      ...buildDerivedMetrics(bucket),
    }));

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
  });
}
