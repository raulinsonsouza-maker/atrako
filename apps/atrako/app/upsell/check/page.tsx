import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

/** Após compra: oferece upsell POST_PURCHASE se houver. */
export default async function UpsellCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) redirect("/");

  const order = await prisma.commerceOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) redirect("/");

  const triggerIds = order.items.map((i) => i.productId);
  const offer = await prisma.commerceOffer.findFirst({
    where: {
      clienteId: order.clienteId,
      type: "POST_PURCHASE",
      active: true,
      triggerProductId: { in: triggerIds },
    },
    include: { offeredProduct: true },
    orderBy: { position: "asc" },
  });

  if (!offer) redirect(`/obrigado?orderId=${order.id}`);

  const price = Math.round(
    offer.offeredProduct.priceCents * (1 - offer.discountPercent / 100),
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 bg-[var(--canvas-parchment)] px-6 py-16 text-center">
      <p className="type-body text-emerald-700">Pedido confirmado</p>
      <h1 className="type-display-lg">{offer.headline || "Oferta especial"}</h1>
      {offer.description ? <p className="type-body text-[var(--ink-muted-80)]">{offer.description}</p> : null}
      <p className="type-lead">
        {offer.offeredProduct.name} —{" "}
        {(price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        {offer.discountPercent ? ` (−${offer.discountPercent}%)` : ""}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/checkout/${offer.offeredProduct.id}?parentOrderId=${order.id}`}
          className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-6 py-3 type-body text-[var(--on-primary)]"
        >
          Quero essa oferta
        </Link>
        <Link href={`/obrigado?orderId=${order.id}`} className="rounded-[var(--radius-xs)] border border-[var(--hairline)] px-6 py-3 type-body">
          Não, obrigado
        </Link>
      </div>
    </div>
  );
}
