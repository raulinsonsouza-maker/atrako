import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { OnboardingDialog } from "@/components/ui/OnboardingDialog";

const typeLabel: Record<string, string> = {
  FILE: "Arquivo",
  COURSE: "Curso",
  BUNDLE: "Bundle",
};

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="stack-lg">
      <PageHeader
        title="Produtos"
        description="Gerencie ebooks, cursos e bundles."
        actions={
          <div className="cluster">
            <OnboardingDialog />
            <Link href="/admin/produtos/novo">
              <Button>Novo produto</Button>
            </Link>
          </div>
        }
      />

      <Panel>
        {products.length === 0 ? (
          <EmptyState
            title="Nenhum produto"
            description="Crie seu primeiro produto digital."
            action={{ label: "Criar produto", href: "/admin/produtos/novo" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Nome</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Preço</th>
                  <th className="py-2 pr-3 font-medium">Pixel</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)]">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[var(--muted)] text-[var(--text-xs)]">/{p.slug}</div>
                    </td>
                    <td className="py-3 pr-3">{typeLabel[p.type] ?? p.type}</td>
                    <td className="py-3 pr-3">{formatBRL(p.priceCents)}</td>
                    <td className="py-3 pr-3 font-mono text-[var(--text-xs)] text-[var(--muted)]">
                      {p.metaPixelId ? p.metaPixelId : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={p.status === "PUBLISHED" ? "success" : "default"}>
                        {p.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/produtos/${p.id}`}
                        className="text-[var(--ink)] no-underline font-semibold underline-offset-2 hover:underline decoration-[var(--accent)]"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
