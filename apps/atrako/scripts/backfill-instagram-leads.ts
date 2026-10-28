/**
 * Abre no funil os contatos que já entraram numa automação do Instagram.
 *
 *   npx tsx scripts/backfill-instagram-leads.ts
 *   npx tsx scripts/backfill-instagram-leads.ts regicenter
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

async function main() {
  const slug = process.argv[2]?.trim() || "regicenter";
  const { prisma } = await import("../lib/db");
  const { prisma: social } = await import("../lib/db-social");
  const { backfillInstagramAutomationLeads } = await import("../lib/instagram/workspaceLead");

  const cliente = await prisma.cliente.findFirst({
    where: {
      OR: [{ slug }, { nome: { contains: slug, mode: "insensitive" } }],
    },
    select: { id: true, nome: true, slug: true },
  });
  if (!cliente) {
    console.log(JSON.stringify({ ok: false, reason: "workspace nao encontrado", slug }));
    await prisma.$disconnect();
    await social.$disconnect();
    process.exit(1);
  }

  const result = await backfillInstagramAutomationLeads(cliente.id);
  console.log(JSON.stringify({ ok: true, nome: cliente.nome, slug: cliente.slug, ...result }));
  await prisma.$disconnect();
  await social.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
