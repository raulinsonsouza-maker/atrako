import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getWorkspaceConfig, resolveBrand } from "@/lib/config/getWorkspaceConfig";
import { getMpPublicKey } from "@/lib/integrations/mercadopago/payments";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { BackLink } from "@/components/ui/back-link";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ parentOrderId?: string }>;
}) {
  const { productId } = await params;
  const sp = await searchParams;
  const product = await prisma.commerceProduct.findUnique({ where: { id: productId } });
  if (!product || !product.active || product.status !== "PUBLISHED") notFound();

  const [config, publicKey, bumpOffer] = await Promise.all([
    getWorkspaceConfig(product.clienteId),
    getMpPublicKey(product.clienteId),
    prisma.commerceOffer.findFirst({
      where: {
        clienteId: product.clienteId,
        triggerProductId: product.id,
        type: "ORDER_BUMP",
        active: true,
      },
      include: { offeredProduct: true },
      orderBy: { position: "asc" },
    }),
  ]);
  const brand = config ? resolveBrand(config) : null;

  return (
    <BrandThemeScope
      primaryColor={brand?.primaryColor}
      className="min-h-screen bg-[var(--canvas-parchment)] px-4 py-12"
    >
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <p className="type-fine-print text-[var(--ink-muted-48)]">{brand?.name || "Atrako"}</p>
          <h1 className="mt-1 type-tagline text-[var(--ink)]">{product.name}</h1>
          {product.description ? (
            <p className="mt-2 type-caption text-[var(--ink-muted-80)]">{product.description}</p>
          ) : null}
        </div>
        <Suspense fallback={<p className="type-body text-[var(--ink-muted-48)]">Carregando…</p>}>
          <CheckoutForm
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              priceCents: product.priceCents,
              description: product.description,
            }}
            brandName={brand?.name || "Atrako"}
            currency={brand?.currency || "BRL"}
            mpPublicKey={publicKey}
            parentOrderId={sp.parentOrderId}
            bump={
              bumpOffer
                ? {
                    id: bumpOffer.offeredProduct.id,
                    name: bumpOffer.offeredProduct.name,
                    priceCents: bumpOffer.offeredProduct.priceCents,
                    discountPercent: bumpOffer.discountPercent,
                    headline: bumpOffer.headline,
                  }
                : null
            }
          />
        </Suspense>
        <div className="flex justify-center">
          <BackLink href={`/p/${product.slug}`}>Página</BackLink>
        </div>
      </div>
    </BrandThemeScope>
  );
}
