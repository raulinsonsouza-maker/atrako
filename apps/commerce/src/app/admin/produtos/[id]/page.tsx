import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ProductPixelForm } from "./ProductPixelForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const previewUrl = `/p/${product.slug}`;
  const isLive = product.status === "PUBLISHED";

  return (
    <div className="admin-lp-view">
      <div className="admin-lp-view__toolbar">
        <div className="admin-lp-view__meta">
          <Link href="/admin/produtos" className="admin-lp-view__back">
            <ArrowLeft size={16} />
            Produtos
          </Link>
          <div className="admin-lp-view__title-row">
            <h1>{product.name.replace(/\s*—\s*/g, ": ")}</h1>
            <Badge tone={isLive ? "success" : "default"}>{isLive ? "No ar" : "Rascunho"}</Badge>
          </div>
          <p>
            {formatBRL(product.priceCents)} · <span>{previewUrl}</span>
            {product.metaPixelId ? (
              <>
                {" "}
                · Pixel <span>{product.metaPixelId}</span>
              </>
            ) : (
              <> · Sem pixel próprio</>
            )}
          </p>
        </div>

        <Link href={previewUrl} target="_blank" className="admin-lp-view__open">
          Abrir página
          <ExternalLink size={14} />
        </Link>
      </div>

      <div className="admin-lp-view__layout">
        <ProductPixelForm
          productId={product.id}
          metaPixelId={product.metaPixelId ?? ""}
          hasToken={Boolean(product.metaCapiToken)}
        />

        <div className="admin-lp-view__stage">
          <div className="iphone-container">
            <div className="iphone-screen">
              <div className="island" aria-hidden />
              <iframe
                title={`Preview ${product.name}`}
                src={previewUrl}
                className="iphone-iframe"
              />
              <div className="home-indicator-bar" aria-hidden>
                <div className="home-indicator" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
