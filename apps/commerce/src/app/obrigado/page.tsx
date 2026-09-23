import Link from "next/link";
import { CheckoutShell } from "@/components/shells/CheckoutShell";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { resolvePixelForProduct } from "@/lib/meta";
import { PurchaseTracker } from "./PurchaseTracker";

type Props = { searchParams: Promise<{ orderId?: string }> };

export default async function ObrigadoPage({ searchParams }: Props) {
  const { orderId } = await searchParams;
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      })
    : null;

  const primaryProductId = order?.items[0]?.productId;
  const pixel = await resolvePixelForProduct(primaryProductId);

  return (
    <CheckoutShell title="Pedido recebido">
      <MetaPixel pixelId={pixel.pixelId} />
      {order ? (
        <PurchaseTracker
          eventId={order.eventId}
          value={order.totalCents / 100}
          contentIds={order.items.map((i) => i.productId)}
          contentName={order.items.map((i) => i.name).join(" + ")}
          contents={order.items.map((i) => ({
            id: i.productId,
            quantity: i.quantity,
            item_price: i.priceCents / 100,
          }))}
          status={order.status}
        />
      ) : null}

      <Panel className="stack max-w-lg mx-auto text-center">
        <h1 className="m-0 text-[var(--text-3xl)]">Obrigado!</h1>
        <p className="m-0 text-[var(--muted)]">
          {order?.status === "APPROVED"
            ? "Seu pagamento foi aprovado. O acesso já está liberado."
            : "Recebemos seu pedido. Assim que o pagamento for confirmado, o acesso será liberado por e-mail."}
        </p>
        {order ? (
          <p className="m-0 text-[var(--text-sm)] text-[var(--ink-soft)]">
            Pedido {order.id.slice(0, 8)} · {formatBRL(order.totalCents)} · {order.status}
          </p>
        ) : null}
        <div className="cluster justify-center">
          <Link href="/membros" className="no-underline">
            <Button>Área de membros</Button>
          </Link>
          <Link href="/login" className="no-underline">
            <Button variant="secondary">Fazer login</Button>
          </Link>
        </div>
      </Panel>
    </CheckoutShell>
  );
}
