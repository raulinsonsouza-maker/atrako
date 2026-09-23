import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutShell } from "@/components/shells/CheckoutShell";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { getOrCreatePaymentSettings } from "@/lib/mercadopago/client";
import { resolvePixelForProduct } from "@/lib/meta";
import { CheckoutForm } from "@/app/checkout/[productId]/CheckoutForm";
import { ViewContentTracker } from "@/app/(marketing)/p/[slug]/ViewContentTracker";

type Props = {
  params: Promise<{ offerId: string }>;
  searchParams: Promise<{ orderId?: string }>;
};

export default async function UpsellPage({ params, searchParams }: Props) {
  const { offerId } = await params;
  const { orderId } = await searchParams;

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { offeredProduct: true },
  });

  if (!offer || !offer.active || offer.type !== "POST_PURCHASE") notFound();
  if (offer.offeredProduct.status !== "PUBLISHED") notFound();

  const parentOrder = orderId
    ? await prisma.order.findUnique({ where: { id: orderId } })
    : null;

  const [paymentSettings, pixel] = await Promise.all([
    getOrCreatePaymentSettings(),
    resolvePixelForProduct(offer.offeredProduct.id),
  ]);

  const discountedPriceCents = Math.round(
    offer.offeredProduct.priceCents * (1 - offer.discountPercent / 100),
  );

  return (
    <CheckoutShell title="Oferta especial">
      <MetaPixel pixelId={pixel.pixelId} />
      <ViewContentTracker
        productId={offer.offeredProduct.id}
        value={discountedPriceCents / 100}
        name={offer.offeredProduct.name}
      />
      <div className="stack-lg max-w-xl mx-auto mb-6">
        <div className="stack-sm text-center">
          <h1 className="m-0 text-[var(--text-2xl)]">
            {offer.headline || `Leve também: ${offer.offeredProduct.name}`}
          </h1>
          {offer.description ? (
            <p className="m-0 text-[var(--muted)]">{offer.description}</p>
          ) : null}
          <p className="m-0 text-[var(--text-sm)] text-[var(--ink)] font-medium">
            {offer.discountPercent}% de desconto nesta oferta
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="text-[var(--muted)]">Carregando oferta…</p>}>
        <CheckoutForm
          product={{
            id: offer.offeredProduct.id,
            name: offer.offeredProduct.name,
            priceCents: offer.offeredProduct.priceCents,
            maxInstallments: offer.offeredProduct.maxInstallments,
          }}
          bump={null}
          paymentSettings={{
            cardEnabled: paymentSettings.cardEnabled,
            pixEnabled: paymentSettings.pixEnabled,
            maxInstallments: paymentSettings.maxInstallments,
            minInstallments: paymentSettings.minInstallments,
          }}
          discountedPriceCents={discountedPriceCents}
          parentOrderId={parentOrder?.id}
          prefill={
            parentOrder
              ? {
                  name: parentOrder.name ?? undefined,
                  email: parentOrder.email,
                  cpf: parentOrder.cpf ?? undefined,
                  phone: parentOrder.phone ?? undefined,
                }
              : undefined
          }
        />
      </Suspense>
      <div className="text-center mt-6">
        <Link
          href={orderId ? `/obrigado?orderId=${orderId}` : "/obrigado"}
          className="no-underline"
        >
          <Button variant="ghost">Não, obrigado — continuar</Button>
        </Link>
      </div>
    </CheckoutShell>
  );
}
