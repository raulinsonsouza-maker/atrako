import { NextResponse } from "next/server";
import { ProductStatus, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const slug = slugify(String(body.slug ?? name));
  const description = body.description ? String(body.description) : null;
  const type = String(body.type ?? "FILE") as ProductType;
  const status = String(body.status ?? "DRAFT") as ProductStatus;
  const priceCents = Number(body.priceCents ?? 0);
  const maxInstallments =
    body.maxInstallments != null && body.maxInstallments !== ""
      ? Number(body.maxInstallments)
      : null;

  if (!name || !slug) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios." }, { status: 400 });
  }
  if (!["FILE", "COURSE", "BUNDLE"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!["DRAFT", "PUBLISHED"].includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        type,
        status,
        priceCents,
        maxInstallments,
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug já existe ou dados inválidos." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.slug != null) data.slug = slugify(String(body.slug));
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description) : null;
  }
  if (body.type != null) data.type = String(body.type) as ProductType;
  if (body.status != null) data.status = String(body.status) as ProductStatus;
  if (body.priceCents != null) data.priceCents = Number(body.priceCents);
  if (body.maxInstallments !== undefined) {
    data.maxInstallments =
      body.maxInstallments != null && body.maxInstallments !== ""
        ? Number(body.maxInstallments)
        : null;
  }
  if (body.salesPage !== undefined) data.salesPage = body.salesPage;

  try {
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar." }, { status: 400 });
  }
}
