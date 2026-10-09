import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { createFoodOrder } from "@/lib/food/orders";
import type { FoodFulfillment, FoodPaymentMethod } from "@/lib/food/quote";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;

  const store = await prisma.foodStore.findUnique({ where: { clienteId: workspaceId } });
  if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  const paymentRaw = typeof body.paymentMethod === "string" ? body.paymentMethod : "CASH";
  const paymentMethod: FoodPaymentMethod =
    paymentRaw === "PIX" ? "PIX" : paymentRaw === "CARD_ON_DELIVERY" ? "CARD_ON_DELIVERY" : "CASH";
  const fulfillment: FoodFulfillment = body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP";
  const items = Array.isArray(body.items)
    ? body.items
        .map((row) => {
          const item = row as Record<string, unknown>;
          return {
            itemId: typeof item.itemId === "string" ? item.itemId : "",
            quantity: Number(item.quantity) || 0,
          };
        })
        .filter((item) => item.itemId && item.quantity > 0)
    : [];
  const created = await createFoodOrder({
    slug: store.slug,
    clientRequestId: `counter-${crypto.randomUUID()}`,
    channel: "COUNTER",
    fulfillment,
    paymentMethod,
    customerName: typeof body.customerName === "string" ? body.customerName : "Balcão",
    phone: typeof body.phone === "string" ? body.phone : "",
    address: body.address && typeof body.address === "object" ? (body.address as { street?: string; number?: string; neighborhood?: string; cep?: string }) : null,
    items,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  return NextResponse.json(created);
}
