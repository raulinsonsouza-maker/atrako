import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { resolveBrand, getWorkspaceConfig } from "@/lib/config/getWorkspaceConfig";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [products, orders, offers, coupons, config] = await Promise.all([
    prisma.commerceProduct.findMany({
      where: { clienteId: workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.commerceOrder.findMany({
      where: { clienteId: workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: true },
    }),
    prisma.commerceOffer.findMany({
      where: { clienteId: workspaceId },
      include: { triggerProduct: true, offeredProduct: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.commerceCoupon.findMany({
      where: { clienteId: workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    getWorkspaceConfig(workspaceId),
  ]);
  const mp = await resolveMercadoPago(workspaceId);

  const statsByProduct = new Map<string, { visits: number; conversions: number }>();
  for (const order of orders) {
    const paid =
      order.status === "PAID" ||
      order.status === "APPROVED" ||
      order.status === "paid" ||
      order.status === "approved";
    for (const item of order.items) {
      const cur = statsByProduct.get(item.productId) ?? {
        visits: 0,
        conversions: 0,
      };
      if (paid) cur.conversions += item.quantity || 1;
      statsByProduct.set(item.productId, cur);
    }
  }

  const productsWithStats = products.map((p) => ({
    ...p,
    visits: statsByProduct.get(p.id)?.visits ?? 0,
    conversions: statsByProduct.get(p.id)?.conversions ?? 0,
  }));

  return NextResponse.json({
    brand: config ? resolveBrand(config) : null,
    mpConnected: Boolean(mp),
    products: productsWithStats,
    orders,
    offers,
    coupons,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const action = typeof b.action === "string" ? b.action : "product";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (action === "offer") {
    const triggerProductId = typeof b.triggerProductId === "string" ? b.triggerProductId : "";
    const offeredProductId = typeof b.offeredProductId === "string" ? b.offeredProductId : "";
    const type = b.type === "POST_PURCHASE" ? "POST_PURCHASE" : "ORDER_BUMP";
    if (!triggerProductId || !offeredProductId) {
      return NextResponse.json({ error: "produtos obrigatórios" }, { status: 400 });
    }
    const offer = await prisma.commerceOffer.create({
      data: {
        clienteId: workspaceId,
        triggerProductId,
        offeredProductId,
        type,
        discountPercent: typeof b.discountPercent === "number" ? b.discountPercent : 0,
        headline: typeof b.headline === "string" ? b.headline : null,
        description: typeof b.description === "string" ? b.description : null,
      },
    });
    return NextResponse.json({ offer }, { status: 201 });
  }

  if (action === "coupon") {
    const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
    const coupon = await prisma.commerceCoupon.create({
      data: {
        clienteId: workspaceId,
        code,
        type: b.type === "FIXED" ? "FIXED" : "PERCENT",
        value: typeof b.value === "number" ? b.value : 10,
        maxUses: typeof b.maxUses === "number" ? b.maxUses : null,
      },
    });
    return NextResponse.json({ coupon }, { status: 201 });
  }

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const slugBase =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || `produto-${Date.now()}`;

  const slug =
    typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : slugBase;
  const priceCents = typeof b.priceCents === "number" ? b.priceCents : 0;
  const description =
    typeof b.description === "string" ? b.description : null;
  const type = typeof b.type === "string" && b.type.trim() ? b.type.trim().toUpperCase() : "FILE";
  const allowedTypes = ["FILE", "SERVICE", "COURSE", "PHYSICAL", "OTHER"];
  const productType = allowedTypes.includes(type) ? type : "FILE";
  const active = b.active === false ? false : true;
  const salesPage =
    b.salesPage && typeof b.salesPage === "object"
      ? (b.salesPage as object)
      : undefined;

  const productId =
    typeof b.productId === "string" ? b.productId.trim() : "";

  if (productId) {
    const existing = await prisma.commerceProduct.findFirst({
      where: { id: productId, clienteId: workspaceId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "página não encontrada" }, { status: 404 });
    }
    const nextStatus =
      b.status === "DRAFT" || b.status === "PUBLISHED"
        ? b.status
        : existing.status;
    const product = await prisma.commerceProduct.update({
      where: { id: existing.id },
      data: {
        name,
        slug,
        priceCents,
        description,
        type: productType,
        status: nextStatus,
        active,
        ...(salesPage !== undefined
          ? { salesPage: salesPage as never }
          : {}),
      },
    });
    return NextResponse.json({ product });
  }

  const product = await prisma.commerceProduct.create({
    data: {
      clienteId: workspaceId,
      name,
      slug,
      priceCents,
      description,
      type,
      status: b.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      active,
      ...(salesPage !== undefined
        ? { salesPage: salesPage as never }
        : {}),
    },
  });
  return NextResponse.json({ product }, { status: 201 });
}
