import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function ObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const order = orderId
    ? await prisma.commerceOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-4 bg-[var(--canvas-parchment)] px-6 py-16 text-center">
      <h1 className="type-display-lg">Obrigado!</h1>
      {order ? (
        <>
          <p className="type-body text-[var(--ink-muted-80)]">
            Pedido <code className="text-xs">{order.id}</code> · {order.status}
          </p>
          <ul className="type-body text-[var(--muted-foreground)]">
            {order.items.map((i) => (
              <li key={i.id}>
                {i.name} —{" "}
                {(i.priceCents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </li>
            ))}
          </ul>
          {order.status === "APPROVED" ? (
            <Link href={`/membros?email=${encodeURIComponent(order.email)}`} className="type-body text-[var(--primary)] underline">
              Ir para área de membros
            </Link>
          ) : (
            <p className="text-sm text-amber-800">Aguardando confirmação do pagamento.</p>
          )}
        </>
      ) : (
        <p className="type-body text-[var(--muted-foreground)]">Compra registrada.</p>
      )}
    </div>
  );
}
