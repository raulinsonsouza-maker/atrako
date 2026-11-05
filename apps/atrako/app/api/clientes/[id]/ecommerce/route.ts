import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { requireClienteAccess } from "@/lib/portalSession";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { brtDay, brtRange, isYmd } from "@/lib/commerce-attribution/period";

const ECOMMERCE_PROVIDERS = ["WOOCOMMERCE", "SHOPIFY", "TRAY", "NUVEMSHOP"] as const;
type EcommerceProvider = (typeof ECOMMERCE_PROVIDERS)[number];

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  if (isYmd(value)) {
    const range = brtRange(value, value);
    return endOfDay ? range.lte : range.gte;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isEcommerceProvider(value: string): value is EcommerceProvider {
  return (ECOMMERCE_PROVIDERS as readonly string[]).includes(value);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: clienteId } = await context.params;
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId required" }, { status: 400 });
  }

  const access = await requireClienteAccess(request, clienteId, "public-read");
  if (access.response) return access.response;

  const providerRaw =
    request.nextUrl.searchParams.get("provider")?.trim().toUpperCase() || "";
  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"), true);

  const wooConnection = await getWorkspaceConnection(clienteId, "WOOCOMMERCE");
  const shopifyConnection = await getWorkspaceConnection(clienteId, "SHOPIFY");
  const trayConnection = await getWorkspaceConnection(clienteId, "TRAY");
  const nuvemshopConnection = await getWorkspaceConnection(clienteId, "NUVEMSHOP");
  const wooConnected = Boolean(wooConnection && wooConnection.status === "ACTIVE");
  const shopifyConnected = Boolean(
    shopifyConnection && shopifyConnection.status === "ACTIVE",
  );
  const trayConnected = Boolean(trayConnection && trayConnection.status === "ACTIVE");
  const nuvemshopConnected = Boolean(
    nuvemshopConnection && nuvemshopConnection.status === "ACTIVE",
  );

  let provider: EcommerceProvider | "ALL" = "ALL";
  if (providerRaw && isEcommerceProvider(providerRaw)) {
    provider = providerRaw;
  } else if (providerRaw === "ALL" || !providerRaw) {
    const connectedCount = [
      wooConnected,
      shopifyConnected,
      trayConnected,
      nuvemshopConnected,
    ].filter(Boolean).length;
    if (connectedCount === 1) {
      if (shopifyConnected) provider = "SHOPIFY";
      else if (trayConnected) provider = "TRAY";
      else if (nuvemshopConnected) provider = "NUVEMSHOP";
      else provider = "WOOCOMMERCE";
    } else {
      provider = "ALL";
    }
  }

  const providersFilter: string[] =
    provider === "ALL" ? [...ECOMMERCE_PROVIDERS] : [provider];

  const where = {
    clienteId,
    provider: { in: providersFilter },
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [orders, statusGroups, storeGroups, metricRows, itemRows, catalogCount] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: {
        id: true,
        externalId: true,
        status: true,
        totalCents: true,
        currency: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        contactId: true,
        leadId: true,
        occurredAt: true,
        createdAt: true,
        provider: true,
      },
    }),
    prisma.marketplaceOrder.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    provider === "ALL"
      ? prisma.marketplaceOrder.groupBy({
          by: ["provider", "status"],
          where,
          _count: { _all: true },
          _sum: { totalCents: true },
        })
      : Promise.resolve([]),
    prisma.marketplaceOrder.findMany({
      where,
      select: { occurredAt: true, totalCents: true, status: true },
    }),
    prisma.marketplaceOrderItem.findMany({
      where: { order: where },
      select: {
        title: true,
        quantity: true,
        lineTotalCents: true,
        externalItemId: true,
        sku: true,
        orderId: true,
        order: { select: { status: true } },
      },
    }),
    prisma.marketplaceCatalogItem.count({
      where: {
        clienteId,
        provider: { in: providersFilter },
      },
    }),
  ]);

  let revenueOrders = 0;
  let gmvCents = 0;
  let excludedOrders = 0;
  let excludedCents = 0;
  const byDate = new Map<string, { date: string; orders: number; gmvCents: number }>();
  for (const row of metricRows) {
    const cents = row.totalCents ?? 0;
    if (!isRevenueOrder(row.status)) {
      excludedOrders += 1;
      excludedCents += cents;
      continue;
    }
    revenueOrders += 1;
    gmvCents += cents;
    if (!row.occurredAt) continue;
    const date = brtDay(row.occurredAt);
    const current = byDate.get(date) ?? { date, orders: 0, gmvCents: 0 };
    current.orders += 1;
    current.gmvCents += cents;
    byDate.set(date, current);
  }

  const byStatus = statusGroups
    .map((group) => ({
      status: group.status || "unknown",
      orders: group._count._all,
      gmvCents: group._sum.totalCents ?? 0,
    }))
    .sort((a, b) => b.gmvCents - a.gmvCents || b.orders - a.orders);

  const storeMap = new Map<string, { provider: string; orders: number; gmvCents: number }>();
  for (const group of storeGroups) {
    if (!isRevenueOrder(group.status)) continue;
    const current = storeMap.get(group.provider) ?? {
      provider: group.provider,
      orders: 0,
      gmvCents: 0,
    };
    current.orders += group._count._all;
    current.gmvCents += group._sum.totalCents ?? 0;
    storeMap.set(group.provider, current);
  }
  const byStore = [...storeMap.values()].sort((a, b) => b.gmvCents - a.gmvCents);

  type ProductAgg = {
    key: string;
    title: string;
    sku: string | null;
    quantity: number;
    revenueCents: number;
    orderIds: Set<string>;
  };
  const productMap = new Map<string, ProductAgg>();
  for (const row of itemRows) {
    if (!isRevenueOrder(row.order.status)) continue;
    const key = row.externalItemId || row.sku || row.title;
    const prev = productMap.get(key);
    if (prev) {
      prev.quantity += row.quantity;
      prev.revenueCents += row.lineTotalCents;
      prev.orderIds.add(row.orderId);
    } else {
      productMap.set(key, {
        key,
        title: row.title,
        sku: row.sku,
        quantity: row.quantity,
        revenueCents: row.lineTotalCents,
        orderIds: new Set([row.orderId]),
      });
    }
  }
  const topProducts = [...productMap.values()]
    .map((item) => ({
      key: item.key,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      revenueCents: item.revenueCents,
      orders: item.orderIds.size,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity)
    .slice(0, 5);

  const connected =
    wooConnected || shopifyConnected || trayConnected || nuvemshopConnected;
  const storeLabel =
    provider === "SHOPIFY"
      ? shopifyConnection?.label ?? null
      : provider === "TRAY"
        ? trayConnection?.label ?? null
        : provider === "NUVEMSHOP"
          ? nuvemshopConnection?.label ?? null
          : provider === "WOOCOMMERCE"
            ? wooConnection?.label ?? null
            : shopifyConnection?.label ||
              trayConnection?.label ||
              nuvemshopConnection?.label ||
              wooConnection?.label ||
              null;

  return NextResponse.json({
    provider,
    providers: {
      WOOCOMMERCE: {
        connected: wooConnected,
        label: wooConnection?.label ?? null,
      },
      SHOPIFY: {
        connected: shopifyConnected,
        label: shopifyConnection?.label ?? null,
      },
      TRAY: {
        connected: trayConnected,
        label: trayConnection?.label ?? null,
      },
      NUVEMSHOP: {
        connected: nuvemshopConnected,
        label: nuvemshopConnection?.label ?? null,
      },
    },
    connected,
    available: true,
    storeLabel,
    catalogCount,
    kpis: {
      orders: revenueOrders,
      gmvCents,
      avgTicketCents: revenueOrders > 0 ? Math.round(gmvCents / revenueOrders) : 0,
      excludedOrders,
      excludedCents,
      products: catalogCount,
    },
    series: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byStatus,
    byStore,
    topProducts,
    orders: orders.map((o) => ({
      ...o,
      occurredAt: o.occurredAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
