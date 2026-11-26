/**
 * Upsert dos 4 colchões Tray (loja 1326584) no commerce Stresser.
 * Mood: atualiza capa/imagens/SKU Tray — NÃO mexe em salesPage nem preços por medida.
 *
 *   npx tsx scripts/import-stresser-tray-products.ts
 */

import { prisma } from "../lib/db";
import { Prisma } from "../lib/generated/prisma";

const SLUG = "stresser";

const SIZE_DELTAS = [
  { label: "Solteiro Padrão", dim: "0,88m × 1,88m", key: "SOL", delta: 0 },
  { label: "Solteiro Americano", dim: "0,96m × 2,03m", key: "SOL-AM", delta: 20000 },
  { label: "Casal", dim: "1,38m × 1,88m", key: "CAS", delta: 0 },
  { label: "Queen", dim: "1,58m × 1,98m", key: "QUEEN", delta: 50000 },
  { label: "King", dim: "1,93m × 2,03m", key: "KING", delta: 100000 },
] as const;

type TrayProduct = {
  trayCode: string;
  slug: string;
  name: string;
  skuPrefix: string;
  /** Preço promocional CSV (centavos). */
  promoCents: number;
  listCents: number;
  images: string[];
  description: string;
  /** Se true, não recria variantes nem sobrescreve preços. */
  preserveVariants: boolean;
};

/** Constantes derivadas do CSV Tray 1326584 (evita encoding Windows). */
const PRODUCTS: TrayProduct[] = [
  {
    trayCode: "90949",
    slug: "pikolin-dense",
    name: "Colchão Pikolin Dense Molas Ensacadas Extra Firme",
    skuPrefix: "DENSE",
    promoCents: 369_800,
    listCents: 493_100,
    images: [
      "https://images.tcdn.com.br/img/img_prod/1326584/colchao_pikolin_dense_molas_ensacadas_90949_1_a62aba6f6edaff10f97f01f6c3139219.jpg",
      "https://images.tcdn.com.br/img/img_prod/1326584/colchao_pikolin_dense_molas_ensacadas_90949_2_f55708b5765e32effd91f6e479b4ed0a.jpg",
      "https://images.tcdn.com.br/img/img_prod/1326584/colchao_pikolin_dense_molas_ensacadas_90949_3_6c84aa1868d1207cf2781418509081a7.jpg",
    ],
    description:
      "Colchão Pikolin Dense Molas Ensacadas Extra Firme — Cross System, látex natural Copper, altura 33 cm, suporte até 250 kg. Frete grátis Brasil. 15% no Pix ou até 10x sem juros.",
    preserveVariants: false,
  },
  {
    trayCode: "92603",
    slug: "pikolin-rise",
    name: "Colchão Pikolin Rise Molas Ensacadas Macio",
    skuPrefix: "RISE",
    promoCents: 397_900,
    listCents: 530_700,
    images: [
      "https://images.tcdn.com.br/img/img_prod/1326584/conjunto_bold_molas_ensacadas_firme_pikolin_92603_1_2520ed02c506d3e4da95224ef9cf6ecb.png",
      "https://images.tcdn.com.br/img/img_prod/1326584/conjunto_bold_molas_ensacadas_firme_pikolin_92603_2_2e460759d88fa226f4feadb06c8cbb63.png",
      "https://images.tcdn.com.br/img/img_prod/1326584/conjunto_bold_molas_ensacadas_firme_pikolin_92603_3_0083dbded3d753cb71e506e57c5abdae.png",
    ],
    description:
      "Colchão Pikolin Rise Molas Ensacadas Macio — linha Cooper System, altura 33 cm, suporte até 250 kg. Frete grátis Brasil. 15% no Pix ou até 10x sem juros.",
    preserveVariants: false,
  },
  {
    trayCode: "92607",
    slug: "pikolin-bold",
    name: "Colchão Pikolin Bold Molas Ensacadas Firme",
    skuPrefix: "BOLD",
    promoCents: 242_000,
    listCents: 284_900,
    images: [
      "https://images.tcdn.com.br/img/img_prod/1326584/colchao_bold_molas_ensacadas_firme_pikolin_92607_1_032622707d9f2109b8b07fbb339cb7df.png",
      "https://images.tcdn.com.br/img/img_prod/1326584/colchao_bold_molas_ensacadas_firme_pikolin_92607_2_643b7aa39bfdc3ae61a0e34777821384.png",
      "https://images.tcdn.com.br/img/img_prod/1326584/colchao_bold_molas_ensacadas_firme_pikolin_92607_3_0560813c2602c5affee23c631797f721.png",
    ],
    description:
      "Colchão Pikolin Bold Molas Ensacadas Firme — linha Hard System, altura 31 cm, suporte até 250 kg. Frete grátis Brasil.",
    preserveVariants: false,
  },
  {
    trayCode: "92781",
    slug: "pikolin-mood",
    name: "Colchão Pikolin Mood Molas Ensacadas Firme",
    skuPrefix: "MOOD",
    promoCents: 299_900,
    listCents: 431_200,
    images: [
      "https://images.tcdn.com.br/img/img_prod/1326584/colcho_pikolin_mood_molas_ensacadas_firme_1_20260809204941_aed1f7947fea.png",
      "https://images.tcdn.com.br/img/img_prod/1326584/colcho_pikolin_mood_molas_ensacadas_firme_2_20260809204941_d5f82233f3df.png",
      "https://images.tcdn.com.br/img/img_prod/1326584/colcho_pikolin_mood_molas_ensacadas_firme_3_20260809204941_fbb81c53d897.png",
    ],
    description:
      "Colchão Pikolin Mood Molas Ensacadas Firme — linha Cooper System. Altura 28 cm, espumas High Support e Cool Touch, pillow top de um lado, suporte individual até 250 kg. Frete grátis Brasil.",
    preserveVariants: true,
  },
];

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { slug: SLUG },
    select: { id: true, nome: true },
  });
  if (!cliente) throw new Error(`Workspace ${SLUG} não encontrado`);

  const store = await prisma.commerceStore.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: "asc" },
  });
  if (!store) throw new Error("CommerceStore Stresser não encontrado — rode seed-stresser-store primeiro");

  const category = await prisma.commerceCategory.upsert({
    where: { storeId_slug: { storeId: store.id, slug: "colchoes" } },
    create: {
      storeId: store.id,
      name: "Colchões",
      slug: "colchoes",
      sortOrder: 0,
      active: true,
    },
    update: { name: "Colchões", active: true },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const p of PRODUCTS) {
    const imagesJson = p.images.map((src, i) => ({
      src,
      alt: `${p.name}${i ? ` · ${i + 1}` : ""}`,
    })) as Prisma.InputJsonValue;

    const existing = await prisma.commerceProduct.findUnique({
      where: { clienteId_slug: { clienteId: cliente.id, slug: p.slug } },
      include: { variants: true },
    });

    const product = await prisma.commerceProduct.upsert({
      where: { clienteId_slug: { clienteId: cliente.id, slug: p.slug } },
      create: {
        clienteId: cliente.id,
        storeId: store.id,
        categoryId: category.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: "PUBLISHED",
        priceCents: p.promoCents,
        maxInstallments: 10,
        coverUrl: p.images[0],
        images: imagesJson,
        stockTracked: true,
        active: true,
        badges: { featured: true, trayCode: p.trayCode } as Prisma.InputJsonValue,
      },
      update: {
        storeId: store.id,
        categoryId: category.id,
        name: p.name,
        description: p.description,
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: "PUBLISHED",
        // Mood: não forçar priceCents do CSV sobre a tabela por medida
        ...(p.preserveVariants ? {} : { priceCents: p.promoCents }),
        maxInstallments: 10,
        coverUrl: p.images[0],
        images: imagesJson,
        stockTracked: true,
        active: true,
        badges: {
          ...(existing?.badges && typeof existing.badges === "object" && !Array.isArray(existing.badges)
            ? (existing.badges as Record<string, unknown>)
            : {}),
          featured: true,
          trayCode: p.trayCode,
        } as Prisma.InputJsonValue,
      },
    });

    let variantsTouched = 0;
    if (!p.preserveVariants) {
      await prisma.commerceVariant.deleteMany({ where: { productId: product.id } });
      let sort = 0;
      for (const size of SIZE_DELTAS) {
        await prisma.commerceVariant.create({
          data: {
            productId: product.id,
            sku: `${p.skuPrefix}-${size.key}`,
            options: { Medida: size.label, Dimensao: size.dim },
            priceCents: Math.max(0, p.promoCents + size.delta),
            stockQty: 10,
            active: true,
            sortOrder: sort++,
          },
        });
        variantsTouched++;
      }
    } else if (existing?.variants.length) {
      // Só garante sku Tray nos existentes se faltar prefixo
      for (const v of existing.variants) {
        if (v.sku?.startsWith(`${p.skuPrefix}-`)) continue;
        const opts =
          v.options && typeof v.options === "object" && !Array.isArray(v.options)
            ? (v.options as Record<string, string>)
            : {};
        const medida = opts.Medida || "";
        const size = SIZE_DELTAS.find((s) => s.label === medida);
        if (!size) continue;
        await prisma.commerceVariant.update({
          where: { id: v.id },
          data: { sku: `${p.skuPrefix}-${size.key}` },
        });
        variantsTouched++;
      }
    }

    results.push({
      slug: p.slug,
      productId: product.id,
      trayCode: p.trayCode,
      preserveVariants: p.preserveVariants,
      variantsTouched,
      salesPageUntouched: p.preserveVariants,
    });
  }

  console.log(JSON.stringify({ workspaceId: cliente.id, storeId: store.id, products: results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
