/**
 * Loja On Móveis — catálogo de banho e sala, sem preço no material de origem.
 *
 *   npx tsx scripts/seed-on-moveis-store.ts
 */
import { randomBytes } from "crypto";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/authSecurity";
import { ensureDefaultPipeline, applyPipelinePreset } from "../lib/modules/crm";
import { applyWorkspaceEdition } from "../lib/modules/apply-edition";
import type { ShippingRules } from "../lib/commerce/shipping";

const EMAIL = "onmoveis@atrako.local";
const SLUG = "on-moveis";

const COLORS = {
  milano: ["Rosa", "Grafite", "Verde", "Branco"],
  dubai: ["Rosa", "Grafite", "Verde", "Branco", "Freijó"],
  freijo: ["Freijó"],
  branco: ["Branco"],
  sala: ["Rosa", "Grafite", "Verde", "Branco", "Freijó"],
} as const;

type Piece = { name: string; size: string };

type SeedProduct = {
  categorySlug: "banho" | "sala";
  name: string;
  slug: string;
  line: string;
  pieces: Piece[];
  features: string[];
  colors: readonly string[];
  sku: string;
};

const PRODUCTS: SeedProduct[] = [
  {
    categorySlug: "banho",
    name: "Milano 80",
    slug: "milano-80",
    line: "Milano",
    sku: "MIL80",
    pieces: [
      { name: "Balcão", size: "80 × 63 × 38 cm" },
      { name: "Espelheira", size: "80 × 93 × 12 cm" },
      { name: "Cuba Milano", size: "80 × 12 × 40 cm" },
    ],
    features: ["Puxador concha", "Corrediça telescópica", "Amplo espaço interno", "Luminária em LED", "Espelho lapidado", "Pés de madeira"],
    colors: COLORS.milano,
  },
  {
    categorySlug: "banho",
    name: "Milano 60",
    slug: "milano-60",
    line: "Milano",
    sku: "MIL60",
    pieces: [
      { name: "Balcão", size: "60 × 63 × 38 cm" },
      { name: "Espelheira", size: "60 × 93 × 12 cm" },
      { name: "Cuba Milano", size: "60 × 12 × 40 cm" },
    ],
    features: ["Puxador concha", "Corrediça telescópica", "Amplo espaço interno", "Luminária em LED", "Espelho lapidado", "Pés de madeira"],
    colors: COLORS.milano,
  },
  {
    categorySlug: "banho",
    name: "Dubai 60",
    slug: "dubai-60",
    line: "Dubai",
    sku: "DUB60",
    pieces: [
      { name: "Balcão", size: "60 × 63 × 36 cm" },
      { name: "Espelheira", size: "60 × 90 × 2 cm" },
      { name: "Cuba Chanel", size: "35 × 11 × 35 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Corrediças telescópicas", "Espelho lapidado", "Puxador cava"],
    colors: COLORS.dubai,
  },
  {
    categorySlug: "banho",
    name: "Dubai 80",
    slug: "dubai-80",
    line: "Dubai",
    sku: "DUB80",
    pieces: [
      { name: "Balcão", size: "80 × 63 × 36 cm" },
      { name: "Espelheira", size: "80 × 90 × 2 cm" },
      { name: "Cuba Chanel", size: "35 × 11 × 35 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Corrediças telescópicas", "Espelho lapidado", "Puxador cava"],
    colors: COLORS.dubai,
  },
  {
    categorySlug: "banho",
    name: "Paris 60",
    slug: "paris-60",
    line: "Paris",
    sku: "PAR60",
    pieces: [
      { name: "Balcão", size: "60 × 63 × 36 cm" },
      { name: "Espelheira", size: "60 × 60 × 15 cm" },
      { name: "Cuba Chanel", size: "35 × 11 × 35 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Tampo engrossurado", "Espelho lapidado"],
    colors: COLORS.freijo,
  },
  {
    categorySlug: "banho",
    name: "Paris 80",
    slug: "paris-80",
    line: "Paris",
    sku: "PAR80",
    pieces: [
      { name: "Balcão", size: "80 × 63 × 36 cm" },
      { name: "Espelheira", size: "80 × 60 × 15 cm" },
      { name: "Cuba Chanel", size: "35 × 11 × 35 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Tampo engrossurado", "Espelho lapidado"],
    colors: COLORS.freijo,
  },
  {
    categorySlug: "banho",
    name: "Moscou 50",
    slug: "moscou-50",
    line: "Moscou",
    sku: "MOS50",
    pieces: [
      { name: "Balcão", size: "50 × 48 × 35 cm" },
      { name: "Espelheira", size: "50 × 64 × 2 cm" },
      { name: "Cuba Chanel", size: "35 × 11 × 35 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Nicho decorativo", "Espelho lapidado"],
    colors: COLORS.freijo,
  },
  {
    categorySlug: "sala",
    name: "Dallas 150",
    slug: "dallas-150",
    line: "Dallas",
    sku: "DAL150",
    pieces: [
      { name: "Rack", size: "150 × 58 × 39 cm" },
      { name: "Prateleira", size: "150 × 0,25 × 20 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Nicho para acomodação de aparelhos", "Pés de madeira", "Puxador cava"],
    colors: COLORS.sala,
  },
  {
    categorySlug: "sala",
    name: "Dallas 180",
    slug: "dallas-180",
    line: "Dallas",
    sku: "DAL180",
    pieces: [
      { name: "Rack", size: "180 × 58 × 39 cm" },
      { name: "Prateleira", size: "180 × 0,25 × 20 cm" },
    ],
    features: ["Dobradiças com amortecimento", "Nicho para acomodação de aparelhos", "Pés de madeira", "Puxador cava"],
    colors: COLORS.sala,
  },
  {
    categorySlug: "sala",
    name: "Veneza 130",
    slug: "veneza-130",
    line: "Veneza",
    sku: "VEN130",
    pieces: [{ name: "Painel para TV", size: "130 × 140 × 36 cm" }],
    features: ["Dobradiças com amortecimento", "Prateleira engrossurada", "Tampo engrossurado", "Painel com negativo"],
    colors: COLORS.branco,
  },
  {
    categorySlug: "sala",
    name: "Madri 60",
    slug: "madri-60",
    line: "Madri",
    sku: "MAD60",
    pieces: [{ name: "Aparador", size: "60 × 80 × 36 cm" }],
    features: ["Dobradiças com amortecimento", "Puxador cava", "Pés de madeira"],
    colors: COLORS.sala,
  },
  {
    categorySlug: "sala",
    name: "Madri 90",
    slug: "madri-90",
    line: "Madri",
    sku: "MAD90",
    pieces: [{ name: "Aparador", size: "90 × 80 × 36 cm" }],
    features: ["Dobradiças com amortecimento", "Puxador cava", "Pés de madeira"],
    colors: COLORS.sala,
  },
];

function description(product: SeedProduct) {
  const pieces = product.pieces.map((piece) => `<li>${piece.name}: ${piece.size}</li>`).join("");
  const features = product.features.map((feature) => `<li>${feature}</li>`).join("");
  return [
    `<p>Linha ${product.line}. Medidas em centímetros — largura × altura × profundidade.</p>`,
    `<ul>${pieces}</ul>`,
    `<p>Acabamento</p>`,
    `<ul>${features}</ul>`,
    `<p>Preço sob consulta.</p>`,
  ].join("");
}

function shipping(): ShippingRules {
  return {
    pickupEnabled: true,
    shipEnabled: false,
    freeShippingMinCents: null,
    zones: [],
    defaultFeeCents: null,
    defaultDaysMin: null,
    defaultDaysMax: null,
  };
}

async function upsertCliente() {
  const existing = await prisma.cliente.findUnique({ where: { slug: SLUG } });
  const data = {
    nome: "On Móveis",
    slug: SLUG,
    ativo: true,
    segmento: "Móveis seriados",
    objetivoMidia: "ecommerce",
    perfilPanel: "ecommerce",
    produtoServico: "Móveis seriados para banho e sala de estar.",
    modeloNegocio: "Fábrica de móveis seriados, com vitrine e retirada em Bom Princípio.",
    publicoAlvo: "Quem busca móveis duradouros, elegantes e criativos para o lar.",
    objetivoProjeto: "Vitrine On Móveis com as linhas Milano, Dubai, Paris, Moscou, Dallas, Veneza e Madri.",
  };
  if (existing) return prisma.cliente.update({ where: { id: existing.id }, data });
  return prisma.cliente.create({ data });
}

async function upsertOwner(clienteId: string) {
  const existing = await prisma.workspaceMember.findFirst({ where: { email: EMAIL } });
  if (existing) {
    if (existing.clienteId !== clienteId) {
      throw new Error(`${EMAIL} já pertence a outro workspace`);
    }
    return { member: existing, password: null as string | null };
  }
  const password = randomBytes(9).toString("base64url");
  const member = await prisma.workspaceMember.create({
    data: {
      clienteId,
      email: EMAIL,
      name: "On Móveis",
      role: "OWNER",
      active: true,
      passwordHash: await hashPassword(password),
      passwordUpdatedAt: new Date(),
    },
  });
  return { member, password };
}

async function seedStore(clienteId: string) {
  const storeData = {
    slug: SLUG,
    name: "On Móveis",
    published: true,
    acceptingOrders: true,
    shipEnabled: false,
    pickupEnabled: true,
    minOrderCents: 0,
    shippingRules: shipping(),
    banners: [],
    theme: {
      logoUrl: null,
      announce: "Preços sob consulta · Retirada em Bom Princípio",
      about:
        "Foi pensando nas pessoas que desejam móveis duradouros, elegantes e criativos, que a On Móveis foi fundada. Desde 2017, a companhia fabrica móveis seriados feitos para durar. Endereço: Rua Arno R Selbach, 224, Bom Princípio.",
      instagram: "",
      whatsapp: "",
      email: "",
      hours: "",
    },
    pickupName: "On Móveis",
    pickupAddress: "Rua Arno R Selbach, 224, Bom Princípio",
    pickupInstructions: "Retirada na fábrica, sob agendamento.",
  };
  const store = await prisma.commerceStore.upsert({
    where: { clienteId },
    create: { clienteId, ...storeData },
    update: storeData,
  });

  const categories = [
    { name: "Banho", slug: "banho", sortOrder: 0 },
    { name: "Sala de estar", slug: "sala", sortOrder: 1 },
  ];
  const categoryIds = new Map<string, string>();
  for (const cat of categories) {
    const row = await prisma.commerceCategory.upsert({
      where: { storeId_slug: { storeId: store.id, slug: cat.slug } },
      create: { storeId: store.id, name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder, active: true },
      update: { name: cat.name, sortOrder: cat.sortOrder, active: true },
    });
    categoryIds.set(cat.slug, row.id);
  }

  for (const product of PRODUCTS) {
    const created = await prisma.commerceProduct.upsert({
      where: { clienteId_slug: { clienteId, slug: product.slug } },
      create: {
        clienteId,
        storeId: store.id,
        categoryId: categoryIds.get(product.categorySlug) ?? null,
        name: product.name,
        slug: product.slug,
        description: description(product),
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: "PUBLISHED",
        priceCents: 0,
        coverUrl: null,
        images: [],
        stockTracked: false,
        active: true,
        badges: {},
      },
      update: {
        storeId: store.id,
        categoryId: categoryIds.get(product.categorySlug) ?? null,
        name: product.name,
        description: description(product),
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: "PUBLISHED",
        priceCents: 0,
        stockTracked: false,
        active: true,
      },
    });
    await prisma.commerceVariant.deleteMany({ where: { productId: created.id } });
    let sort = 0;
    for (const color of product.colors) {
      const code = color
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .slice(0, 4);
      await prisma.commerceVariant.create({
        data: {
          productId: created.id,
          sku: `${product.sku}-${code}`,
          options: { Cor: color },
          priceCents: null,
          stockQty: 0,
          active: true,
          sortOrder: sort++,
        },
      });
    }
  }

  return store;
}

async function main() {
  const cliente = await upsertCliente();
  const { password } = await upsertOwner(cliente.id);
  await ensureDefaultPipeline(cliente.id);
  await applyPipelinePreset(cliente.id, "ecommerce").catch(() => null);
  await applyWorkspaceEdition(cliente.id, "ecommerce");
  await prisma.workspaceSettings.update({
    where: { clienteId: cliente.id },
    data: { primaryColor: "#1d1d1f" },
  });
  const store = await seedStore(cliente.id);
  const products = await prisma.commerceProduct.count({ where: { storeId: store.id, active: true } });
  console.log(`Loja ${store.slug}: ${products} produtos`);
  console.log(`Vitrine: /loja/${store.slug}`);
  console.log(`Login: ${EMAIL}`);
  console.log(password ? `Senha: ${password}` : "Senha: já cadastrada");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
