/**
 * Sense Biologicus: fecha ciclos 10/11 com cobrança Woo+Meta (sem Olist).
 * NÃO toca 08/09 (já pagos).
 *
 *   npx tsx scripts/fechar-sense-ciclos-woo-meta.ts
 *
 * Ops: após 23/12/2026, rode de novo para refechar só o ciclo 11
 * (inclui vendas Meta/Woo de 28/11–23/12 que o fechamento antecipado perdeu).
 */

import { prisma } from "../lib/db";
import { dateToDay } from "../lib/relatorios/ciclos";
import {
  buildVendasMetaReport,
  fecharCicloSnapshot,
  getCicloReport,
} from "../lib/relatorios/vendas-meta";

const SLUG = "sense-biologicus";
/** Só estes inícios — 08/09 proibidos. */
const FECHAR_INICIOS = new Set(["2026-10-24", "2026-11-24"]);
const PROIBIDOS = new Set(["2026-08-24", "2026-09-24"]);

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { slug: SLUG },
    select: { id: true, nome: true, slug: true },
  });
  if (!cliente) throw new Error(`Workspace ${SLUG} não encontrado`);

  const ciclos = await prisma.comissaoVendasMetaCiclo.findMany({
    where: { clienteId: cliente.id },
    orderBy: { dataInicio: "asc" },
  });

  const out: Array<Record<string, unknown>> = [];

  for (const row of ciclos) {
    const ini = dateToDay(row.dataInicio);
    if (PROIBIDOS.has(ini)) {
      out.push({ dataInicio: ini, action: "skip_pago", status: row.status });
      continue;
    }
    if (!FECHAR_INICIOS.has(ini)) {
      out.push({ dataInicio: ini, action: "skip_out_of_scope", status: row.status });
      continue;
    }

    const before = await getCicloReport(cliente.id, row.id);
    const preview = await buildVendasMetaReport({
      clienteId: cliente.id,
      dataInicio: ini,
      dataFim: dateToDay(row.dataFim),
      comissaoPercent: Number(row.comissaoPercent.toString()),
    });

    const closed = await fecharCicloSnapshot(cliente.id, row.id);
    if (!closed) throw new Error(`Falha ao fechar ${ini}`);

    out.push({
      dataInicio: ini,
      dataFim: dateToDay(row.dataFim),
      action: "fechado_woo_meta",
      before: before
        ? {
            status: before.ciclo.status,
            pedidos: before.report.resumo.pedidos,
            faturamentoCents: before.report.resumo.faturamentoCents,
            comissaoCents: before.report.resumo.comissaoCents,
          }
        : null,
      after: {
        status: closed.ciclo.status,
        pedidos: preview.resumo.pedidos,
        faturamentoCents: preview.resumo.faturamentoCents,
        comissaoCents: preview.resumo.comissaoCents,
        naoConcretizados: preview.naoConcretizados,
        metaRef: preview.meta,
      },
    });
  }

  console.log(JSON.stringify({ cliente, ciclos: out }, null, 2));
  console.log(
    "\nLembrete: após 23/12/2026 rode de novo este script para refechar o ciclo 11 (24/11–23/12).",
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
