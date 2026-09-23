import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { fetchAccountBalance } from "@/lib/meta/metaClient";
import { fetchAccountBudget } from "@/lib/googleAds/googleAdsClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canal = request.nextUrl.searchParams.get("canal") as "meta" | "google" | null;

  if (!canal || !["meta", "google"].includes(canal)) {
    return NextResponse.json({ saldo: null, motivo: "Canal inválido" }, { status: 400 });
  }

  const plataforma = canal === "meta" ? "META" : "GOOGLE_ADS";

  const [conta, cliente] = await Promise.all([
    prisma.conta.findFirst({ where: { clienteId: id, plataforma } }),
    prisma.cliente.findUnique({
      where: { id },
      select: { orcamentoMidiaGoogleMensal: true, orcamentoMidiaMetaMensal: true },
    }),
  ]);

  if (canal === "meta") {
    if (!conta?.accountIdPlataforma) {
      return NextResponse.json({ saldo: null, motivo: "Conta não configurada" });
    }
    const config = await getIntegrationsConfig();
    const token = config.metaAccessToken;
    if (!token) {
      return NextResponse.json({ saldo: null, motivo: "Token Meta não configurado" });
    }
    try {
      const balance = await fetchAccountBalance(conta.accountIdPlataforma, token);
      return NextResponse.json({
        saldo: balance.balance,
        moeda: balance.currency,
        spendCap: balance.spendCap,
      });
    } catch (e) {
      return NextResponse.json({
        saldo: null,
        motivo: e instanceof Error ? e.message : "Erro ao buscar saldo Meta",
      });
    }
  }

  if (canal === "google") {
    const orcamento = cliente?.orcamentoMidiaGoogleMensal != null
      ? Number(cliente.orcamentoMidiaGoogleMensal)
      : null;

    // Calcula gasto do mês atual no DB
    const now = new Date();
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const gastoMes = await prisma.fatoMidiaDiario.aggregate({
      _sum: { investimento: true },
      where: {
        clienteId: id,
        canal: "GOOGLE",
        data: { gte: mesInicio, lte: mesFim },
      },
    });
    const investido = Number(gastoMes._sum.investimento ?? 0);

    // Tenta buscar budget via API do Google Ads (só se conta configurada)
    if (conta?.accountIdPlataforma) {
      try {
        const budget = await fetchAccountBudget(
          conta.accountIdPlataforma,
          conta.googleAdsLoginCustomerId
        );
        if (budget && (budget.approvedSpendingLimit ?? 0) > 0) {
          return NextResponse.json({
            saldo: budget.remaining,
            totalAprovado: budget.approvedSpendingLimit,
            utilizado: budget.amountServed,
            moeda: budget.currency,
            fonte: "account_budget",
          });
        }
      } catch {
        // sem account_budget — usa fallback abaixo
      }
    }

    // Fallback 1: orçamento mensal do cliente - investimento do mês atual
    if (orcamento != null && orcamento > 0) {
      const remaining = Math.max(0, orcamento - investido);
      return NextResponse.json({
        saldo: remaining,
        totalAprovado: orcamento,
        utilizado: investido,
        moeda: "BRL",
        fonte: "orcamento_mensal",
      });
    }

    // Fallback 2: se há gasto no mês, exibe como investimento (sem saldo definido)
    if (investido > 0) {
      return NextResponse.json({
        saldo: null,
        utilizado: investido,
        moeda: "BRL",
        fonte: "gasto_mes",
        motivo: "Sem orçamento configurado — exibindo investimento do mês",
      });
    }

    return NextResponse.json({
      saldo: null,
      motivo: "Configure o orçamento mensal do Google no cadastro do cliente",
    });
  }
}
