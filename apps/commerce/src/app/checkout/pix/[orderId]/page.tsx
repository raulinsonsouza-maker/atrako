import { notFound } from "next/navigation";
import { LpShell } from "@/components/shells/LpShell";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { prisma } from "@/lib/prisma";
import { resolvePixelForProduct } from "@/lib/meta";
import { getApprovedOrderFiles } from "@/lib/order-download";
import { formatBRL } from "@/lib/utils";
import { PixStatusClient } from "./PixStatusClient";

type Props = { params: Promise<{ orderId: string }> };

const THEME_BY_SLUG: Record<string, "airfryer" | "plantas" | "bolos"> = {
  "air-fryer-50-receitas": "airfryer",
  "plantas-medicinais": "plantas",
  "100-melhores-bolos": "bolos",
};

const COVER_BY_SLUG: Record<string, string> = {
  "air-fryer-50-receitas": "/produtos/capa-airfryer.png",
  "plantas-medicinais": "/produtos/capa-plantas.png",
  "100-melhores-bolos": "/produtos/capa-bolos.png",
};

export default async function PixCheckoutPage({ params }: Props) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true },
        take: 1,
      },
    },
  });
  if (!order) notFound();

  const item = order.items[0];
  const product = item?.product;
  const slug = product?.slug ?? "";
  const theme = THEME_BY_SLUG[slug] ?? "airfryer";
  const coverUrl =
    product?.coverUrl || COVER_BY_SLUG[slug] || "/produtos/capa-airfryer.png";
  const productName = product?.name ?? item?.name ?? "Seu e-book";
  const priceLabel = formatBRL(order.totalCents);
  const approved = order.status === "APPROVED";
  const initialFiles = approved ? ((await getApprovedOrderFiles(order.id)) ?? []) : [];

  const pixel = await resolvePixelForProduct(product?.id ?? item?.productId);

  return (
    <LpShell
      theme={theme}
      urgencyMessage={
        approved
          ? "Pagamento confirmado — baixe seu material agora"
          : "Seu PIX ainda está disponível — finalize agora"
      }
    >
      <MetaPixel pixelId={pixel.pixelId} />
      <PixStatusClient
        orderId={order.id}
        initialStatus={order.status}
        initialQrBase64={order.pixQrCodeBase64}
        initialCopyPaste={order.pixCopyPaste}
        initialFiles={initialFiles}
        productName={productName}
        productId={product?.id ?? item?.productId}
        coverUrl={coverUrl}
        priceLabel={priceLabel}
        customerEmail={order.email}
        eventId={order.eventId}
        totalCents={order.totalCents}
        theme={theme}
      />
    </LpShell>
  );
}
