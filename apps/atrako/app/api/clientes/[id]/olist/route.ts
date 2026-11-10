import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { requireClienteAccess } from "@/lib/portalSession";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { brtRange, isYmd } from "@/lib/commerce-attribution/period";

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  if (isYmd(value)) {
    const range = brtRange(value, value);
    return endOfDay ? range.lte : range.gte;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function payloadOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
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

  const connection = await getWorkspaceConnection(clienteId, "OLIST_ERP");
  const connected = Boolean(connection && connection.status === "ACTIVE");

  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"), true);

  if (!connected) {
    return NextResponse.json({
      connected: false,
      kpis: { orders: 0, gmvCents: 0, matchedWoo: 0, matchRate: 0, avgTicketCents: 0 },
      byStatus: [],
      orders: [],
      dualCustomers: [],
    });
  }

  const where = {
    clienteId,
    provider: "OLIST_ERP",
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [orders, statusGroups, allForMatch] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 40,
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
        shippingStatus: true,
        shippingId: true,
        rawPayload: true,
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
      select: {
        id: true,
        status: true,
        totalCents: true,
        contactId: true,
        rawPayload: true,
      },
    }),
  ]);

  let gmvCents = 0;
  let revenueOrders = 0;
  let matchedWoo = 0;
  for (const row of allForMatch) {
    const payload = payloadOf(row.rawPayload);
    if (payload.wooExternalId || payload.wooOrderId) matchedWoo += 1;
    if (!isRevenueOrder(row.status)) continue;
    revenueOrders += 1;
    gmvCents += row.totalCents ?? 0;
  }

  const dualContactIds = [
    ...new Set(
      allForMatch
        .filter((o) => {
          const p = payloadOf(o.rawPayload);
          return Boolean(o.contactId && (p.wooExternalId || p.wooOrderId));
        })
        .map((o) => o.contactId as string),
    ),
  ].slice(0, 30);

  const dualContacts = dualContactIds.length
    ? await prisma.nativeContact.findMany({
        where: { id: { in: dualContactIds }, clienteId },
        select: { id: true, name: true, email: true, phone: true },
      })
    : [];

  const dualCustomers = dualContacts.map((c) => ({
    contactId: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
  }));

  return NextResponse.json({
    connected: true,
    label: connection?.label ?? "Olist ERP",
    apiVersion:
      connection?.metadata &&
      typeof connection.metadata === "object" &&
      !Array.isArray(connection.metadata)
        ? (connection.metadata as Record<string, unknown>).apiVersion ?? null
        : null,
    kpis: {
      orders: revenueOrders,
      gmvCents,
      matchedWoo,
      matchRate: allForMatch.length ? Math.round((matchedWoo / allForMatch.length) * 100) : 0,
      avgTicketCents: revenueOrders ? Math.round(gmvCents / revenueOrders) : 0,
      totalListed: allForMatch.length,
    },
    byStatus: statusGroups
      .map((g) => ({
        status: g.status ?? "unknown",
        orders: g._count._all,
        gmvCents: g._sum.totalCents ?? 0,
      }))
      .sort((a, b) => b.orders - a.orders),
    orders: orders.map((o) => {
      const payload = payloadOf(o.rawPayload);
      return {
        id: o.id,
        externalId: o.externalId,
        status: o.status,
        totalCents: o.totalCents,
        currency: o.currency,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        buyerPhone: o.buyerPhone,
        contactId: o.contactId,
        leadId: o.leadId,
        occurredAt: o.occurredAt?.toISOString() ?? null,
        shippingStatus: o.shippingStatus,
        trackingCode: o.shippingId,
        wooExternalId:
          typeof payload.wooExternalId === "string" ? payload.wooExternalId : null,
        numeroEcommerce:
          typeof payload.numeroEcommerce === "string" ? payload.numeroEcommerce : null,
      };
    }),
    dualCustomers,
  });
}
