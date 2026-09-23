/**
 * Valida se os dados do painel Varella Motos batem com a planilha Adveronix (Meta).
 * Planilha: 01/01/2025 em diante
 *
 * Amostra Adveronix (01-06 jan 2025):
 * Day | Impressions | Amount Spent | Link Clicks | Messaging | Purchases | Conv Value | Checkout
 * 2025-01-01 | 86761 | 239,74 | 515 | 1 | 0 | 0 | 0
 * 2025-01-02 | 105292 | 480,17 | 595 | 45 | 9 | 4928,1 | 16
 * 2025-01-03 | 88665 | 455,49 | 565 | 73 | 3 | 2112,31 | 6
 * 2025-01-04 | 90726 | 453,1 | 647 | 27 | 1 | 429,05 | 2
 * 2025-01-05 | 85807 | 342,12 | 569 | 82 | 1 | 547,07 | 2
 * 2025-01-06 | 83946 | 429,2 | 569 | 41 | 3 | 1809,98 | 5
 */

import { prisma } from "../lib/db";
import { isVarellaMotos } from "../lib/clientProfiles";

const DATA_INICIO = new Date("2025-01-01");
const DATA_FIM = new Date();
DATA_FIM.setHours(23, 59, 59, 999);

const ADVERONIX_AMOSTRA: Record<string, { impressoes: number; investimento: number; cliques: number; conversasWhatsapp: number; purchases: number; faturamento: number; checkoutIniciado: number }> = {
  "2025-01-01": { impressoes: 86761, investimento: 239.74, cliques: 515, conversasWhatsapp: 1, purchases: 0, faturamento: 0, checkoutIniciado: 0 },
  "2025-01-02": { impressoes: 105292, investimento: 480.17, cliques: 595, conversasWhatsapp: 45, purchases: 9, faturamento: 4928.1, checkoutIniciado: 16 },
  "2025-01-03": { impressoes: 88665, investimento: 455.49, cliques: 565, conversasWhatsapp: 73, purchases: 3, faturamento: 2112.31, checkoutIniciado: 6 },
  "2025-01-04": { impressoes: 90726, investimento: 453.1, cliques: 647, conversasWhatsapp: 27, purchases: 1, faturamento: 429.05, checkoutIniciado: 2 },
  "2025-01-05": { impressoes: 85807, investimento: 342.12, cliques: 569, conversasWhatsapp: 82, purchases: 1, faturamento: 547.07, checkoutIniciado: 2 },
  "2025-01-06": { impressoes: 83946, investimento: 429.2, cliques: 569, conversasWhatsapp: 41, purchases: 3, faturamento: 1809.98, checkoutIniciado: 5 },
};

async function main() {
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    include: { contas: true },
  });

  const varella = clientes.find((c) => isVarellaMotos(c));
  if (!varella) {
    console.error("Cliente Varella Motos não encontrado.");
    process.exit(1);
  }

  const fatos = await prisma.fatoMidiaDiario.findMany({
    where: {
      clienteId: varella.id,
      canal: "META",
      data: { gte: DATA_INICIO, lte: DATA_FIM },
    },
    orderBy: { data: "asc" },
  });

  const fatosByDate = new Map<string, (typeof fatos)[0]>();
  for (const f of fatos) {
    const key = f.data.toISOString().slice(0, 10);
    fatosByDate.set(key, f);
  }

  const formatNum = (n: number) => n.toLocaleString("pt-BR");
  const formatCurr = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  console.log("\n=== VALIDAÇÃO VARELLA MOTOS vs ADVERONIX (Meta desde 01/01/2025) ===\n");
  console.log("--- Comparação dia a dia (amostra 01-06 jan 2025) ---\n");

  let totalOk = 0;
  let totalComparacoes = 0;

  for (const [dateKey, adver] of Object.entries(ADVERONIX_AMOSTRA)) {
    const fato = fatosByDate.get(dateKey);
    if (!fato) {
      console.log(`✗ ${dateKey} | Inout: SEM DADOS | Adveronix: Imp=${formatNum(adver.impressoes)} Cliques=${formatNum(adver.cliques)} Comp=${adver.purchases}`);
      totalComparacoes++;
      continue;
    }

    const inout = {
      impressoes: fato.impressoes,
      investimento: Number(fato.investimento),
      cliques: fato.cliques,
      conversasWhatsapp: fato.messagingConversationsStarted,
      purchases: fato.purchases,
      faturamento: Number(fato.websitePurchasesConversionValue),
      checkoutIniciado: fato.checkoutIniciado,
    };

    const diffs = [
      Math.abs(inout.impressoes - adver.impressoes) < 5,
      Math.abs(inout.investimento - adver.investimento) < 0.5,
      Math.abs(inout.cliques - adver.cliques) < 5,
      Math.abs(inout.conversasWhatsapp - adver.conversasWhatsapp) < 5,
      Math.abs(inout.purchases - adver.purchases) < 2,
      Math.abs(inout.faturamento - adver.faturamento) < 1,
      Math.abs(inout.checkoutIniciado - adver.checkoutIniciado) < 2,
    ];
    const ok = diffs.every(Boolean);
    if (ok) totalOk++;

    const status = ok ? "✓" : "✗";
    console.log(`${status} ${dateKey} | Imp: ${formatNum(inout.impressoes)}/${formatNum(adver.impressoes)} | Cliques: ${inout.cliques}/${adver.cliques} | Comp: ${inout.purchases}/${adver.purchases} | Checkout: ${inout.checkoutIniciado}/${adver.checkoutIniciado}`);
    totalComparacoes++;
  }

  const datasAmostra = Object.keys(ADVERONIX_AMOSTRA);
  const resumoAmostra = fatos
    .filter((f) => datasAmostra.includes(f.data.toISOString().slice(0, 10)))
    .reduce(
      (acc, f) => {
        acc.impressoes += f.impressoes;
        acc.investimento += Number(f.investimento);
        acc.cliques += f.cliques;
        acc.conversasWhatsapp += f.messagingConversationsStarted;
        acc.purchases += f.purchases;
        acc.faturamento += Number(f.websitePurchasesConversionValue);
        acc.checkoutIniciado += f.checkoutIniciado;
        acc.alcance += f.alcance;
        return acc;
      },
      { impressoes: 0, investimento: 0, cliques: 0, conversasWhatsapp: 0, purchases: 0, faturamento: 0, checkoutIniciado: 0, alcance: 0 }
    );

  const resumoTotal = fatos.reduce(
    (acc, f) => {
      acc.impressoes += f.impressoes;
      acc.investimento += Number(f.investimento);
      acc.cliques += f.cliques;
      acc.conversasWhatsapp += f.messagingConversationsStarted;
      acc.purchases += f.purchases;
      acc.faturamento += Number(f.websitePurchasesConversionValue);
      acc.checkoutIniciado += f.checkoutIniciado;
      acc.alcance += f.alcance;
      acc.dias++;
      return acc;
    },
    { impressoes: 0, investimento: 0, cliques: 0, conversasWhatsapp: 0, purchases: 0, faturamento: 0, checkoutIniciado: 0, alcance: 0, dias: 0 }
  );

  const adveronixAmostraSoma = Object.values(ADVERONIX_AMOSTRA).reduce(
    (acc, a) => {
      acc.impressoes += a.impressoes;
      acc.investimento += a.investimento;
      acc.cliques += a.cliques;
      acc.conversasWhatsapp += a.conversasWhatsapp;
      acc.purchases += a.purchases;
      acc.faturamento += a.faturamento;
      acc.checkoutIniciado += a.checkoutIniciado;
      return acc;
    },
    { impressoes: 0, investimento: 0, cliques: 0, conversasWhatsapp: 0, purchases: 0, faturamento: 0, checkoutIniciado: 0 }
  );

  console.log("\n--- Soma amostra 01-06 jan 2025 ---\n");

  const compare = (label: string, inout: number, adver: number, isCurrency = false) => {
    const fmt = isCurrency ? formatCurr : formatNum;
    const diff = inout - adver;
    const diffPct = adver > 0 ? ((diff / adver) * 100).toFixed(1) : "N/A";
    const ok = Math.abs(diff) < (isCurrency ? 1 : 10);
    const status = ok ? "✓" : "✗";
    console.log(`${status} ${label.padEnd(30)} Inout: ${fmt(inout).padStart(15)} | Adveronix: ${fmt(adver).padStart(15)} | Diff: ${fmt(diff)} (${diffPct}%)`);
  };

  compare("Impressões", resumoAmostra.impressoes, adveronixAmostraSoma.impressoes);
  compare("Investimento (R$)", resumoAmostra.investimento, adveronixAmostraSoma.investimento, true);
  compare("Cliques", resumoAmostra.cliques, adveronixAmostraSoma.cliques);
  compare("Conversas WhatsApp", resumoAmostra.conversasWhatsapp, adveronixAmostraSoma.conversasWhatsapp);
  compare("Compras", resumoAmostra.purchases, adveronixAmostraSoma.purchases);
  compare("Faturamento (R$)", resumoAmostra.faturamento, adveronixAmostraSoma.faturamento, true);
  compare("Checkout Iniciado", resumoAmostra.checkoutIniciado, adveronixAmostraSoma.checkoutIniciado);

  console.log(`\n   Alcance (Reach) na amostra: ${formatNum(resumoAmostra.alcance)}`);
  console.log(`   Total Inout (período completo): ${formatNum(resumoTotal.impressoes)} imp | ${formatCurr(resumoTotal.investimento)} inv | ${formatNum(resumoTotal.purchases)} compras`);
  console.log(`   Dias com dados no Inout: ${resumoTotal.dias} (${DATA_INICIO.toISOString().slice(0, 10)} até ${DATA_FIM.toISOString().slice(0, 10)})`);

  if (totalComparacoes > 0) {
    console.log(`\n   Dias batendo na amostra: ${totalOk}/${totalComparacoes}`);
  }
  if (resumoTotal.dias === 0) {
    console.log("\n⚠️  Nenhum dado encontrado. Execute a sincronização do Meta.");
  }

  console.log("\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
