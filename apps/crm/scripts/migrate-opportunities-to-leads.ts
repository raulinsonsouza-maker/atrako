/**
 * Migra valores de oportunidades para Lead.dealValue (pipeline único).
 * Regra: soma o valor de todas as oportunidades por lead.
 *
 * Uso:
 *  npx tsx scripts/migrate-opportunities-to-leads.ts
 *  TENANT_ID=uuid npx tsx scripts/migrate-opportunities-to-leads.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenantId = process.env.TENANT_ID?.trim();
  const where: { tenantId?: string } = {};
  if (tenantId) where.tenantId = tenantId;

  const grouped = await prisma.opportunity.groupBy({
    by: ["leadId"],
    where,
    _sum: { value: true },
  });

  let updated = 0;
  for (const g of grouped) {
    const total = g._sum.value ? Number(g._sum.value) : 0;
    await prisma.lead.updateMany({
      where: { id: g.leadId, ...(tenantId ? { tenantId } : {}) },
      data: { dealValue: total },
    });
    updated += 1;
  }

  console.log(`Leads atualizados: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
