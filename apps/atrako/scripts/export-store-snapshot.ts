import { writeFileSync } from "fs";
import { prisma } from "../lib/db";

const slug = process.argv[2] || "draxx";

async function main() {
  const store = await prisma.commerceStore.findUnique({
    where: { slug },
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          slug: true,
          logoUrl: true,
          ativo: true,
          workspaceSettings: {
            select: { primaryColor: true, timezone: true, currency: true, locale: true, edition: true, modulesEnabled: true },
          },
          workspaceMembers: {
            select: {
              role: true,
              email: true,
              name: true,
              active: true,
              passwordHash: true,
            },
          },
        },
      },
      categories: { orderBy: { sortOrder: "asc" } },
      products: { include: { variants: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!store) throw new Error(`loja ${slug} não encontrada`);

  const clienteId = store.clienteId;
  const [coupons, offers, orders] = await Promise.all([
    prisma.commerceCoupon.findMany({ where: { clienteId }, include: { products: true } }),
    prisma.commerceOffer.findMany({ where: { clienteId } }),
    prisma.commerceOrder.findMany({
      where: { storeId: store.id },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const out = {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      published: store.published,
      acceptingOrders: store.acceptingOrders,
      shipEnabled: store.shipEnabled,
      pickupEnabled: store.pickupEnabled,
      minOrderCents: store.minOrderCents,
      shippingRules: store.shippingRules,
      banners: store.banners,
      theme: store.theme,
      pickupName: store.pickupName,
      pickupAddress: store.pickupAddress,
      pickupInstructions: store.pickupInstructions,
    },
    cliente: store.cliente,
    categories: store.categories,
    products: store.products,
    coupons,
    offers,
    orders,
  };
  const file = process.argv[3] || "store-snapshot.json";
  writeFileSync(file, JSON.stringify(out));
  const urls = JSON.stringify(out).match(/\/lp-media\/[A-Za-z0-9_.-]+/g) ?? [];
  console.log(JSON.stringify({
    cliente: store.cliente.slug,
    nome: store.cliente.nome,
    members: store.cliente.workspaceMembers.map((m) => `${m.role}:${m.email}`),
    categories: store.categories.length,
    products: store.products.length,
    variants: store.products.reduce((n, p) => n + p.variants.length, 0),
    coupons: coupons.length,
    offers: offers.length,
    orders: orders.length,
    files: [...new Set(urls)],
    bytes: Buffer.byteLength(JSON.stringify(out)),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
