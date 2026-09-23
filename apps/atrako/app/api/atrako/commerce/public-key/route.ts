import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMpPublicKey } from "@/lib/integrations/mercadopago/payments";

/** Public key do MP do workspace (Config) — usada no checkout. */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId")?.trim();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
  const product = await prisma.commerceProduct.findUnique({
    where: { id: productId },
    select: { clienteId: true },
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  const publicKey = await getMpPublicKey(product.clienteId);
  return NextResponse.json({ publicKey, workspaceId: product.clienteId });
}
