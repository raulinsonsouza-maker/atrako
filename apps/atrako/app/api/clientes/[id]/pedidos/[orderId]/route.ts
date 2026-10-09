import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClienteAccess } from "@/lib/portalSession";
import { formatLocation, orderDetails, type OrderDetails } from "@/lib/commerce/order-details";
import { orderStatusLabel } from "@/lib/commerce-attribution/order-status";
import { storeProviderLabel } from "@/lib/atrako/person";
import { stateName } from "@/lib/geo/place";
import { shippingLabel } from "@/lib/integrations/mercadolivre/shipments";
import { mlItemPhotos } from "@/lib/integrations/mercadolivre/item-photos";

type Ctx = { params: Promise<{ id: string; orderId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id: clienteId, orderId } = await ctx.params;
  if (!clienteId || !orderId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const access = await requireClienteAccess(request, clienteId, "public-read");
  if (access.response) return access.response;

  const order = await prisma.marketplaceOrder.findFirst({
    where: { id: orderId, clienteId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = order.rawPayload && typeof order.rawPayload === "object" ? (order.rawPayload as Record<string, unknown>) : {};
  const details: OrderDetails | null = orderDetails(order.provider, {
    ...raw,
    shippingMode: order.shippingMode,
    logisticType: order.logisticType,
    shippingStatus: order.shippingStatus,
    cityName: order.cityName,
    cityRaw: order.cityRaw,
    stateUf: order.stateUf,
  });

  const missing = order.items
    .filter((item) => !item.imageUrl && item.externalItemId)
    .map((item) => item.externalItemId!);
  const [catalog, mlPhotos] = await Promise.all([
    missing.length
      ? prisma.marketplaceCatalogItem.findMany({
          where: { clienteId, provider: order.provider, externalId: { in: missing } },
          select: { externalId: true, imageUrl: true },
        })
      : Promise.resolve([]),
    order.provider === "MERCADO_LIVRE" ? mlItemPhotos(missing).catch(() => new Map<string, string>()) : Promise.resolve(new Map<string, string>()),
  ]);
  const catalogPhoto = new Map(catalog.map((item) => [item.externalId, item.imageUrl]));

  const place =
    formatLocation(details?.location) ??
    (order.cityName || order.cityRaw
      ? [order.cityName || order.cityRaw, order.stateUf].filter(Boolean).join("/")
      : order.stateUf
        ? stateName(order.stateUf)
        : null);

  const shipMethod =
    details?.shipping?.method ??
    (order.provider === "MERCADO_LIVRE" ? shippingLabel(order.shippingMode, order.logisticType) : null);

  return NextResponse.json({
    id: order.id,
    externalId: order.externalId,
    provider: order.provider,
    providerLabel: storeProviderLabel(order.provider),
    status: order.status,
    statusLabel: orderStatusLabel(order.status),
    occurredAt: (order.occurredAt ?? order.createdAt).toISOString(),
    totalCents: order.totalCents ?? 0,
    currency: order.currency ?? "BRL",
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    place,
    leadId: order.leadId,
    paymentMethod: details?.paymentMethod ?? null,
    installments: details?.installments ?? null,
    coupons: details?.coupons ?? [],
    discountCents: details?.discountCents ?? 0,
    shipping: {
      method: shipMethod && shipMethod !== "—" ? shipMethod : null,
      cents: details?.shipping?.cents ?? null,
      days: details?.shipping?.days ?? null,
      estimatedDate: details?.shipping?.estimatedDate ?? null,
    },
    sellerShippingCents: order.shippingCostCents,
    saleFeeCents: order.saleFeeCents,
    netCents: order.netCents,
    items: order.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      imageUrl:
        item.imageUrl ||
        (item.externalItemId ? catalogPhoto.get(item.externalItemId) || mlPhotos.get(item.externalItemId) || null : null),
    })),
  });
}
