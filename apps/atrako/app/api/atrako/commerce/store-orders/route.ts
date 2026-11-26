import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { ensureCommerceStore } from "@/lib/commerce/store";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { orderDetails } from "@/lib/commerce/order-details";
import { orderStatusLabel } from "@/lib/commerce-attribution/order-status";

const FULFILLMENT_NEXT: Record<string, string[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function itemSku(options: unknown): string | null {
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  const sku = (options as Record<string, unknown>).sku;
  return typeof sku === "string" && sku.trim() ? sku.trim() : null;
}

function inferPaymentMethod(order: {
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  mpPaymentId: string | null;
  items: { installments: number | null }[];
}): { method: "pix" | "credit_card" | "unknown"; installments: number | null } {
  if (order.pixQrCode || order.pixCopyPaste) return { method: "pix", installments: null };
  const inst = order.items.find((i) => i.installments && i.installments > 0)?.installments ?? null;
  if (inst || order.mpPaymentId) return { method: "credit_card", installments: inst };
  return { method: "unknown", installments: null };
}

type OrderWithItems = {
  id: string;
  email: string;
  name: string | null;
  cpf: string | null;
  phone: string | null;
  status: string;
  fulfillment: string;
  fulfillmentStatus: string;
  subtotalCents: number;
  discountCents: number;
  shippingFeeCents: number;
  totalCents: number;
  createdAt: Date;
  approvedAt: Date | null;
  mpOrderId: string | null;
  mpPaymentId: string | null;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  shippingAddress: unknown;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    options: unknown;
    installments: number | null;
    variantId: string | null;
  }>;
};

function serializeCommerceOrder(order: OrderWithItems) {
  const pay = inferPaymentMethod(order);
  const addr =
    order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)
      ? (order.shippingAddress as Record<string, unknown>)
      : null;
  return {
    channel: "commerce" as const,
    id: order.id,
    externalId: order.id.slice(-8).toUpperCase(),
    email: order.email,
    name: order.name,
    cpf: order.cpf,
    phone: order.phone,
    status: order.status,
    fulfillment: order.fulfillment,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingFeeCents: order.shippingFeeCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt.toISOString(),
    approvedAt: order.approvedAt?.toISOString() ?? null,
    mpOrderId: order.mpOrderId,
    mpPaymentId: order.mpPaymentId,
    paymentMethod: pay.method,
    installments: pay.installments,
    utmSource: order.utmSource,
    utmMedium: order.utmMedium,
    utmCampaign: order.utmCampaign,
    shippingAddress: addr
      ? {
          street: String(addr.street ?? ""),
          number: String(addr.number ?? ""),
          complement: typeof addr.complement === "string" ? addr.complement : null,
          neighborhood: typeof addr.neighborhood === "string" ? addr.neighborhood : null,
          city: String(addr.city ?? ""),
          state: String(addr.state ?? ""),
          cep: String(addr.cep ?? ""),
        }
      : null,
    items: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      priceCents: i.priceCents,
      sku: itemSku(i.options),
      installments: i.installments,
    })),
  };
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
  const channel = request.nextUrl.searchParams.get("channel")?.trim() || "commerce";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);

  if (orderId && channel === "tray") {
    const mo = await prisma.marketplaceOrder.findFirst({
      where: { id: orderId, clienteId: workspaceId, provider: "TRAY" },
      include: { items: true, source: true },
    });
    if (!mo) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    const details = orderDetails(mo.provider, mo.rawPayload);
    const city = mo.cityName || mo.cityRaw || details?.location?.city || "";
    const state = mo.stateUf || details?.location?.state || "";
    const place = city ? (state ? `${city}/${state}` : city) : null;
    const itemsSubtotal = mo.items.reduce((s, i) => s + i.lineTotalCents, 0);
    return NextResponse.json({
      order: {
        channel: "tray" as const,
        id: mo.id,
        externalId: mo.externalId,
        email: mo.buyerEmail,
        name: mo.buyerName,
        cpf: null,
        phone: mo.buyerPhone,
        status: mo.status,
        fulfillment: "SHIP",
        fulfillmentStatus: mo.status,
        statusLabel: orderStatusLabel(mo.status),
        subtotalCents: itemsSubtotal,
        discountCents: details?.discountCents ?? 0,
        shippingFeeCents: details?.shipping?.cents ?? mo.shippingCostCents ?? 0,
        totalCents: mo.totalCents ?? itemsSubtotal,
        createdAt: (mo.occurredAt ?? mo.createdAt).toISOString(),
        approvedAt: null,
        mpOrderId: null,
        mpPaymentId: null,
        paymentMethod: details?.paymentMethod ?? "unknown",
        installments: details?.installments ?? null,
        utmSource: mo.source?.storeSource ?? null,
        utmMedium: mo.source?.storeMedium ?? null,
        utmCampaign: mo.source?.storeCampaign ?? null,
        shippingAddress: place
          ? {
              street: place,
              number: "",
              complement: null,
              neighborhood: null,
              city,
              state,
              cep: "",
            }
          : null,
        shipping: details?.shipping ?? null,
        items: mo.items.map((i) => ({
          id: i.id,
          name: i.title,
          quantity: i.quantity,
          priceCents: i.unitPriceCents,
          sku: i.sku,
          installments: null,
        })),
      },
    });
  }

  if (orderId) {
    const order = await prisma.commerceOrder.findFirst({
      where: { id: orderId, storeId: store.id },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    return NextResponse.json({ order: serializeCommerceOrder(order) });
  }

  const commerceOrders = await prisma.commerceOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true },
  });

  const trayConn = await getWorkspaceConnection(workspaceId, "TRAY");
  const trayOrders =
    trayConn?.status === "ACTIVE"
      ? await prisma.marketplaceOrder.findMany({
          where: { clienteId: workspaceId, provider: "TRAY" },
          orderBy: { occurredAt: "desc" },
          take: 100,
          include: { items: { take: 8 } },
        })
      : [];

  const list = [
    ...commerceOrders.map((o) => ({
      channel: "commerce" as const,
      id: o.id,
      externalId: o.id.slice(-8).toUpperCase(),
      email: o.email,
      name: o.name,
      status: o.status,
      fulfillment: o.fulfillment,
      fulfillmentStatus: o.fulfillmentStatus,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        sku: itemSku(i.options),
      })),
    })),
    ...trayOrders.map((o) => ({
      channel: "tray" as const,
      id: o.id,
      externalId: o.externalId,
      email: o.buyerEmail,
      name: o.buyerName,
      status: o.status,
      fulfillment: "SHIP",
      fulfillmentStatus: o.status,
      totalCents: o.totalCents ?? 0,
      createdAt: (o.occurredAt ?? o.createdAt).toISOString(),
      items: o.items.map((i) => ({
        name: i.title,
        quantity: i.quantity,
        sku: i.sku,
      })),
    })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return NextResponse.json({ orders: list.slice(0, 120), trayConnected: trayConn?.status === "ACTIVE" });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const fulfillmentStatus = typeof body.fulfillmentStatus === "string" ? body.fulfillmentStatus : "";
  if (!workspaceId || !orderId || !fulfillmentStatus) {
    return NextResponse.json({ error: "dados incompletos" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "commerce");
  if (moduleOff) return moduleOff;

  const store = await ensureCommerceStore(workspaceId);
  const order = await prisma.commerceOrder.findFirst({
    where: { id: orderId, storeId: store.id },
  });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const allowed = FULFILLMENT_NEXT[order.fulfillmentStatus] ?? [];
  if (!allowed.includes(fulfillmentStatus)) {
    return NextResponse.json({ error: "Transição inválida" }, { status: 400 });
  }

  const updated = await prisma.commerceOrder.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus,
      status: fulfillmentStatus === "CANCELLED" ? "CANCELLED" : order.status,
    },
    include: { items: true },
  });
  return NextResponse.json({ order: serializeCommerceOrder(updated) });
}
