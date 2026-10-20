import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { asProductBadges, sanitizeProductHtml } from "@/lib/commerce/badges";
import { ensureCommerceStore } from "@/lib/commerce/store";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "item";
}

function categoryImageUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const url = value.trim().slice(0, 500);
  if (!url) return null;
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  return undefined;
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);
  const [categories, products] = await Promise.all([
    prisma.commerceCategory.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.commerceProduct.findMany({
      where: { storeId: store.id, kind: "PHYSICAL" },
      include: { variants: { orderBy: { sortOrder: "asc" } }, category: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const soldRows = products.length
    ? await prisma.commerceOrderItem.groupBy({
        by: ["productId"],
        where: {
          productId: { in: products.map((p) => p.id) },
          order: { storeId: store.id, status: "APPROVED" },
        },
        _sum: { quantity: true },
      })
    : [];
  const soldById = new Map(soldRows.map((row) => [row.productId, row._sum.quantity ?? 0]));

  const productId = request.nextUrl.searchParams.get("productId")?.trim();
  let summary = null;
  if (productId) {
    const product = products.find((p) => p.id === productId);
    const [sold, recent] = await Promise.all([
      prisma.commerceOrderItem.aggregate({
        where: { productId, order: { storeId: store.id, status: "APPROVED" } },
        _sum: { quantity: true },
      }),
      prisma.commerceOrder.findMany({
        where: { storeId: store.id, items: { some: { productId } } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          status: true,
          totalCents: true,
          items: { where: { productId }, select: { quantity: true } },
        },
      }),
    ]);
    const stockQty = product?.stockTracked
      ? product.variants.reduce((sum, v) => sum + v.stockQty, 0)
      : null;
    const sku = product?.variants.find((v) => v.sku)?.sku ?? null;
    summary = {
      code: sku || productId.slice(-8),
      stockQty,
      soldQty: sold._sum.quantity ?? 0,
      recentOrders: recent.map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        status: order.status,
        totalCents: order.totalCents,
        quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
    };
  }

  return NextResponse.json({
    storeId: store.id,
    categories,
    products: products.map((product) => ({ ...product, soldQty: soldById.get(product.id) ?? 0 })),
    summary,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const action = typeof body.action === "string" ? body.action : "product";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);

  if (action === "category") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    let slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name);
    const taken = await prisma.commerceCategory.findUnique({
      where: { storeId_slug: { storeId: store.id, slug } },
    });
    if (taken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const category = await prisma.commerceCategory.create({
      data: {
        storeId: store.id,
        name: name.slice(0, 80),
        slug,
        sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 0,
        active: body.active !== false,
        imageUrl: categoryImageUrl(body.imageUrl) ?? null,
      },
    });
    return NextResponse.json({ category }, { status: 201 });
  }

  if (action === "product") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    let slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name);
    slug = slug.slice(0, 120);
    const existing = await prisma.commerceProduct.findUnique({
      where: { clienteId_slug: { clienteId: workspaceId, slug } },
    });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`.slice(0, 120);

    const priceCents =
      Number.isInteger(body.priceCents) && Number(body.priceCents) >= 0 ? Number(body.priceCents) : 0;
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;
    if (categoryId) {
      const cat = await prisma.commerceCategory.findFirst({
        where: { id: categoryId, storeId: store.id },
      });
      if (!cat) return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
    }

    const images = Array.isArray(body.images) ? body.images : [];
    const product = await prisma.commerceProduct.create({
      data: {
        clienteId: workspaceId,
        storeId: store.id,
        categoryId,
        name: name.slice(0, 200),
        slug,
        description: typeof body.description === "string" ? body.description : null,
        kind: "PHYSICAL",
        type: "PHYSICAL",
        status: body.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
        priceCents,
        coverUrl: typeof body.coverUrl === "string" ? body.coverUrl.slice(0, 500) : null,
        images,
        stockTracked: body.stockTracked === true,
        active: body.active !== false,
      },
      include: { variants: true, category: true },
    });
    return NextResponse.json({ product }, { status: 201 });
  }

  if (action === "variant") {
    const productId = typeof body.productId === "string" ? body.productId : "";
    const product = await prisma.commerceProduct.findFirst({
      where: { id: productId, storeId: store.id, kind: "PHYSICAL" },
    });
    if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    const options =
      body.options && typeof body.options === "object" && !Array.isArray(body.options)
        ? body.options
        : {};
    const variant = await prisma.commerceVariant.create({
      data: {
        productId,
        sku: typeof body.sku === "string" ? body.sku.trim().slice(0, 64) || null : null,
        options,
        priceCents:
          Number.isInteger(body.priceCents) && Number(body.priceCents) >= 0
            ? Number(body.priceCents)
            : null,
        stockQty: Number.isInteger(body.stockQty) && Number(body.stockQty) >= 0 ? Number(body.stockQty) : 0,
        active: body.active !== false,
        sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 0,
      },
    });
    if (!product.stockTracked) {
      await prisma.commerceProduct.update({
        where: { id: productId },
        data: { stockTracked: true },
      });
    }
    return NextResponse.json({ variant }, { status: 201 });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const action = typeof body.action === "string" ? body.action : "product";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);

  if (action === "category") {
    const id = typeof body.id === "string" ? body.id : "";
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
    if (typeof body.active === "boolean") data.active = body.active;
    if (Number.isInteger(body.sortOrder)) data.sortOrder = Number(body.sortOrder);
    if ("imageUrl" in body) {
      const imageUrl = categoryImageUrl(body.imageUrl);
      if (imageUrl !== undefined) data.imageUrl = imageUrl;
    }
    const updated = await prisma.commerceCategory.updateMany({
      where: { id, storeId: store.id },
      data,
    });
    if (!updated.count) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
    const category = await prisma.commerceCategory.findUnique({ where: { id } });
    return NextResponse.json({ category });
  }

  if (action === "product") {
    const id = typeof body.id === "string" ? body.id : "";
    const product = await prisma.commerceProduct.findFirst({
      where: { id, storeId: store.id, kind: "PHYSICAL" },
    });
    if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 200);
    if (typeof body.slug === "string" && body.slug.trim()) {
      const slug = slugify(body.slug).slice(0, 120);
      const clash = await prisma.commerceProduct.findFirst({
        where: { clienteId: workspaceId, slug, NOT: { id } },
      });
      if (clash) return NextResponse.json({ error: "Endereço já usado por outro produto" }, { status: 409 });
      data.slug = slug;
    }
    if (typeof body.description === "string") data.description = sanitizeProductHtml(body.description) || null;
    if (body.badges !== undefined) data.badges = asProductBadges(body.badges);
    if (typeof body.status === "string") data.status = body.status;
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.stockTracked === "boolean") data.stockTracked = body.stockTracked;
    if (Number.isInteger(body.priceCents) && Number(body.priceCents) >= 0) {
      data.priceCents = Number(body.priceCents);
    }
    if (typeof body.coverUrl === "string") data.coverUrl = body.coverUrl.slice(0, 500) || null;
    if (Array.isArray(body.images)) data.images = body.images;
    if (body.categoryId === null) data.categoryId = null;
    else if (typeof body.categoryId === "string") {
      const cat = await prisma.commerceCategory.findFirst({
        where: { id: body.categoryId, storeId: store.id },
      });
      if (!cat) return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
      data.categoryId = body.categoryId;
    }
    const updated = await prisma.commerceProduct.update({
      where: { id },
      data,
      include: { variants: { orderBy: { sortOrder: "asc" } }, category: true },
    });
    return NextResponse.json({ product: updated });
  }

  if (action === "variant") {
    const id = typeof body.id === "string" ? body.id : "";
    const variant = await prisma.commerceVariant.findFirst({
      where: { id, product: { storeId: store.id } },
    });
    if (!variant) return NextResponse.json({ error: "Variante não encontrada" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (typeof body.sku === "string") data.sku = body.sku.trim().slice(0, 64) || null;
    if (body.options && typeof body.options === "object") data.options = body.options;
    if (body.priceCents === null) data.priceCents = null;
    else if (Number.isInteger(body.priceCents) && Number(body.priceCents) >= 0) {
      data.priceCents = Number(body.priceCents);
    }
    if (Number.isInteger(body.stockQty) && Number(body.stockQty) >= 0) data.stockQty = Number(body.stockQty);
    if (typeof body.active === "boolean") data.active = body.active;
    const updated = await prisma.commerceVariant.update({ where: { id }, data });
    return NextResponse.json({ variant: updated });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const action = typeof body.action === "string" ? body.action : "product";
  const id = typeof body.id === "string" ? body.id : "";
  if (!workspaceId || !id) return NextResponse.json({ error: "dados incompletos" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);

  if (action === "variant") {
    await prisma.commerceVariant.deleteMany({
      where: { id, product: { storeId: store.id } },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "category") {
    await prisma.commerceCategory.deleteMany({ where: { id, storeId: store.id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.commerceProduct.updateMany({
    where: { id, storeId: store.id },
    data: { active: false, status: "ARCHIVED" },
  });
  return NextResponse.json({ ok: true });
}
