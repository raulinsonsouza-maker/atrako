import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPaymentLink } from "@/lib/crm/payment-links";
import { PaymentLinkCheckout } from "@/components/payments/PaymentLinkCheckout";

type Props = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const link = await getPublicPaymentLink(token);
  return {
    title: link ? `${link.brand.storeName} · Pagamento` : "Pagamento",
    robots: { index: false, follow: false },
  };
}

export default async function PaymentLinkPage({ params }: Props) {
  const { token } = await params;
  const link = await getPublicPaymentLink(token);
  if (!link) notFound();
  return <PaymentLinkCheckout initial={link} />;
}
