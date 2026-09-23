import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { CreateOfferForm } from "./CreateOfferForm";

const typeLabel: Record<string, string> = {
  ORDER_BUMP: "Order bump",
  POST_PURCHASE: "Pós-compra",
};

export default async function AdminOffersPage() {
  const [offers, products] = await Promise.all([
    prisma.offer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        triggerProduct: { select: { name: true } },
        offeredProduct: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Ofertas / Upsells"
        description="Order bumps e ofertas pós-compra."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CreateOfferForm products={products} />
        <Panel>
          {offers.length === 0 ? (
            <EmptyState title="Nenhuma oferta" description="Crie uma oferta ao lado." />
          ) : (
            <ul className="m-0 p-0 list-none stack">
              {offers.map((o) => (
                <li
                  key={o.id}
                  className="border-b border-[var(--border)] pb-3 text-[var(--text-sm)] stack-sm"
                >
                  <div className="cluster justify-between gap-2">
                    <strong>{o.headline || typeLabel[o.type]}</strong>
                    <Badge tone={o.active ? "success" : "default"}>
                      {o.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <div className="text-[var(--muted)]">
                    {typeLabel[o.type]} · {o.discountPercent}% off
                  </div>
                  <div>
                    Gatilho: {o.triggerProduct.name} → Oferecido: {o.offeredProduct.name}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
