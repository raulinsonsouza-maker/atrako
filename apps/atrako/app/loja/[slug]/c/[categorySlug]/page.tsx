import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontChrome } from "@/components/commerce/StorefrontChrome";
import { StoreProductCard } from "@/components/commerce/StoreProductCard";
import { loadPublicStoreCatalog } from "@/lib/commerce/public-catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const catalog = await loadPublicStoreCatalog(slug).catch(() => null);
  const category = catalog?.categories.find((c) => c.slug === categorySlug);
  if (!catalog || !category) return { title: "Categoria" };
  return { title: `${category.name} · ${catalog.store.name}` };
}

export default async function StoreCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}) {
  const { slug, categorySlug } = await params;
  const catalog = await loadPublicStoreCatalog(slug).catch(() => null);
  if (!catalog) notFound();
  const category = catalog.categories.find((c) => c.slug === categorySlug);
  if (!category) notFound();
  const products = catalog.products.filter((p) => p.categoryId === category.id);

  return (
    <StorefrontChrome
      storeId={catalog.store.id}
      storeSlug={catalog.store.slug}
      storeName={catalog.store.name}
      primaryColor={catalog.brand?.primaryColor || "#cc0000"}
      categories={catalog.categories}
      freeShippingMinCents={catalog.store.freeShippingMinCents}
      theme={catalog.store.theme}
    >
      <nav className="store-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/loja/${slug}`}>Home</Link>
        <span>›</span>
        <span>{category.name}</span>
      </nav>
      <h1 className="store-section-title">{category.name}</h1>
      {products.length === 0 ? (
        <p className="type-caption text-center text-[var(--ink-muted-48)]">Nenhum produto nesta categoria.</p>
      ) : (
        <div className="store-grid">
          {products.map((product) => (
            <StoreProductCard
              key={product.id}
              storeId={catalog.store.id}
              storeSlug={catalog.store.slug}
              product={product}
              isNew={product.badges?.launch}
              highlight={product.badges?.featured}
              extraBadge={product.badges?.extra}
            />
          ))}
        </div>
      )}
    </StorefrontChrome>
  );
}
