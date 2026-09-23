import { NextResponse } from "next/server";
import { CouponType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  const type = String(body.type ?? "PERCENT") as CouponType;
  const value = Number(body.value ?? 0);
  const maxUses =
    body.maxUses != null && body.maxUses !== "" ? Number(body.maxUses) : null;
  const active = body.active !== false && body.active !== "off";

  if (!code) {
    return NextResponse.json({ error: "Código obrigatório." }, { status: 400 });
  }
  if (!["PERCENT", "FIXED"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }

  try {
    const coupon = await prisma.coupon.create({
      data: { code, type, value, maxUses, active },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Código já existe." }, { status: 409 });
  }
}
