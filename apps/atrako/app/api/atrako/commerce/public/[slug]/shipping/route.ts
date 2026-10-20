import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { asShippingRules, quoteShipping } from "@/lib/commerce/shipping";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const cep = request.nextUrl.searchParams.get("cep")?.trim() ?? "";
  const subtotalCents = Math.max(
    0,
    Number(request.nextUrl.searchParams.get("subtotalCents") ?? 0) || 0,
  );

  const store = await prisma.commerceStore.findUnique({ where: { slug } });
  if (!store || !store.published) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(store.clienteId, "commerce"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const rules = asShippingRules(store.shippingRules);
  const shipping = quoteShipping({
    rules,
    fulfillment: "SHIP",
    cep,
    subtotalCents,
  });

  return NextResponse.json({ shipping, pickupEnabled: rules.pickupEnabled });
}
