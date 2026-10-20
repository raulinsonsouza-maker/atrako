import type { Metadata } from "next";
import { loadPublicStoreCatalog } from "@/lib/commerce/public-catalog";
import { StorePlp } from "@/components/commerce/StorePlp";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await loadPublicStoreCatalog(slug).catch(() => null);
  if (!catalog) return { title: "Loja" };
  return { title: catalog.store.name };
}

export default async function StorePlpPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let catalog = null;
  let loadError: string | null = null;
  try {
    catalog = await loadPublicStoreCatalog(slug);
  } catch (err) {
    console.error("[loja]", err);
    loadError = err instanceof Error ? err.message : "Falha ao carregar";
  }

  if (loadError) {
    return (
      <div className="p-8">
        <p className="type-body">Não foi possível abrir a loja.</p>
        <p className="mt-2 type-caption text-[var(--ink-muted-48)]">{loadError}</p>
      </div>
    );
  }

  if (!catalog) {
    return <p className="p-8 type-body">Loja indisponível.</p>;
  }

  return <StorePlp catalog={catalog} />;
}
