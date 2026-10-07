import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { isLpSalesPageV2 } from "@/lib/criar/lp-schema";
import { puckHasBlockType } from "@/lib/criar/puck/puck-checkout";
import { isLpSalesPageV3 } from "@/lib/criar/lp-html";
import { createPreviewToken, lpPreviewPath } from "@/lib/criar/preview-token";
import { publishResource } from "@/lib/atrako-agent/creator";

type Params = { params: Promise<{ productId: string }> };

/** Publicar / voltar para rascunho a partir do detalhe da página. */
export async function POST(request: NextRequest, { params }: Params) {
  const { productId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  try {
    if (body?.action === "unpublish") {
      const res = await prisma.commerceProduct.updateMany({
        where: { id: productId, clienteId: workspaceId },
        data: { status: "DRAFT" },
      });
      if (!res.count) return NextResponse.json({ error: "página não encontrada" }, { status: 404 });
      return NextResponse.json({ status: "DRAFT", warnings: [] });
    }
    const result = await publishResource(workspaceId, "landing_page", productId);
    return NextResponse.json({ status: result.status, publicPath: result.publicPath, warnings: result.warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao publicar" }, { status: 400 });
  }
}

/** Detalhe de uma página/oferta: métricas + leads da LP. */
export async function GET(request: NextRequest, { params }: Params) {
  const { productId } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const product = await prisma.commerceProduct.findFirst({
    where: { id: productId, clienteId: workspaceId },
  });
  if (!product) {
    return NextResponse.json({ error: "página não encontrada" }, { status: 404 });
  }

  const now = Date.now();
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const [orders, leads] = await Promise.all([
    prisma.commerceOrder.findMany({
      where: {
        clienteId: workspaceId,
        items: { some: { productId } },
        status: { in: ["PAID", "APPROVED", "paid", "approved"] },
      },
      include: { items: { where: { productId } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.nativeLead.findMany({
      where: {
        clienteId: workspaceId,
        OR: [
          { source: `lp:${productId}` },
          { source: { startsWith: `lp:${productId}` } },
        ],
      },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  function countInRange(
    items: { createdAt: Date }[],
    since: Date,
  ) {
    return items.filter((i) => i.createdAt >= since).length;
  }

  const conversions7 = countInRange(orders, d7);
  const conversions90 = countInRange(orders, d90);
  const leads7 = countInRange(leads, d7);
  const leads90 = countInRange(leads, d90);

  /** Visitas ainda sem tracking — placeholder alinhado à UI. */
  const visits7 = 0;
  const visits90 = 0;

  const convRate7 =
    visits7 > 0 ? (Math.max(conversions7, leads7) / visits7) * 100 : 0;
  const convRate90 =
    visits90 > 0 ? (Math.max(conversions90, leads90) / visits90) * 100 : 0;

  let pageKind: "leads" | "sales" | "mixed" = "leads";
  let checkoutProductId: string | null = null;
  let formId: string | null = null;
  let format: "html" | "puck" | "sections" = "sections";
  if (isLpSalesPageV3(product.salesPage)) {
    const sp = product.salesPage;
    format = "html";
    formId = sp.formId ?? null;
    checkoutProductId = sp.checkoutProductId ?? null;
    pageKind = sp.goal === "sales" ? "sales" : "leads";
  } else if (isLpSalesPageV2(product.salesPage)) {
    format = "puck";
    const sp = product.salesPage;
    formId = sp.formId ?? null;
    checkoutProductId = sp.checkoutProductId ?? null;
    const hasForm = puckHasBlockType(sp.puck, "AtrakoForm");
    const hasCheckout = puckHasBlockType(sp.puck, "AtrakoCheckout");
    if (hasForm && hasCheckout) pageKind = "mixed";
    else if (hasCheckout || sp.goal === "sales") pageKind = "sales";
    else pageKind = "leads";
  } else if (product.priceCents > 0) {
    pageKind = "sales";
  }

  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      priceCents: product.priceCents,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      pageKind,
      checkoutProductId,
      formId,
      format,
      previewPath: lpPreviewPath(
        product.slug,
        createPreviewToken({ kind: "lp", id: product.id, clienteId: workspaceId }),
      ),
    },
    metrics: {
      visits: { d7: visits7, d90: visits90 },
      conversions: {
        d7: conversions7 + leads7,
        d90: conversions90 + leads90,
      },
      conversionRate: { d7: convRate7, d90: convRate90 },
      impressions: { d7: visits7, d90: visits90 },
      frequency: { d7: 0, d90: 0 },
    },
    leads: leads.map((l) => ({
      id: l.id,
      name: l.contact?.name ?? null,
      email: l.contact?.email ?? null,
      phone: l.contact?.phone ?? null,
      source: l.source,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
