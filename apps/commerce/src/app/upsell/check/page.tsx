import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ orderId?: string }> };

export default async function UpsellCheckPage({ searchParams }: Props) {
  const { orderId } = await searchParams;
  if (!orderId) redirect("/obrigado");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" }, take: 1 } },
  });

  if (!order || order.items.length === 0) {
    redirect(`/obrigado?orderId=${orderId}`);
  }

  const triggerProductId = order.items[0].productId;
  const offer = await prisma.offer.findFirst({
    where: {
      triggerProductId,
      type: "POST_PURCHASE",
      active: true,
    },
    orderBy: { position: "asc" },
  });

  if (offer) {
    redirect(`/upsell/${offer.id}?orderId=${order.id}`);
  }

  redirect(`/obrigado?orderId=${order.id}`);
}
