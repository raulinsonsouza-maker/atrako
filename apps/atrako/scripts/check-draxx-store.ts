import { prisma } from "../lib/db";

async function main() {
  const store = await prisma.commerceStore.findUnique({
    where: { slug: "draxx" },
    include: {
      categories: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      products: {
        where: { kind: "PHYSICAL", active: true },
        include: { variants: true, category: true },
        orderBy: { name: "asc" },
      },
      cliente: { select: { id: true, nome: true } },
    },
  });
  if (!store) {
    console.error("Store draxx não encontrada");
    process.exit(1);
  }
  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: store.clienteId },
    select: { modulesEnabled: true, edition: true },
  });
  console.log(
    JSON.stringify(
      {
        workspace: store.cliente.nome,
        edition: settings?.edition,
        modulesEnabled: settings?.modulesEnabled,
        store: store.name,
        slug: store.slug,
        acceptingOrders: store.acceptingOrders,
        categories: store.categories.map((c) => c.name),
        products: store.products.map((p) => ({
          name: p.name,
          category: p.category?.name ?? null,
          priceCents: p.priceCents,
          variants: p.variants.map((v) => ({
            sku: v.sku,
            options: v.options,
            stockQty: v.stockQty,
          })),
        })),
        urls: {
          vitrine: "http://localhost:5000/loja/draxx",
          painel: "http://localhost:5000/commerce",
          login: "draxx@atrako.local / admin123",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
