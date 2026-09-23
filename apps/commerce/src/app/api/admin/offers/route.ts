import { NextResponse } from "next/server";
import { OfferType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const triggerProductId = String(body.triggerProductId ?? "");
  const offeredProductId = String(body.offeredProductId ?? "");
  const type = String(body.type ?? "ORDER_BUMP") as OfferType;
  const discountPercent = Number(body.discountPercent ?? 0);
  const headline = body.headline ? String(body.headline) : null;
  const description = body.description ? String(body.description) : null;
  const active = body.active !== false && body.active !== "off";

  if (!triggerProductId || !offeredProductId) {
    return NextResponse.json({ error: "Produtos obrigatórios." }, { status: 400 });
  }
  if (!["ORDER_BUMP", "POST_PURCHASE"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return NextResponse.json({ error: "Desconto inválido." }, { status: 400 });
  }

  const offer = await prisma.offer.create({
    data: {
      triggerProductId,
      offeredProductId,
      type,
      discountPercent,
      headline,
      description,
      active,
    },
  });

  return NextResponse.json(offer, { status: 201 });
}
