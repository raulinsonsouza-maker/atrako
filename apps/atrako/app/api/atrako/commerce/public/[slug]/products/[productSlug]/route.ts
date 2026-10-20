import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { asProductBadges, sanitizeProductHtml } from "@/lib/commerce/badges";
import { asStoreTheme } from "@/lib/commerce/theme";
import { resolveBrand, getWorkspaceConfig } from "@/lib/config/getWorkspaceConfig";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; productSlug: string }> },
) {
  const { slug, productSlug } = await params;
  const store = await prisma.commerceStore.findUnique({ where: { slug } });
  if (!store || !store.published) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(store.clienteId, "commerce"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const product = await prisma.commerceProduct.findFirst({
    where: {
      storeId: store.id,
      slug: productSlug,
      kind: "PHYSICAL",
      active: true,
      status: "PUBLISHED",
    },
    include: {
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const config = await getWorkspaceConfig(store.clienteId);
  return NextResponse.json({
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      acceptingOrders: store.acceptingOrders,
      theme: asStoreTheme(store.theme),
    },
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ? sanitizeProductHtml(product.description) : null,
      priceCents: product.priceCents,
      coverUrl: product.coverUrl,
      images: product.images,
      stockTracked: product.stockTracked,
      badges: asProductBadges(product.badges),
      category: product.category ? { id: product.category.id, name: product.category.name, slug: product.category.slug } : null,
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        options: v.options,
        priceCents: v.priceCents,
        stockQty: v.stockQty,
      })),
    },
    brand: config ? resolveBrand(config) : null,
  });
}
