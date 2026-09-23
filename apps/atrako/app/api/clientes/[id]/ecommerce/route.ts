import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { requireClienteAccess } from "@/lib/portalSession";

const ECOMMERCE_PROVIDERS = ["WOOCOMMERCE"] as const;

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
    request.nextUrl.searchParams.get("provider")?.trim().toUpperCase() ||
    "WOOCOMMERCE";
  const provider = ECOMMERCE_PROVIDERS.includes(
    providerRaw as (typeof ECOMMERCE_PROVIDERS)[number],
  )
    ? providerRaw
    : "WOOCOMMERCE";

  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"), true);

  const wooConnection = await getWorkspaceConnection(clienteId, "WOOCOMMERCE");
  const connected = Boolean(wooConnection && wooConnection.status === "ACTIVE");

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

  const [orders, aggregates] = await Promise.all([
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

  return NextResponse.json({
    provider,
    connected,
    available: true,
    storeLabel: wooConnection?.label ?? null,
    kpis: {
      orders: orderCount,
      gmvCents,
      avgTicketCents: orderCount > 0 ? Math.round(gmvCents / orderCount) : 0,
      withPhonePct: orderCount > 0 ? Math.round((withPhone / orderCount) * 100) : 0,
    },
    orders: orders.map((o) => ({
      ...o,
      occurredAt: o.occurredAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
