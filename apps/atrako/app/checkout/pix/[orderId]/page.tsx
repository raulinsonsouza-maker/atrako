import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function PixCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await prisma.commerceOrder.findUnique({ where: { id: orderId } });
  if (!order) notFound();
  if (order.status === "APPROVED") redirect(`/upsell/check?orderId=${order.id}`);

  return (
    <div className="mx-auto max-w-md space-y-4 bg-[var(--canvas-parchment)] px-6 py-16 text-center">
      <h1 className="type-display-lg">Pague com PIX</h1>
      <p className="type-body text-[var(--muted-foreground)]">
        {(order.totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      {order.pixQrCodeBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${order.pixQrCodeBase64}`}
          alt="QR Code PIX"
          className="mx-auto h-56 w-56 rounded-lg border border-[var(--hairline)]"
        />
      ) : null}
      {order.pixCopyPaste ? (
        <textarea
          readOnly
          className="h-24 w-full rounded-lg border border-[var(--hairline)] p-2 text-xs"
          value={order.pixCopyPaste}
        />
      ) : (
        <p className="text-sm text-amber-800">Aguardando QR Code do Mercado Pago…</p>
      )}
      <Link href={`/obrigado?orderId=${order.id}`} className="type-body text-[var(--primary)] underline">
        Já paguei — continuar
      </Link>
    </div>
  );
}
