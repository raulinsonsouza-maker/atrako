import { cache } from "react";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { asProductBadges, type ProductBadges } from "@/lib/commerce/badges";
import { publicBanners, type StoreBanner } from "@/lib/commerce/banners";
import { asStoreTheme, type StoreTheme } from "@/lib/commerce/theme";
import { asShippingRules } from "@/lib/commerce/shipping";

export type PublicStoreCatalog = {
  store: {
    id: string;
    slug: string;
    name: string;
    acceptingOrders: boolean;
    shipEnabled: boolean;
    pickupEnabled: boolean;
    minOrderCents: number;
    pickupName: string | null;
    pickupAddress: string | null;
    pickupInstructions: string | null;
    freeShippingMinCents: number | null;
    banners: StoreBanner[];
    theme: StoreTheme;
  };
  categories: { id: string; name: string; slug: string; imageUrl: string | null }[];
  products: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    priceCents: number;
    coverUrl: string | null;
    images: unknown;
    categoryId: string | null;
    stockTracked: boolean;
    badges: ProductBadges;
    variants: {
      id: string;
      sku: string | null;
      options: unknown;
      priceCents: number | null;
      stockQty: number;
    }[];
  }[];
  brand: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    timezone: string;
    currency: string;
  } | null;
};

export const loadPublicStoreCatalog = cache(async function loadPublicStoreCatalog(
  slug: string,
): Promise<PublicStoreCatalog | null> {
  const store = await prisma.commerceStore.findUnique({
    where: { slug },
    include: {
      categories: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!store || !store.published) return null;

  const [moduleOn, products, cliente] = await Promise.all([
    isPublicModuleEnabled(store.clienteId, "commerce"),
    prisma.commerceProduct.findMany({
      where: {
        storeId: store.id,
        kind: "PHYSICAL",
        active: true,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        coverUrl: true,
        categoryId: true,
        stockTracked: true,
        badges: true,
        variants: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            sku: true,
            options: true,
            priceCents: true,
            stockQty: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cliente.findUnique({
      where: { id: store.clienteId },
      select: {
        nome: true,
        slug: true,
        logoUrl: true,
        workspaceSettings: {
          select: { primaryColor: true, timezone: true, currency: true },
        },
      },
    }),
  ]);
  if (!moduleOn) return null;

  const rules = asShippingRules(store.shippingRules);
  const settings = cliente?.workspaceSettings;

  return {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      acceptingOrders: store.acceptingOrders,
      shipEnabled: store.shipEnabled,
      pickupEnabled: store.pickupEnabled,
      minOrderCents: store.minOrderCents,
      pickupName: store.pickupName,
      pickupAddress: store.pickupAddress,
      pickupInstructions: store.pickupInstructions,
      freeShippingMinCents: rules.freeShippingMinCents,
      banners: publicBanners(store.banners),
      theme: asStoreTheme(store.theme),
    },
    categories: store.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl,
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: null,
      priceCents: p.priceCents,
      coverUrl: p.coverUrl,
      images: [],
      categoryId: p.categoryId,
      stockTracked: p.stockTracked,
      badges: asProductBadges(p.badges),
      variants: p.variants,
    })),
    brand: cliente
      ? {
          name: cliente.nome,
          slug: cliente.slug,
          logoUrl: cliente.logoUrl,
          primaryColor: settings?.primaryColor ?? null,
          timezone: settings?.timezone ?? "America/Sao_Paulo",
          currency: settings?.currency ?? "BRL",
        }
      : null,
  };
});
