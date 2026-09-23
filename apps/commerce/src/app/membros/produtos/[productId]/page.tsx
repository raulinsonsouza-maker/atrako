import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/session";
import { userHasProductAccess } from "@/lib/entitlements";

type Props = { params: Promise<{ productId: string }> };

export default async function MembroProdutoPage({ params }: Props) {
  const session = await requireBuyer();
  const { productId } = await params;

  const hasAccess = await userHasProductAccess(session.user.id, productId);
  if (!hasAccess) notFound();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      files: { orderBy: { createdAt: "asc" } },
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!product) notFound();

  return (
    <div className="stack">
      <PageHeader title={product.name} description={product.description ?? undefined} />

      {product.type === "FILE" || product.files.length > 0 ? (
        <Panel className="stack">
          <h2 className="m-0 text-[var(--text-xl)]">Arquivos</h2>
          {product.files.length === 0 ? (
            <p className="m-0 text-[var(--muted)]">Nenhum arquivo disponível.</p>
          ) : (
            <ul className="m-0 p-0 list-none stack-sm">
              {product.files.map((file) => (
                <li key={file.id} className="cluster justify-between">
                  <span>{file.name}</span>
                  <a href={`/api/members/download?fileId=${file.id}`}>
                    <Button size="sm">Baixar</Button>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {product.type === "COURSE" || product.modules.length > 0 ? (
        <div className="stack">
          <h2 className="m-0 text-[var(--text-xl)]">Módulos</h2>
          {product.modules.map((mod) => (
            <Panel key={mod.id} className="stack-sm">
              <h3 className="m-0">{mod.title}</h3>
              <ul className="m-0 pl-5 stack-sm">
                {mod.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/membros/produtos/${product.id}/aulas/${lesson.id}`}
                      className="text-[var(--ink)] underline decoration-[var(--accent)]"
                    >
                      {lesson.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
