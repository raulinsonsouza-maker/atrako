import { prisma } from "@/lib/db";
import Link from "next/link";

/** Área do comprador por e-mail (entitlements do workspace). */
export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; workspaceId?: string }>;
}) {
  const { email, workspaceId } = await searchParams;
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    return (
      <div className="mx-auto max-w-md space-y-3 bg-[var(--canvas-parchment)] px-6 py-16">
        <h1 className="type-display-lg">Área de membros</h1>
        <p className="type-body text-[var(--muted-foreground)]">Informe o e-mail da compra na URL: ?email=</p>
      </div>
    );
  }

  const entitlements = await prisma.commerceEntitlement.findMany({
    where: {
      email: normalized,
      revokedAt: null,
      ...(workspaceId ? { clienteId: workspaceId } : {}),
    },
    include: { product: true },
    orderBy: { grantedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 bg-[var(--canvas-parchment)] px-6 py-16">
      <h1 className="type-display-lg">Seus produtos</h1>
      <p className="type-body text-[var(--muted-foreground)]">{normalized}</p>
      <ul className="divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)] bg-[var(--canvas)]">
        {entitlements.map((e) => (
          <li key={e.id} className="px-4 py-3 type-body">
            <p className="type-body-strong">{e.product.name}</p>
            <Link href={`/p/${e.product.slug}`} className="type-caption-strong text-[var(--primary)] underline">
              Ver oferta
            </Link>
          </li>
        ))}
        {!entitlements.length ? (
          <li className="px-4 py-6 text-[var(--muted-foreground)]">Nenhum acesso liberado ainda.</li>
        ) : null}
      </ul>
    </div>
  );
}
