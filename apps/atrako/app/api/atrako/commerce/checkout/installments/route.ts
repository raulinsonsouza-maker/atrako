import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { listMpInstallments } from "@/lib/commerce/mp";

/** Parcelas MP para checkout de oferta (`/p/…` / CheckoutForm), por productId. */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId")?.trim() ?? "";
  const bin = request.nextUrl.searchParams.get("bin")?.trim() ?? "";
  const amount = Number(request.nextUrl.searchParams.get("amount") ?? "0");
  if (!productId || bin.length < 6 || !(amount > 0)) {
    return NextResponse.json({ error: "productId, bin e amount obrigatórios" }, { status: 400 });
  }
  const product = await prisma.commerceProduct.findUnique({ where: { id: productId } });
  if (!product || !product.active || product.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Produto indisponível" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(product.clienteId, "commerce"))) {
    return NextResponse.json({ error: "Produto indisponível" }, { status: 404 });
  }
  const maxInstallments =
    typeof product.maxInstallments === "number" && product.maxInstallments > 0
      ? Math.min(product.maxInstallments, 12)
      : 12;
  try {
    const data = await listMpInstallments(product.clienteId, bin.slice(0, 8), amount);
    const options = (data.options ?? []).filter(
      (o) => o.installments >= 1 && o.installments <= maxInstallments,
    );
    return NextResponse.json({
      paymentMethodId: data.paymentMethodId,
      options,
      maxInstallments,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha" },
      { status: 400 },
    );
  }
}
