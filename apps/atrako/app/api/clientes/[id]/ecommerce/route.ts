import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { requireClienteAccess } from "@/lib/portalSession";

const ECOMMERCE_PROVIDERS = ["WOOCOMMERCE", "SHOPIFY", "TRAY", "NUVEMSHOP"] as const;
type EcommerceProvider = (typeof ECOMMERCE_PROVIDERS)[number];

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

  const [orders, aggregates, catalogCount] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 50,
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
    prisma.marketplaceOrder.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.marketplaceCatalogItem.count({
      where: {
        clienteId,
        provider: { in: providersFilter },
      },
    }),
  ]);

  const withPhone = await prisma.marketplaceOrder.count({
    where: {
      ...where,
      OR: [
        { buyerPhone: { not: null } },
        { contact: { phone: { not: null } } },
      ],
    },
  });

  const orderCount = aggregates._count._all;
  const gmvCents = aggregates._sum.totalCents ?? 0;

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
      orders: orderCount,
      gmvCents,
      avgTicketCents: orderCount > 0 ? Math.round(gmvCents / orderCount) : 0,
      withPhonePct: orderCount > 0 ? Math.round((withPhone / orderCount) * 100) : 0,
      products: catalogCount,
    },
    orders: orders.map((o) => ({
      ...o,
      occurredAt: o.occurredAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
