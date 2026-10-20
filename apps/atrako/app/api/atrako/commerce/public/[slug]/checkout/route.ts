import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { createStoreOrder, previewStoreOrder, type CartItemInput } from "@/lib/commerce/storefront";

function parseItems(raw: unknown): CartItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        productId: typeof r.productId === "string" ? r.productId : "",
        variantId: typeof r.variantId === "string" ? r.variantId : null,
        quantity: Number.isInteger(r.quantity) ? Number(r.quantity) : 0,
      };
    })
    .filter((i) => i.productId && i.quantity > 0);
}

export async function POST(
  request: NextRequest,
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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const items = parseItems(body.items);
  const fulfillment = body.fulfillment === "PICKUP" ? "PICKUP" : "SHIP";
  const cep = typeof body.cep === "string" ? body.cep : null;
  const couponCode = typeof body.couponCode === "string" ? body.couponCode : null;
  const preview = body.preview === true;

  if (preview) {
    const result = await previewStoreOrder({
      storeId: store.id,
      items,
      fulfillment,
      cep,
      couponCode,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const paymentRaw = body.payment && typeof body.payment === "object" ? (body.payment as Record<string, unknown>) : {};
  const payment =
    paymentRaw.type === "card"
      ? {
          type: "card" as const,
          token: String(paymentRaw.token ?? ""),
          paymentMethodId: String(paymentRaw.paymentMethodId ?? ""),
          installments: Number(paymentRaw.installments) || 1,
        }
      : { type: "pix" as const };

  const result = await createStoreOrder({
    storeId: store.id,
    items,
    fulfillment,
    cep,
    couponCode,
    expectedTotalCents: Number(body.expectedTotalCents) || 0,
    clientRequestId: typeof body.clientRequestId === "string" ? body.clientRequestId : "",
    email: typeof body.email === "string" ? body.email : "",
    name: typeof body.name === "string" ? body.name : "",
    phone: typeof body.phone === "string" ? body.phone : null,
    cpf: typeof body.cpf === "string" ? body.cpf : "",
    shippingAddress:
      body.shippingAddress && typeof body.shippingAddress === "object"
        ? (body.shippingAddress as Record<string, unknown>)
        : null,
    payment,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    order: {
      id: result.order.id,
      publicToken: result.order.publicToken,
      status: result.order.status,
      totalCents: result.order.totalCents,
      pixQrCode: result.order.pixQrCode,
      pixQrCodeBase64: result.order.pixQrCodeBase64,
      pixCopyPaste: result.order.pixCopyPaste,
      fulfillment: result.order.fulfillment,
    },
    reused: result.reused,
  });
}
