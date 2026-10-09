import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { requireClienteAccess } from "@/lib/portalSession";
import { refreshMarketplaceSellerSnapshot } from "@/lib/integrations/mercadolivre/insights";
import { shippingFacetKey, shippingLabel } from "@/lib/integrations/mercadolivre/shipments";
import { mlItemPhotos } from "@/lib/integrations/mercadolivre/item-photos";
import { mlBuyerNeedsRefresh, refreshMlBuyerIfThin } from "@/lib/integrations/mercadolivre/enrich-buyer";
import { stateName } from "@/lib/geo/place";
import {
  buildMarketplaceDailySeries,
  MERCADO_LIVRE_PAID_STATUSES,
} from "@/lib/integrations/mercadolivre/metrics";
import type { Prisma } from "@/lib/generated/prisma";

const PROVIDER_MAP: Record<string, string> = {
  MERCADO_LIVRE: "MERCADO_LIVRE",
  ml: "MERCADO_LIVRE",
  mercadolivre: "MERCADO_LIVRE",
  SHOPEE: "SHOPEE",
  shopee: "SHOPEE",
  TIKTOK_SHOP: "TIKTOK_SHOP",
  tiktok: "TIKTOK_SHOP",
  MAGALU: "MAGALU",
  magalu: "MAGALU",
};

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function monthBounds(month: string): { gte: Date; lte: Date } | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(month);
  if (day) {
    const start = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  return {
    gte: new Date(year, mon - 1, 1),
    lte: new Date(year, mon, 0, 23, 59, 59, 999),
  };
}

function shipWhere(key: string): Prisma.MarketplaceOrderWhereInput | null {
  const full: Prisma.MarketplaceOrderWhereInput = {
    OR: [
      { logisticType: { contains: "fulfillment", mode: "insensitive" } },
      { logisticType: { equals: "fbm", mode: "insensitive" } },
    ],
  };
  const flex: Prisma.MarketplaceOrderWhereInput = {
    OR: [
      { logisticType: { contains: "flex", mode: "insensitive" } },
      { shippingMode: { contains: "flex", mode: "insensitive" } },
    ],
  };
  const turbo: Prisma.MarketplaceOrderWhereInput = {
    OR: [
      { logisticType: { contains: "self_service", mode: "insensitive" } },
      { logisticType: { contains: "turbo", mode: "insensitive" } },
    ],
  };
  if (key === "full") return full;
  if (key === "flex") return flex;
  if (key === "turbo") return turbo;
  if (key === "custom") return { shippingMode: { equals: "custom", mode: "insensitive" } };
  if (key === "me") {
    return { AND: [{ shippingMode: { in: ["me1", "me2"] } }, { NOT: { OR: [full, flex, turbo] } }] };
  }
  if (key.startsWith("raw:")) {
    const [, mode, logistic] = key.split(":");
    return {
      ...(mode ? { shippingMode: mode } : { shippingMode: null }),
      ...(logistic ? { logisticType: logistic } : { logisticType: null }),
    };
  }
  return null;
}

function withSlice(
  base: Prisma.MarketplaceOrderWhereInput,
  slice: { uf: string; city: string; ship: string; month: string; product: string },
  skipProduct = false,
): Prisma.MarketplaceOrderWhereInput {
  const extra: Prisma.MarketplaceOrderWhereInput[] = [];
  if (slice.uf === "_") extra.push({ stateUf: null });
  else if (slice.uf) extra.push({ stateUf: slice.uf });
  if (slice.city) extra.push({ OR: [{ cityName: slice.city }, { cityRaw: slice.city }] });
  const bounds = monthBounds(slice.month);
  if (bounds) extra.push({ occurredAt: bounds });
  const freight = shipWhere(slice.ship);
  if (freight) extra.push(freight);
  if (!skipProduct && slice.product) {
    extra.push({
      items: {
        some: {
          OR: [{ externalItemId: slice.product }, { sku: slice.product }, { title: slice.product }],
        },
      },
    });
  }
  if (!extra.length) return base;
  return { AND: [base, ...extra] };
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
  byShipping: [] as Array<{ key: string; label: string; orders: number; costCents: number; gmvCents: number }>,
  byPlace: [] as Array<{
    uf: string;
    nome: string;
    pedidos: number;
    receitaCents: number;
    cidades: Array<{ nome: string; pedidos: number; receitaCents: number }>;
  }>,
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
  const uf = request.nextUrl.searchParams.get("uf")?.trim() || "";
  const city = request.nextUrl.searchParams.get("city")?.trim() || "";
  const ship = request.nextUrl.searchParams.get("ship")?.trim() || "";
  const month = request.nextUrl.searchParams.get("month")?.trim() || "";
  const product = request.nextUrl.searchParams.get("product")?.trim() || "";

  const mlConnection =
    provider === "MERCADO_LIVRE"
      ? await getWorkspaceConnection(clienteId, "MERCADO_LIVRE")
      : null;
  const marketplaceConnection =
    provider === "SHOPEE" || provider === "TIKTOK_SHOP"
      ? await getWorkspaceConnection(clienteId, provider)
      : null;

  const activeConnection = provider === "MERCADO_LIVRE" ? mlConnection : marketplaceConnection;
  const connected = Boolean(
    activeConnection && !["DISCONNECTED", "REVOKED"].includes(activeConnection.status),
  );
  const connectionMeta = activeConnection?.metadata && typeof activeConnection.metadata === "object"
    ? activeConnection.metadata as Record<string, unknown>
    : {};

  if (provider !== "MERCADO_LIVRE" && provider !== "SHOPEE" && provider !== "TIKTOK_SHOP") {
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
  const slice = { uf, city, ship, month, product };
  const viewWhere = withSlice(where, slice);
  const productWhere = withSlice(where, slice, true);
  const commercialWhere = provider === "MERCADO_LIVRE"
    ? { AND: [where, { status: { in: [...MERCADO_LIVRE_PAID_STATUSES] } }] }
    : where;
  const commercialViewWhere = provider === "MERCADO_LIVRE"
    ? { AND: [viewWhere, { status: { in: [...MERCADO_LIVRE_PAID_STATUSES] } }] }
    : viewWhere;
  const commercialProductWhere = provider === "MERCADO_LIVRE"
    ? { AND: [productWhere, { status: { in: [...MERCADO_LIVRE_PAID_STATUSES] } }] }
    : productWhere;
  const seriesBase = withSlice(where, { ...slice, month: "" });
  const commercialSeriesWhere = provider === "MERCADO_LIVRE"
    ? { AND: [seriesBase, { status: { in: [...MERCADO_LIVRE_PAID_STATUSES] } }] }
    : seriesBase;

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

  if (provider === "MERCADO_LIVRE" && connected && !uf && !city && !ship && !month && !product) {
    const thin = await prisma.marketplaceOrder.findMany({
      where: { ...where, cityName: null, buyerPhone: null, buyerEmail: null },
      orderBy: { updatedAt: "asc" },
      take: 24,
    });
    const due = thin.filter((row) => mlBuyerNeedsRefresh(row)).slice(0, 8);
    if (due.length) {
      await Promise.all(due.map((row) => refreshMlBuyerIfThin(row).catch(() => null)));
    }
  }

  const [orders, aggregates, withPhone, itemRows, statusGroups, shippingGroups, placeGroups, seriesRows] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: viewWhere,
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
        stateUf: true,
        cityName: true,
        cityRaw: true,
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
            imageUrl: true,
          },
        },
      },
    }),
    prisma.marketplaceOrder.aggregate({
      where: commercialViewWhere,
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
        AND: [
          commercialViewWhere,
          {
            OR: [
              { buyerPhone: { not: null } },
              { contact: { phone: { not: null } } },
            ],
          },
        ],
      },
    }),
    prisma.marketplaceOrderItem.findMany({
      where: { order: commercialProductWhere },
      select: {
        title: true,
        quantity: true,
        lineTotalCents: true,
        externalItemId: true,
        sku: true,
        imageUrl: true,
        orderId: true,
      },
    }),
    prisma.marketplaceOrder.groupBy({
      by: ["status"],
      where: viewWhere,
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.marketplaceOrder.groupBy({
      by: ["shippingMode", "logisticType"],
      where: commercialWhere,
      _count: { _all: true },
      _sum: { shippingCostCents: true, totalCents: true },
    }),
    prisma.marketplaceOrder.groupBy({
      by: ["stateUf", "cityName", "cityRaw"],
      where: commercialWhere,
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: commercialSeriesWhere,
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
    externalItemId: string | null;
    quantity: number;
    revenueCents: number;
    imageUrl: string | null;
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
      if (!prev.imageUrl && row.imageUrl) prev.imageUrl = row.imageUrl;
    } else {
      productMap.set(key, {
        key,
        title: row.title,
        externalItemId: row.externalItemId,
        quantity: row.quantity,
        revenueCents: row.lineTotalCents,
        imageUrl: row.imageUrl,
        orderIds: new Set([row.orderId]),
      });
    }
  }

  const ranked = [...productMap.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity)
    .slice(0, 30);

  const missingPhotos = ranked
    .filter((item) => !item.imageUrl && item.externalItemId)
    .map((item) => item.externalItemId!);
  const [catalog, mlPhotos] = await Promise.all([
    missingPhotos.length
      ? prisma.marketplaceCatalogItem.findMany({
          where: { clienteId, provider, externalId: { in: missingPhotos } },
          select: { externalId: true, imageUrl: true },
        })
      : Promise.resolve([]),
    mlItemPhotos(missingPhotos).catch(() => new Map<string, string>()),
  ]);
  const catalogPhoto = new Map(catalog.map((item) => [item.externalId, item.imageUrl]));

  const topProducts = ranked.map((item) => ({
    key: item.key,
    title: item.title,
    imageUrl:
      item.imageUrl ||
      (item.externalItemId ? catalogPhoto.get(item.externalItemId) || mlPhotos.get(item.externalItemId) || null : null),
    quantity: item.quantity,
    revenueCents: item.revenueCents,
    orders: item.orderIds.size,
  }));

  const byStatus = statusGroups
    .map((g) => ({
      status: g.status || "unknown",
      orders: g._count._all,
      gmvCents: g._sum.totalCents ?? 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  const shippingMap = new Map<string, { key: string; label: string; orders: number; costCents: number; gmvCents: number }>();
  for (const row of shippingGroups) {
    const named = shippingLabel(row.shippingMode, row.logisticType);
    const key = named === "—" ? `raw:${row.shippingMode || ""}:${row.logisticType || ""}` : shippingFacetKey(row.shippingMode, row.logisticType);
    const label = named === "—" ? row.shippingMode || row.logisticType || "Envio" : named;
    const current = shippingMap.get(key) ?? { key, label, orders: 0, costCents: 0, gmvCents: 0 };
    current.orders += row._count._all;
    current.costCents += row._sum.shippingCostCents ?? 0;
    current.gmvCents += row._sum.totalCents ?? 0;
    shippingMap.set(key, current);
  }
  const byShipping = [...shippingMap.values()].sort((a, b) => b.gmvCents - a.gmvCents || b.orders - a.orders);

  const placeMap = new Map<string, { uf: string; nome: string; pedidos: number; receitaCents: number; cidades: Map<string, { nome: string; pedidos: number; receitaCents: number }> }>();
  for (const row of placeGroups) {
    const uf = row.stateUf || "_";
    const cidade = row.cityName || row.cityRaw || "Sem cidade";
    const current = placeMap.get(uf) ?? {
      uf,
      nome: stateName(row.stateUf),
      pedidos: 0,
      receitaCents: 0,
      cidades: new Map(),
    };
    const pedidos = row._count._all;
    const receitaCents = row._sum.totalCents ?? 0;
    current.pedidos += pedidos;
    current.receitaCents += receitaCents;
    const cityRow = current.cidades.get(cidade) ?? { nome: cidade, pedidos: 0, receitaCents: 0 };
    cityRow.pedidos += pedidos;
    cityRow.receitaCents += receitaCents;
    current.cidades.set(cidade, cityRow);
    placeMap.set(uf, current);
  }
  const byPlace = [...placeMap.values()]
    .map((estado) => ({
      uf: estado.uf,
      nome: estado.nome,
      pedidos: estado.pedidos,
      receitaCents: estado.receitaCents,
      cidades: [...estado.cidades.values()].sort((a, b) => b.receitaCents - a.receitaCents || b.pedidos - a.pedidos),
    }))
    .sort((a, b) => b.receitaCents - a.receitaCents || b.pedidos - a.pedidos);

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
    city: o.cityName || o.cityRaw,
    stateUf: o.stateUf,
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
    byPlace,
    series: buildMarketplaceDailySeries(seriesRows),
    topProducts,
    recentOrders,
    orders: recentOrders,
  });
}
