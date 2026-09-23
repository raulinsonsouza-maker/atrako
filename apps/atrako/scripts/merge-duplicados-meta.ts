/**
 * Script para corrigir duplicados: move Conta META do cliente duplicado para o original
 * e remove o cliente duplicado.
 *
 * Duplicados identificados (original com Sheets vs importado só Meta):
 * - academy-americana <-> academy-americana-1
 * - dr-fernando-guena <-> dr-fernando-guena-1
 * - tertulia <-> tertulia-1
 * - varella-motos <-> varella-motos-1
 *
 * Uso: npx tsx scripts/merge-duplicados-meta.ts
 */

import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

const MERGE_PAIRS: { originalSlug: string; duplicadoSlug: string }[] = [
  { originalSlug: "academy-americana", duplicadoSlug: "academy-americana-1" },
  { originalSlug: "dr-fernando-guena", duplicadoSlug: "dr-fernando-guena-1" },
  { originalSlug: "tertulia", duplicadoSlug: "tertulia-1" },
  { originalSlug: "varella-motos", duplicadoSlug: "varella-motos-1" },
  { originalSlug: "beblue", duplicadoSlug: "be-blue-school" },
];

async function main() {
  console.log("Iniciando merge de duplicados Meta...\n");

  for (const { originalSlug, duplicadoSlug } of MERGE_PAIRS) {
    const original = await prisma.cliente.findUnique({ where: { slug: originalSlug } });
    const duplicado = await prisma.cliente.findUnique({ where: { slug: duplicadoSlug } });

    if (!original) {
      console.log(`[SKIP] Original não encontrado: ${originalSlug}`);
      continue;
    }
    if (!duplicado) {
      console.log(`[SKIP] Duplicado não encontrado: ${duplicadoSlug}`);
      continue;
    }

    const contaMeta = await prisma.conta.findFirst({
      where: { clienteId: duplicado.id, plataforma: "META" },
    });

    if (!contaMeta) {
      console.log(`[SKIP] Duplicado ${duplicadoSlug} não tem Conta META`);
      continue;
    }

    console.log(`[MERGE] ${original.nome} (${originalSlug}) <- Conta META de ${duplicado.nome} (${duplicadoSlug})`);

    await prisma.$transaction(async (tx) => {
      await tx.conta.update({
        where: { id: contaMeta.id },
        data: { clienteId: original.id },
      });
      await tx.fatoMidiaDiario.deleteMany({ where: { clienteId: duplicado.id } });
      await tx.agregadoMidiaSemanal.deleteMany({ where: { clienteId: duplicado.id } });
      await tx.agregadoMidiaMensal.deleteMany({ where: { clienteId: duplicado.id } });
      await tx.meta.deleteMany({ where: { clienteId: duplicado.id } });
      await tx.pautaReuniao.deleteMany({ where: { clienteId: duplicado.id } });
      await tx.cliente.delete({ where: { id: duplicado.id } });
    });

    console.log(`  -> Conta vinculada ao original, duplicado removido.\n`);
  }

  console.log("Merge concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
