import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function POST() {
  await requireAdmin();
  await prisma.mercadoPagoAccount.updateMany({
    data: { status: "DISCONNECTED" },
  });
  return NextResponse.json({ ok: true });
}
