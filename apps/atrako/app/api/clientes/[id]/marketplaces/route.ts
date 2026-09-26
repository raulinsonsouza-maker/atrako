import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { requireClienteAccess } from "@/lib/portalSession";
import { refreshMarketplaceSellerSnapshot } from "@/lib/integrations/mercadolivre/insights";
import { shippingLabel } from "@/lib/integrations/mercadolivre/shipments";
import {
  buildMarketplaceDailySeries,
  MERCADO_LIVRE_PAID_STATUSES,
} from "@/lib/integrations/mercadolivre/metrics";

const PROVIDER_MAP: Record<string, string> = {
  MERCADO_LIVRE: "MERCADO_LIVRE",
  ml: "MERCADO_LIVRE",
  mercadolivre: "MERCADO_LIVRE",
  SHOPEE: "SHOPEE",
  shopee: "SHOPEE",
  MAGALU: "MAGALU",
  magalu: "MAGALU",
};

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

const emptyPayload = (provider: string) => ({
  provider,
  connected: false,
  available: false,
  connection: {
    status: "DISCONNECTED",
    sellerConnected: false,
    lastSyncAt: null,
    lastWebhookAt: null,
    lastSyncError: null,
  },
  kpis: {
    orders: 0,
    gmvCents: 0,
    avgTicketCents: 0,
    units: 0,
    uniqueProducts: 0,
    withPhonePct: 0,
    recoverable: 0,
    feesCents: 0,
    shippingCostCents: 0,
    netCents: 0,
    marginPct: 0,
  },
  seller: null as null,
  byStatus: [] as Array<{ status: string; orders: number; gmvCents: number }>,
  byShipping: [] as Array<{ label: string; orders: number }>,
  series: [] as Array<{ date: string; orders: number; gmvCents: number; netCents: number }>,
  topProducts: [],
  recentOrders: [],
  orders: [],
});

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

  const providerRaw = request.nextUrl.searchParams.get("provider")?.trim() || "MERCADO_LIVRE";
  const provider = PROVIDER_MAP[providerRaw] ?? providerRaw.toUpperCase();
  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"), true);
  const refreshSeller = request.nextUrl.searchParams.get("refreshSeller") === "1";

  const mlConnection =
    provider === "MERCADO_LIVRE"
      ? await getWorkspaceConnection(clienteId, "MERCADO_LIVRE")
      : null;
  const shopeeConnection =
    provider === "SHOPEE"
      ? await getWorkspaceConnection(clienteId, "SHOPEE")
      : null;

  const connected =
    provider === "MERCADO_LIVRE"
      ? Boolean(mlConnection && !["DISCONNECTED", "REVOKED"].includes(mlConnection.status))
      : provider === "SHOPEE"
        ? Boolean(shopeeConnection && !["DISCONNECTED", "REVOKED"].includes(shopeeConnection.status))
        : false;

  const activeConnection = provider === "MERCADO_LIVRE" ? mlConnection : shopeeConnection;
  const connectionMeta = activeConnection?.metadata && typeof activeConnection.metadata === "object"
    ? activeConnection.metadata as Record<string, unknown>
    : {};

  if (provider !== "MERCADO_LIVRE" && provider !== "SHOPEE") {
    return NextResponse.json(emptyPayload(provider));
  }

  const where = {
    clienteId,
    provider,
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
  const commercialWhere = provider === "MERCADO_LIVRE"
    ? { ...where, status: { in: [...MERCADO_LIVRE_PAID_STATUSES] } }
    : where;

  let sellerSnapshot =
    connected && provider === "MERCADO_LIVRE"
      ? await prisma.marketplaceSellerSnapshot.findUnique({
          where: {
            clienteId_provider: { clienteId, provider: "MERCADO_LIVRE" },
          },
        })
      : null;

  const stale =
    provider === "MERCADO_LIVRE" &&
    (!sellerSnapshot ||
      Date.now() - sellerSnapshot.capturedAt.getTime() > 6 * 60 * 60 * 1000);

  if (provider === "MERCADO_LIVRE" && connected && (refreshSeller || stale)) {
    try {
      sellerSnapshot = await refreshMarketplaceSellerSnapshot(clienteId);
    } catch (err) {
      console.error("[marketplaces] seller snapshot", err);
    }
  }

  const [orders, aggregates, withPhone, itemRows, statusGroups, shippingRows, seriesRows] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        externalId: true,
        status: true,
        totalCents: true,
        saleFeeCents: true,
        shippingCostCents: true,
        netCents: true,
        currency: true,
        shippingStatus: true,
        shippingMode: true,
        logisticType: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        contactId: true,
        leadId: true,
        occurredAt: true,
        createdAt: true,
        items: {
          select: {
            title: true,
            quantity: true,
            lineTotalCents: true,
            externalItemId: true,
            sku: true,
          },
        },
      },
    }),
    prisma.marketplaceOrder.aggregate({
      where: commercialWhere,
      _count: { _all: true },
      _sum: {
        totalCents: true,
        saleFeeCents: true,
        shippingCostCents: true,
        netCents: true,
      },
    }),
    prisma.marketplaceOrder.count({
      where: {
        ...commercialWhere,
        OR: [
          { buyerPhone: { not: null } },
          { contact: { phone: { not: null } } },
        ],
      },
    }),
    prisma.marketplaceOrderItem.findMany({
      where: { order: commercialWhere },
      select: {
        title: true,
        quantity: true,
        lineTotalCents: true,
        externalItemId: true,
        sku: true,
        orderId: true,
      },
    }),
    prisma.marketplaceOrder.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.marketplaceOrder.findMany({
      where,
      select: { shippingMode: true, logisticType: true, shippingStatus: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: commercialWhere,
      select: {
        occurredAt: true,
        totalCents: true,
        saleFeeCents: true,
        shippingCostCents: true,
        netCents: true,
      },
    }),
  ]);

  const orderCount = aggregates._count._all;
  const gmvCents = aggregates._sum.totalCents ?? 0;
  const feesCents = aggregates._sum.saleFeeCents ?? 0;
  const shippingCostCents = aggregates._sum.shippingCostCents ?? 0;
  const netCents =
    aggregates._sum.netCents ?? gmvCents - feesCents - shippingCostCents;

  type ProductAgg = {
    key: string;
    title: string;
    sku: string | null;
    externalItemId: string | null;
    quantity: number;
    revenueCents: number;
    orderIds: Set<string>;
  };
  const productMap = new Map<string, ProductAgg>();
  let units = 0;

  for (const row of itemRows) {
    units += row.quantity;
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
        externalItemId: row.externalItemId,
        quantity: row.quantity,
        revenueCents: row.lineTotalCents,
        orderIds: new Set([row.orderId]),
      });
    }
  }

  const topProducts = [...productMap.values()]
    .map((p) => ({
      key: p.key,
      title: p.title,
      sku: p.sku,
      externalItemId: p.externalItemId,
      quantity: p.quantity,
      revenueCents: p.revenueCents,
      orders: p.orderIds.size,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity)
    .slice(0, 15);

  const byStatus = statusGroups
    .map((g) => ({
      status: g.status || "unknown",
      orders: g._count._all,
      gmvCents: g._sum.totalCents ?? 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  const shippingMap = new Map<string, number>();
  for (const o of shippingRows) {
    const label =
      provider === "MERCADO_LIVRE"
        ? shippingLabel(o.shippingMode, o.logisticType)
        : o.shippingStatus || o.shippingMode || "Envio";
    shippingMap.set(label, (shippingMap.get(label) ?? 0) + 1);
  }
  const byShipping = [...shippingMap.entries()]
    .map(([label, count]) => ({ label, orders: count }))
    .sort((a, b) => b.orders - a.orders);

  const recentOrders = orders.map((o) => ({
    id: o.id,
    externalId: o.externalId,
    status: o.status,
    totalCents: o.totalCents,
    saleFeeCents: o.saleFeeCents,
    shippingCostCents: o.shippingCostCents,
    netCents: o.netCents,
    currency: o.currency,
    shippingLabel:
      provider === "MERCADO_LIVRE"
        ? shippingLabel(o.shippingMode, o.logisticType)
        : o.shippingStatus || o.shippingMode || "Envio",
    shippingStatus: o.shippingStatus,
    buyerName: o.buyerName,
    buyerEmail: o.buyerEmail,
    buyerPhone: o.buyerPhone,
    contactId: o.contactId,
    leadId: o.leadId,
    occurredAt: o.occurredAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    items: o.items,
    itemSummary:
      o.items.length === 0
        ? "—"
        : o.items.length === 1
          ? `${o.items[0].quantity}× ${o.items[0].title}`
          : `${o.items.reduce((s, i) => s + i.quantity, 0)} un · ${o.items.length} produtos`,
  }));

  return NextResponse.json({
    provider,
    connected,
    available: true,
    connection: {
      status: activeConnection?.status ?? "DISCONNECTED",
      sellerConnected: Boolean(connectionMeta.meliUserId || sellerSnapshot?.meliUserId),
      lastSyncAt:
        (typeof connectionMeta.lastSyncAt === "string" && connectionMeta.lastSyncAt) ||
        activeConnection?.lastSyncedAt?.toISOString() ||
        null,
      lastWebhookAt: typeof connectionMeta.lastWebhookAt === "string" ? connectionMeta.lastWebhookAt : null,
      lastSyncError: typeof connectionMeta.lastSyncError === "string" ? connectionMeta.lastSyncError : null,
    },
    kpis: {
      orders: orderCount,
      gmvCents,
      avgTicketCents: orderCount > 0 ? Math.round(gmvCents / orderCount) : 0,
      units,
      uniqueProducts: productMap.size,
      withPhonePct: orderCount > 0 ? Math.round((withPhone / orderCount) * 100) : 0,
      recoverable: withPhone,
      feesCents,
      shippingCostCents,
      netCents,
      marginPct: gmvCents > 0 ? Math.round((netCents / gmvCents) * 1000) / 10 : 0,
    },
    seller: sellerSnapshot
      ? {
          nickname: sellerSnapshot.nickname,
          reputationLevel: sellerSnapshot.reputationLevel,
          powerSellerStatus: sellerSnapshot.powerSellerStatus,
          transactionsTotal: sellerSnapshot.transactionsTotal,
          ratingsPositive: sellerSnapshot.ratingsPositive,
          ratingsNeutral: sellerSnapshot.ratingsNeutral,
          ratingsNegative: sellerSnapshot.ratingsNegative,
          visitsLast30: sellerSnapshot.visitsLast30,
          capturedAt: sellerSnapshot.capturedAt.toISOString(),
        }
      : null,
    byStatus,
    byShipping,
    series: buildMarketplaceDailySeries(seriesRows),
    topProducts,
    recentOrders,
    orders: recentOrders,
  });
}
