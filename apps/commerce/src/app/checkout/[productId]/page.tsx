import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ productId: string }> };

/** Checkout fica embutido na landing — redireciona para /p/[slug]#checkout */
export default async function CheckoutPage({ params }: Props) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, status: true },
  });
  if (!product || product.status !== "PUBLISHED") notFound();
  redirect(`/p/${product.slug}#checkout`);
}
