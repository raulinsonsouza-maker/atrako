/**
 * Loja de teste — Draxx Estúdio (impressão 3D / geek).
 *
 *   npx tsx scripts/seed-draxx-store.ts
 *
 * Login: draxx@atrako.local / admin123
 * Vitrine: http://localhost:5000/loja/draxx
 * Painel:  http://localhost:5000/commerce
 */

import { prisma } from "../lib/db";
import { hashPassword } from "../lib/authSecurity";
import { ensureDefaultPipeline, applyPipelinePreset } from "../lib/modules/crm";
import { applyWorkspaceEdition } from "../lib/modules/apply-edition";
import { defaultShippingRules, type ShippingRules } from "../lib/commerce/shipping";

const EMAIL = "draxx@atrako.local";
const PASSWORD = "admin123";
const SLUG = "draxx";

const CATEGORIES = [
  { name: "Action Figures", slug: "action-figures", sortOrder: 0 },
  { name: "Decoração", slug: "decoracao", sortOrder: 1 },
  { name: "Game Acessórios", slug: "game-acessorios", sortOrder: 2 },
  { name: "Pets", slug: "pets", sortOrder: 3 },
  { name: "Geek / RPG / Cosplay", slug: "geek-rpg-cosplay", sortOrder: 4 },
  { name: "Encomendas", slug: "encomendas", sortOrder: 5 },
] as const;

type SeedProduct = {
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  variants?: { label: string; priceCents?: number; stockQty: number; sku: string }[];
};

const PRODUCTS: SeedProduct[] = [
  {
    categorySlug: "action-figures",
    name: "Action Figure Zoro (One Piece)",
    slug: "action-figure-zoro",
    description:
      "Figura impressa em 3D, pintura artesanal. Placeholder para testes de vitrine — sem imagens reais.",
    priceCents: 28900,
    variants: [
      { label: "Padrão 20cm", stockQty: 5, sku: "ZORO-20" },
      { label: "Grande 30cm", priceCents: 38900, stockQty: 2, sku: "ZORO-30" },
    ],
  },
  {
    categorySlug: "action-figures",
    name: "The Hunter (Bloodborne)",
    slug: "hunter-bloodborne",
    description: "Colecionável fantasia/gaming. Estrutura de produto para o painel e checkout.",
    priceCents: 34900,
    variants: [
      { label: "Pintado", stockQty: 3, sku: "HUNTER-P" },
      { label: "Cru (sem pintura)", priceCents: 18900, stockQty: 8, sku: "HUNTER-C" },
    ],
  },
  {
    categorySlug: "action-figures",
    name: "Figura Anime Efeitos",
    slug: "figura-anime-efeitos",
    description: "Placeholder de action figure com efeitos. Use no carrinho multi-item.",
    priceCents: 25900,
    variants: [{ label: "Único", stockQty: 4, sku: "ANIME-01" }],
  },
  {
    categorySlug: "decoracao",
    name: "Estátua Sagrada Família",
    slug: "estatua-sagrada-familia",
    description: "Peça decorativa impressa em 3D. Placeholder sem foto.",
    priceCents: 15900,
    variants: [
      { label: "Branco", stockQty: 10, sku: "SF-BR" },
      { label: "Mármore", priceCents: 18900, stockQty: 6, sku: "SF-MR" },
    ],
  },
  {
    categorySlug: "decoracao",
    name: "Busto Decorativo Geek",
    slug: "busto-decorativo-geek",
    description: "Decoração geek para estante. Produto de teste do catálogo.",
    priceCents: 9900,
    variants: [{ label: "Padrão", stockQty: 12, sku: "BUSTO-01" }],
  },
  {
    categorySlug: "game-acessorios",
    name: "Capacete Deathstroke",
    slug: "capacete-deathstroke",
    description: "Acessório / colecionável escala display. Placeholder para PDP e variantes.",
    priceCents: 42000,
    variants: [
      { label: "Display", stockQty: 2, sku: "DS-DISP" },
      { label: "Wearable (sob encomenda)", priceCents: 89000, stockQty: 1, sku: "DS-WEAR" },
    ],
  },
  {
    categorySlug: "game-acessorios",
    name: "Suporte de Controle Temático",
    slug: "suporte-controle",
    description: "Game acessório impresso sob demanda. Ideal para testar frete e carrinho.",
    priceCents: 7900,
    variants: [
      { label: "Xbox", stockQty: 15, sku: "SUP-XB" },
      { label: "PlayStation", stockQty: 15, sku: "SUP-PS" },
    ],
  },
  {
    categorySlug: "pets",
    name: "Plaquinha Pet Personalizada",
    slug: "plaquinha-pet",
    description: "Categoria Pets — placeholder. Personalização vira pedido sob medida depois.",
    priceCents: 4500,
    variants: [
      { label: "Pequena", stockQty: 20, sku: "PET-P" },
      { label: "Média", priceCents: 5900, stockQty: 20, sku: "PET-M" },
    ],
  },
  {
    categorySlug: "geek-rpg-cosplay",
    name: "Kit Dados RPG (stand)",
    slug: "kit-dados-rpg-stand",
    description: "Geek / RPG — stand para dados. Produto de teste sem imagem.",
    priceCents: 6900,
    variants: [{ label: "Padrão", stockQty: 25, sku: "RPG-ST" }],
  },
  {
    categorySlug: "geek-rpg-cosplay",
    name: "Prop Cosplay Básico",
    slug: "prop-cosplay-basico",
    description: "Prop cosplay placeholder. Escala e pintura sob consulta.",
    priceCents: 19900,
    variants: [
      { label: "Cru", stockQty: 5, sku: "COS-C" },
      { label: "Pintado", priceCents: 29900, stockQty: 2, sku: "COS-P" },
    ],
  },
  {
    categorySlug: "encomendas",
    name: "Projeto sob medida (sinal)",
    slug: "projeto-sob-medida",
    description:
      "Sinal para projeto personalizado / encomenda. Após o pagamento, o estúdio alinha brief no WhatsApp.",
    priceCents: 10000,
    variants: [{ label: "Sinal R$ 100", stockQty: 99, sku: "ENC-SINAL" }],
  },
];

function shippingForDraxx(): ShippingRules {
  return {
    ...defaultShippingRules(),
    pickupEnabled: true,
    shipEnabled: true,
    freeShippingMinCents: 35000,
    defaultFeeCents: 2800,
    defaultDaysMin: 7,
    defaultDaysMax: 14,
    zones: [
      {
        id: "sp-capital",
        name: "Capital SP",
        cepFrom: "01000000",
        cepTo: "05999999",
        feeCents: 1500,
        daysMin: 3,
        daysMax: 6,
        active: true,
      },
      {
        id: "sp-grande",
        name: "Grande SP",
        cepFrom: "06000000",
        cepTo: "09999999",
        feeCents: 1800,
        daysMin: 4,
        daysMax: 8,
        active: true,
      },
      {
        id: "interior-sp",
        name: "Interior SP",
        cepFrom: "10000000",
        cepTo: "19999999",
        feeCents: 2200,
        daysMin: 5,
        daysMax: 10,
        active: true,
      },
    ],
  };
}

async function upsertCliente() {
  const existing = await prisma.cliente.findFirst({
    where: {
      OR: [{ slug: SLUG }, { nome: { contains: "draxx", mode: "insensitive" } }],
    },
  });
  const data = {
    nome: "Draxx Estúdio",
    slug: SLUG,
    ativo: true,
    segmento: "Impressão 3D / e-commerce",
    objetivoMidia: "ecommerce",
    perfilPanel: "ecommerce",
    produtoServico:
      "Action figures, decoração, pets, game acessórios e projetos sob medida em impressão 3D.",
    modeloNegocio: "Estúdio de impressão 3D com vitrine própria e encomendas personalizadas.",
    publicoAlvo: "Fãs de geek, RPG, cosplay e colecionadores.",
    objetivoProjeto: "Vitrine nativa Atrako para testar catálogo, frete e checkout.",
  };
  if (existing) return prisma.cliente.update({ where: { id: existing.id }, data });
  return prisma.cliente.create({ data });
}

async function upsertOwner(clienteId: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const existing = await prisma.workspaceMember.findFirst({ where: { email: EMAIL } });
  if (existing) {
    return prisma.workspaceMember.update({
      where: { id: existing.id },
      data: {
        clienteId,
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: "OWNER",
        active: true,
        name: "Draxx Estúdio",
      },
    });
  }
  return prisma.workspaceMember.create({
    data: {
      clienteId,
      email: EMAIL,
      name: "Draxx Estúdio",
      role: "OWNER",
      active: true,
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
  });
}

async function seedStore(clienteId: string) {
  const rules = shippingForDraxx();
  let store = await prisma.commerceStore.findUnique({ where: { clienteId } });
  if (!store) {
    store = await prisma.commerceStore.create({
      data: {
        clienteId,
        slug: SLUG,
        name: "Draxx Estúdio",
        published: true,
        acceptingOrders: true,
        shipEnabled: true,
        pickupEnabled: true,
        minOrderCents: 0,
        shippingRules: rules,
        pickupName: "Draxx Estúdio",
        pickupAddress: "Retirada sob agendamento · Placeholder",
        pickupInstructions: "Combinar horário pelo Instagram @draxx_3d",
      },
    });
  } else {
    store = await prisma.commerceStore.update({
      where: { id: store.id },
      data: {
        slug: SLUG,
        name: "Draxx Estúdio",
        published: true,
        acceptingOrders: true,
        shipEnabled: true,
        pickupEnabled: true,
        shippingRules: rules,
        pickupName: "Draxx Estúdio",
        pickupAddress: "Retirada sob agendamento · Placeholder",
        pickupInstructions: "Combinar horário pelo Instagram @draxx_3d",
      },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const row = await prisma.commerceCategory.upsert({
      where: { storeId_slug: { storeId: store.id, slug: cat.slug } },
      create: {
        storeId: store.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        active: true,
      },
      update: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        active: true,
      },
    });
    categoryIds.set(cat.slug, row.id);
  }

  // Desativa categorias que não fazem parte do catálogo Draxx
  await prisma.commerceCategory.updateMany({
    where: {
      storeId: store.id,
      slug: { notIn: CATEGORIES.map((c) => c.slug) },
    },
    data: { active: false },
  });

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.categorySlug) ?? null;
    const created = await prisma.commerceProduct.upsert({
      where: { clienteId_slug: { clienteId, slug: product.slug } },
      create: {
        clienteId,
        storeId: store.id,
        categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: "PUBLISHED",
        priceCents: product.priceCents,
        coverUrl: null,
        images: [],
        stockTracked: true,
        active: true,
      },
      update: {
        storeId: store.id,
        categoryId,
        name: product.name,
        description: product.description,
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: "PUBLISHED",
        priceCents: product.priceCents,
        coverUrl: null,
        images: [],
        stockTracked: true,
        active: true,
      },
    });

    await prisma.commerceVariant.deleteMany({ where: { productId: created.id } });
    const variants = product.variants ?? [{ label: "Padrão", stockQty: 10, sku: `${product.slug}-1` }];
    let sort = 0;
    for (const v of variants) {
      await prisma.commerceVariant.create({
        data: {
          productId: created.id,
          sku: v.sku,
          options: { Opção: v.label },
          priceCents: v.priceCents ?? null,
          stockQty: v.stockQty,
          active: true,
          sortOrder: sort++,
        },
      });
    }
  }

  // Cupom de teste
  await prisma.commerceCoupon.upsert({
    where: { clienteId_code: { clienteId, code: "DRAXX10" } },
    create: {
      clienteId,
      code: "DRAXX10",
      type: "PERCENT",
      value: 10,
      active: true,
    },
    update: { active: true, type: "PERCENT", value: 10 },
  });

  return store;
}

async function main() {
  const cliente = await upsertCliente();
  console.log("Cliente:", cliente.id, cliente.nome, cliente.slug);

  const member = await upsertOwner(cliente.id);
  console.log("OWNER:", member.email, `(senha ${PASSWORD})`);

  await ensureDefaultPipeline(cliente.id);
  await applyPipelinePreset(cliente.id, "ecommerce").catch(() => null);
  await applyWorkspaceEdition(cliente.id, "ecommerce");
  await prisma.workspaceSettings.upsert({
    where: { clienteId: cliente.id },
    create: { clienteId: cliente.id, primaryColor: "#cc0000" },
    update: { primaryColor: "#cc0000" },
  });
  console.log("Edição: ecommerce (módulo Loja ligado) · primary #cc0000");

  const store = await seedStore(cliente.id);
  const counts = await prisma.commerceProduct.count({
    where: { storeId: store.id, kind: "PHYSICAL" },
  });
  const cats = await prisma.commerceCategory.count({ where: { storeId: store.id } });

  console.log(`Loja: ${store.slug} · ${cats} categorias · ${counts} produtos`);
  console.log("");
  console.log("Login:   http://localhost:5000/sign-in");
  console.log(`         ${EMAIL} / ${PASSWORD}`);
  console.log("Painel:  http://localhost:5000/commerce");
  console.log("Vitrine: http://localhost:5000/loja/draxx");
  console.log("Cupom:   DRAXX10 (10%)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
