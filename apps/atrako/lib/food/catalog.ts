/**
 * Carga inicial do cardápio Lépido, espelhando archive/apps/Food/dist/app.js.
 * Preço e disponibilidade passam a viver no servidor.
 */

import { prisma } from "@/lib/db";

const ASSET = "/food-store/assets";

type SeedItem = {
  key: string;
  category: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl?: string;
  emoji: string;
  badge?: string;
  calories?: number;
  ingredients?: string[];
  allergens?: string;
};

const CATEGORIES = [
  { slug: "burgers", name: "Burgers", sortOrder: 0 },
  { slug: "combos", name: "Combos", sortOrder: 1 },
  { slug: "bebidas", name: "Bebidas", sortOrder: 2 },
  { slug: "doces", name: "Doces", sortOrder: 3 },
];

export const LEPIDO_ITEMS: SeedItem[] = [
  {
    key: "classico",
    category: "burgers",
    name: "Lépido Clássico",
    description: "O clássico que nunca decepciona: suculento, fresco e com o nosso molho especial.",
    priceCents: 2490,
    imageUrl: `${ASSET}/lepido-classico.webp`,
    emoji: "🍔",
    badge: "CAMPEÃO",
    calories: 620,
    ingredients: ["Pão brioche com gergelim", "Burger bovino 150 g", "Queijo cheddar", "Alface", "Tomate", "Molho especial"],
    allergens: "Contém glúten, leite, ovos e gergelim.",
  },
  {
    key: "duplo",
    category: "combos",
    name: "Duplo Lépido",
    description: "Fome grande pede dois burgers, muito cheddar e bacon crocante.",
    priceCents: 3490,
    imageUrl: `${ASSET}/duplo-lepido.webp`,
    emoji: "🍔",
    badge: "FAVORITO",
    calories: 980,
    ingredients: ["Pão brioche com gergelim", "2 burgers bovinos de 120 g", "Cheddar duplo", "Bacon crocante", "Alface", "Molho da casa"],
    allergens: "Contém glúten, leite, ovos e gergelim.",
  },
  {
    key: "frango",
    category: "burgers",
    name: "Frango Crocante",
    description: "Crocante por fora, suculento por dentro e equilibrado pela maionese de limão.",
    priceCents: 2790,
    imageUrl: `${ASSET}/frango-crocante.webp`,
    emoji: "🥪",
    calories: 710,
    ingredients: ["Pão brioche", "Filé de frango empanado", "Coleslaw", "Tomate", "Picles", "Maionese de limão"],
    allergens: "Contém glúten, leite, ovos e mostarda.",
  },
  {
    key: "veggie",
    category: "burgers",
    name: "Lépido Verde",
    description: "Vegetal, colorido e cheio de textura. Uma escolha leve sem abrir mão do sabor.",
    priceCents: 2890,
    imageUrl: `${ASSET}/lepido-verde.webp`,
    emoji: "🥬",
    badge: "VEGGIE",
    calories: 540,
    ingredients: ["Pão integral com sementes", "Burger vegetal", "Queijo", "Alface", "Tomate", "Picles", "Cebola roxa"],
    allergens: "Contém glúten, leite e gergelim.",
  },
  {
    key: "batata",
    category: "combos",
    name: "Batata Monstra",
    description: "Batatas douradas cobertas com cheddar cremoso e uma chuva de bacon.",
    priceCents: 1890,
    imageUrl: `${ASSET}/batata-monstra.webp`,
    emoji: "🍟",
    calories: 590,
    ingredients: ["Batatas crocantes", "Cheddar cremoso", "Bacon crocante", "Tempero Lépido"],
    allergens: "Contém leite. Pode conter glúten.",
  },
  {
    key: "sundae",
    category: "doces",
    name: "Sundae Crocante",
    description: "Cremoso, gelado e com a medida certa de chocolate e crocância.",
    priceCents: 1490,
    imageUrl: `${ASSET}/sundae-crocante.webp`,
    emoji: "🍦",
    calories: 430,
    ingredients: ["Sorvete de baunilha", "Calda de chocolate", "Farofa crocante", "Raspas de chocolate"],
    allergens: "Contém leite, glúten e soja.",
  },
  { key: "cola", category: "bebidas", name: "Cola gelada", description: "Lata 350 ml", priceCents: 790, emoji: "🥤" },
  { key: "limao", category: "bebidas", name: "Limonada da casa", description: "Copo 400 ml", priceCents: 990, emoji: "🍋" },
  { key: "shake", category: "bebidas", name: "Milk-shake", description: "Chocolate • 400 ml", priceCents: 1690, emoji: "🥤" },
];

function storeSlug(clienteSlug: string) {
  const base = clienteSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "food";
  return base;
}

/** Cria a loja e o cardápio se o workspace ainda não tem. Idempotente. */
export async function ensureFoodStore(clienteId: string) {
  const existing = await prisma.foodStore.findUnique({ where: { clienteId } });
  if (existing) return existing;

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, slug: true },
  });
  if (!cliente) throw new Error("Cliente não encontrado");

  let slug = storeSlug(cliente.slug);
  const taken = await prisma.foodStore.findUnique({ where: { slug }, select: { id: true } });
  if (taken) slug = `${slug}-${clienteId.slice(-4)}`.slice(0, 80);

  const lepido = slug === "lepido" || cliente.slug === "lepido";

  return prisma.foodStore.create({
    data: {
      clienteId,
      slug,
      name: lepido ? "Lépido" : cliente.nome,
      deliveryFeeCents: 500,
      pickupName: lepido ? "Lépido Centro" : cliente.nome,
      pickupAddress: lepido ? "Rua das Delícias, 123 • Centro" : null,
      pickupInstructions: "Pronto em aproximadamente 20 minutos",
      categories: {
        create: CATEGORIES.map((c) => ({ name: c.name, slug: c.slug, sortOrder: c.sortOrder })),
      },
      coupons: {
        create: [{ code: "LEPIDO10", type: "PERCENT", value: 10, active: true }],
      },
    },
  });
}

export async function seedFoodCatalog(storeId: string) {
  const categories = await prisma.foodCategory.findMany({ where: { storeId } });
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
  for (const [index, item] of LEPIDO_ITEMS.entries()) {
    const categoryId = bySlug.get(item.category);
    if (!categoryId) continue;
    await prisma.foodItem.upsert({
      where: { storeId_key: { storeId, key: item.key } },
      create: {
        storeId,
        categoryId,
        key: item.key,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        imageUrl: item.imageUrl ?? null,
        emoji: item.emoji,
        badge: item.badge ?? null,
        calories: item.calories ?? null,
        allergens: item.allergens ?? null,
        ingredients: item.ingredients ?? [],
        sortOrder: index,
      },
      update: {},
    });
  }
}

export async function ensureFoodWorkspace(clienteId: string) {
  const store = await ensureFoodStore(clienteId);
  await seedFoodCatalog(store.id);
  return store;
}
