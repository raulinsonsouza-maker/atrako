import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasOnlinePayment } from "@/lib/agenda/payments";
import { getMpPublicKey } from "@/lib/integrations/mercadopago/payments";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ linkSlug: string }> },
) {
  const { linkSlug } = await params;
  const link = await prisma.agendaCheckoutLink.findFirst({
    where: { slug: linkSlug, isActive: true },
    include: {
      product: {
        include: {
          cliente: {
            select: {
              id: true,
              nome: true,
              slug: true,
              logoUrl: true,
              workspaceSettings: { select: { primaryColor: true, currency: true } },
            },
          },
        },
      },
    },
  });
  if (!link || !link.product.isActive) {
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  }

  const workspaceId = link.product.clienteId;
  const [onlinePayment, mercadoPagoPublicKey] = await Promise.all([
    hasOnlinePayment(workspaceId),
    getMpPublicKey(workspaceId),
  ]);

  return NextResponse.json({
    link: {
      id: link.id,
      slug: link.slug,
      title: link.title || link.product.title,
      accentColor:
        link.accentColor ||
        link.product.cliente.workspaceSettings?.primaryColor ||
        "#0066cc",
      logoUrl: link.logoUrl || link.product.cliente.logoUrl,
    },
    product: {
      id: link.product.id,
      title: link.product.title,
      description: link.product.description,
      priceCents: link.product.priceCents,
      productKind: link.product.productKind,
    },
    workspace: {
      name: link.product.cliente.nome,
      slug: link.product.cliente.slug,
    },
    onlinePayment,
    mercadoPagoPublicKey,
  });
}
