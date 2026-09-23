import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/session";

export default async function MembrosPage() {
  const session = await requireBuyer();
  const entitlements = await prisma.entitlement.findMany({
    where: { userId: session.user.id, revokedAt: null },
    include: { product: true },
    orderBy: { grantedAt: "desc" },
  });

  return (
    <div className="stack">
      <PageHeader
        title="Meus produtos"
        description="Acesse os conteúdos liberados na sua conta."
      />
      {entitlements.length === 0 ? (
        <Panel>
          <p className="m-0 text-[var(--muted)]">
            Você ainda não tem produtos. Após a compra aprovada, eles aparecem aqui.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entitlements.map((e) => (
            <Panel key={e.id} className="stack">
              <div className="stack-sm">
                <h2 className="m-0 text-[var(--text-xl)]">{e.product.name}</h2>
                {e.product.description ? (
                  <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">
                    {e.product.description}
                  </p>
                ) : null}
              </div>
              <Link href={`/membros/produtos/${e.productId}`} className="no-underline">
                <Button className="w-full">Acessar</Button>
              </Link>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
