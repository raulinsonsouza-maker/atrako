import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.commerceStore.findUnique({ where: { slug: "draxx" } });
  if (!store) throw new Error("Loja draxx não encontrada");

  const banners = [
    {
      id: "demo-banner-1",
      imageUrl: "/store/demo-banner-draxx.svg",
      href: "/loja/draxx/p/action-figure-zoro",
      active: true,
      sortOrder: 0,
    },
  ];

  const updated = await prisma.commerceStore.update({
    where: { id: store.id },
    data: { banners },
  });

  console.log("Banner demo cadastrado em", store.slug);
  console.log("banners no banco:", JSON.stringify(updated.banners));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
