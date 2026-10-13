import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { resolveMercadoPago, resolveWhatsApp } from "@/lib/config/resolveConnection";
import { resolveLlmChain } from "@/lib/atrako-agent/llm";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [products, agendaLinks, template, whatsapp, mercadoPago, chain] = await Promise.all([
    prisma.commerceProduct.findMany({
      where: { clienteId: workspaceId, active: true, status: "PUBLISHED", priceCents: { gt: 0 } },
      select: { id: true, name: true, priceCents: true },
      orderBy: { name: "asc" },
      take: 40,
    }),
    prisma.agendaCheckoutLink.findMany({
      where: { isActive: true, product: { clienteId: workspaceId, isActive: true } },
      select: { slug: true, title: true, product: { select: { title: true, priceCents: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.waTemplateRef.findFirst({
      where: { clienteId: workspaceId, purpose: "sales_welcome", replacedById: null },
      orderBy: { updatedAt: "desc" },
      select: { status: true },
    }),
    resolveWhatsApp(workspaceId),
    resolveMercadoPago(workspaceId),
    resolveLlmChain(workspaceId),
  ]);

  return NextResponse.json({
    whatsappConnected: Boolean(whatsapp),
    mercadoPagoConnected: Boolean(mercadoPago),
    aiConfigured: chain.configured,
    templateStatus: template?.status ?? null,
    products: products.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents })),
    agendaLinks: agendaLinks.map((link) => ({
      slug: link.slug,
      label: link.title || link.product.title,
      priceCents: link.product.priceCents,
    })),
  });
}
