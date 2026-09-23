import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PIXEL_ID = "3595042497343941";

async function main() {
  const updated = await prisma.product.updateMany({
    where: { slug: { in: ["air-fryer-50-receitas", "100-melhores-bolos"] } },
    data: { metaPixelId: PIXEL_ID },
  });

  const global = await prisma.pixelConfig.upsert({
    where: { id: "default" },
    update: { pixelId: PIXEL_ID },
    create: { id: "default", pixelId: PIXEL_ID },
  });

  const rows = await prisma.product.findMany({
    where: { slug: { in: ["air-fryer-50-receitas", "100-melhores-bolos"] } },
    select: { slug: true, metaPixelId: true },
  });

  console.log(JSON.stringify({ updated: updated.count, global: global.pixelId, rows }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
