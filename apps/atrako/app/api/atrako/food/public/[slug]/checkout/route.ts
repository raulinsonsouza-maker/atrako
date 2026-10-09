import { NextRequest, NextResponse } from "next/server";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { prisma } from "@/lib/db";
import { createFoodOrder, previewFoodOrder, type CreateFoodOrderInput } from "@/lib/food/orders";
import type { FoodFulfillment, FoodPaymentMethod } from "@/lib/food/quote";

function readOrder(slug: string, body: Record<string, unknown>): CreateFoodOrderInput | { error: string } {
  const fulfillment = body.fulfillment === "pickup" || body.fulfillment === "PICKUP" ? "PICKUP" : "DELIVERY";
  const paymentRaw = typeof body.paymentMethod === "string" ? body.paymentMethod : typeof body.payment === "string" ? body.payment : "pix";
  const paymentMethod: FoodPaymentMethod =
    paymentRaw === "card" || paymentRaw === "CARD_ON_DELIVERY"
      ? "CARD_ON_DELIVERY"
      : paymentRaw === "cash" || paymentRaw === "CASH"
        ? "CASH"
        : "PIX";
  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        itemId: typeof item.itemId === "string" ? item.itemId : "",
        quantity: Number(item.quantity) || 0,
        removals: Array.isArray(item.removals) ? item.removals.filter((r): r is string => typeof r === "string") : [],
        notes: typeof item.notes === "string" ? item.notes : null,
        additions: Array.isArray(item.additions)
          ? item.additions
              .map((row) => {
                const addition = row as Record<string, unknown>;
                return {
                  optionId: typeof addition.optionId === "string" ? addition.optionId : "",
                  quantity: Number(addition.quantity) || 1,
                };
              })
              .filter((addition) => addition.optionId)
          : [],
      };
    })
    .filter((item) => item.itemId);
  const address = body.address && typeof body.address === "object" ? (body.address as CreateFoodOrderInput["address"]) : null;
  const requestId = typeof body.clientRequestId === "string" ? body.clientRequestId.trim() : "";
  if (!requestId) return { error: "Pedido sem identificador." };
  return {
    slug,
    clientRequestId: requestId,
    channel: "STORE",
    fulfillment: fulfillment as FoodFulfillment,
    paymentMethod,
    customerName: typeof body.customerName === "string" ? body.customerName : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    couponCode: typeof body.couponCode === "string" ? body.couponCode : null,
    changeForCents: Number.isFinite(Number(body.changeForCents)) ? Number(body.changeForCents) : null,
    address,
    items,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await prisma.foodStore.findUnique({ where: { slug }, select: { clienteId: true } });
  if (!store || !(await isPublicModuleEnabled(store.clienteId, "food"))) {
    return NextResponse.json({ error: "Loja indisponível" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = readOrder(slug, body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
  if (body.preview === true) {
    const preview = await previewFoodOrder(input);
    if (!preview.ok) return NextResponse.json({ error: preview.error }, { status: preview.status });
    return NextResponse.json(preview);
  }
  const result = await createFoodOrder(input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
