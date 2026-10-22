/**
 * Ativa o relatório mensal de comissão sobre vendas Meta de um cliente e gera os ciclos.
 *   npx tsx scripts/comissao-meta-config.ts <slug> <percent> <inicio YYYY-MM-DD> [diaCorte]
 */
import { prisma } from "../lib/db";
import { formatCicloLabel, isDay } from "../lib/relatorios/ciclos";
import { getCicloReport, listCiclosResumo, newShareToken, syncComissaoCiclos } from "../lib/relatorios/vendas-meta";
import { formatBRL } from "../lib/relatorios/vendas-meta-core";

async function main() {
  const [slug, percentArg, inicio, diaCorteArg] = process.argv.slice(2);
  const percent = Number(percentArg);
  if (!slug || !Number.isFinite(percent) || !isDay(inicio)) {
    throw new Error("uso: <slug> <percent> <inicio YYYY-MM-DD> [diaCorte]");
  }
  const diaCorte = diaCorteArg ? Number(diaCorteArg) : Number(inicio.slice(8, 10));
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { slug }, select: { id: true, nome: true, comissaoMetaShareToken: true } });
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      comissaoMetaPercent: percent,
      comissaoMetaInicio: new Date(`${inicio}T00:00:00Z`),
      comissaoMetaDiaCorte: diaCorte,
      comissaoMetaShareToken: cliente.comissaoMetaShareToken ?? newShareToken(),
    },
  });
  await syncComissaoCiclos(cliente.id);
  const token = (await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id }, select: { comissaoMetaShareToken: true } }))
    .comissaoMetaShareToken;
  console.log(`${cliente.nome} (${cliente.id}) · ${percent}% · início ${inicio} · corte ${diaCorte}`);
  console.log(`link: /relatorio/${token}`);
  for (const c of await listCiclosResumo(cliente.id)) {
    const data = await getCicloReport(cliente.id, c.id);
    const r = data?.report.resumo;
    console.log(
      `${formatCicloLabel(c)} [${c.status}] ${r?.pedidos ?? 0} vendas · ${formatBRL(r?.faturamentoCents ?? 0)} · comissão ${formatBRL(r?.comissaoCents ?? 0)}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
