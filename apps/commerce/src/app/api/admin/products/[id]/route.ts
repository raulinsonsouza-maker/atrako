import { NextResponse } from "next/server";
import { ProductStatus, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireAdminApi } from "@/lib/admin-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.slug != null) data.slug = slugify(String(body.slug));
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description) : null;
  }
  if (body.type != null) {
    const type = String(body.type);
    if (!["FILE", "COURSE", "BUNDLE"].includes(type)) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }
    data.type = type as ProductType;
  }
  if (body.status != null) {
    const status = String(body.status);
    if (!["DRAFT", "PUBLISHED"].includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    data.status = status as ProductStatus;
  }
  if (body.priceCents != null) {
    const priceCents = Number(body.priceCents);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }
    data.priceCents = priceCents;
  }
  if (body.maxInstallments !== undefined) {
    data.maxInstallments =
      body.maxInstallments != null && body.maxInstallments !== ""
        ? Number(body.maxInstallments)
        : null;
  }
  if (body.salesPage !== undefined) data.salesPage = body.salesPage;
  if (body.metaPixelId !== undefined) {
    data.metaPixelId = body.metaPixelId ? String(body.metaPixelId).trim() : null;
  }
  if (body.metaCapiToken !== undefined) {
    const token = String(body.metaCapiToken ?? "").trim();
    if (token) data.metaCapiToken = token;
    if (body.metaCapiToken === null || body.metaCapiToken === "") {
      data.metaCapiToken = null;
    }
  }

  try {
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar." }, { status: 400 });
  }
}
