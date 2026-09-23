/**
 * Analisa clientes: totais de FatoMidiaDiario por cliente, duplicados, inconsistências.
 * Uso: npx tsx scripts/analise-clientes-dados.ts
 */

import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    include: { contas: { where: { plataforma: "META" } } },
  });

  const agregados = await prisma.fatoMidiaDiario.groupBy({
    by: ["clienteId"],
    _sum: { leads: true, cliques: true, investimento: true },
    _count: { id: true },
  });
  const mapAgg = new Map(agregados.map((a) => [a.clienteId, a]));

  console.log("\n========== ANÁLISE POR CLIENTE ==========\n");

  const semDados: string[] = [];
  const comDados: string[] = [];
  const conversaoAlta: { nome: string; conversao: number }[] = [];

  for (const c of clientes) {
    const agg = mapAgg.get(c.id);
    const totalLeads = agg?._sum.leads ?? 0;
    const totalCliques = agg?._sum.cliques ?? 0;
    const conversao = totalCliques > 0 ? (totalLeads / totalCliques) * 100 : 0;
    const hasMeta = c.contas.length > 0;

    if (totalLeads === 0 && totalCliques === 0) {
      semDados.push(`${c.nome} (${c.slug}) [Meta: ${hasMeta}]`);
    } else {
      comDados.push(c.nome);
      if (conversao > 100) {
        conversaoAlta.push({ nome: c.nome, conversao });
      }
    }
  }

  console.log("--- Clientes SEM dados em FatoMidiaDiario ---");
  semDados.forEach((s) => console.log("  ", s));
  console.log("\n--- Clientes com conversão > 100% ---");
  conversaoAlta.forEach(({ nome, conversao }) =>
    console.log("  ", nome, "->", conversao.toFixed(1) + "%")
  );

  const duplicadosNome = new Map<string, string[]>();
  for (const c of clientes) {
    const key = c.nome.trim().toLowerCase();
    if (!duplicadosNome.has(key)) duplicadosNome.set(key, []);
    duplicadosNome.get(key)!.push(`${c.nome} (${c.slug})`);
  }
  const dups = [...duplicadosNome.entries()].filter(([, v]) => v.length > 1);
  console.log("\n--- Duplicados por nome ---");
  console.log(dups.length ? dups.map(([n, v]) => `  ${n}: ${v.join(", ")}`).join("\n") : "  (nenhum)");

  console.log("\n========== RESUMO ==========");
  console.log("Sem dados:", semDados.length);
  console.log("Com dados:", comDados.length);
  console.log("Conversão > 100%:", conversaoAlta.length);
  console.log("Duplicados por nome:", dups.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
