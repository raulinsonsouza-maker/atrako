import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await prisma.commerceStore.findUnique({ where: { slug } });
  if (!store || !store.published) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(store.clienteId, "commerce"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const mp = await resolveMercadoPago(store.clienteId);
  return NextResponse.json({
    mpConnected: Boolean(mp),
    publicKey: mp?.publicKey ?? null,
  });
}
