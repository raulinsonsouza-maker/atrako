import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import { foodCanManage, foodPanelRole } from "@/lib/food/panel";

function startOfSaoPauloDay(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${day}T00:00:00-03:00`);
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const moduleOff = await requireModuleApi(workspaceId, "food");
  if (moduleOff) return moduleOff;
  if (!foodCanManage(await foodPanelRole(workspaceId))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const since = startOfSaoPauloDay();
  const orders = await prisma.foodOrder.findMany({
    where: { clienteId: workspaceId },
    include: { items: true, contact: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const today = orders.filter((order) => order.createdAt >= since && order.fulfillmentStatus !== "CANCELLED");
  const paidToday = today.filter((order) => order.paymentStatus === "APPROVED");
  const revenue = paidToday.reduce((sum, order) => sum + order.totalCents, 0);
  const count = paidToday.length;
  const inProgress = orders.filter((order) =>
    ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(order.fulfillmentStatus),
  ).length;
  const byChannel = (channel: string) =>
    paidToday.filter((order) => order.channel === channel).reduce((sum, order) => sum + order.totalCents, 0);

  const dishes = new Map<string, { name: string; quantity: number; cents: number }>();
  for (const order of paidToday) {
    for (const item of order.items) {
      const current = dishes.get(item.name) ?? { name: item.name, quantity: 0, cents: 0 };
      current.quantity += item.quantity;
      current.cents += item.priceCents * item.quantity;
      dishes.set(item.name, current);
    }
  }

  const customers = new Map<string, { name: string; phone: string; orders: number; cents: number; lastAt: string }>();
  for (const order of orders) {
    if (order.paymentStatus !== "APPROVED") continue;
    const key = order.contactId || order.phone;
    const current = customers.get(key) ?? {
      name: order.contact?.name || order.customerName,
      phone: order.contact?.phone || order.phone,
      orders: 0,
      cents: 0,
      lastAt: order.createdAt.toISOString(),
    };
    current.orders += 1;
    current.cents += order.totalCents;
    if (order.createdAt.toISOString() > current.lastAt) current.lastAt = order.createdAt.toISOString();
    customers.set(key, current);
  }
  const idleBefore = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return NextResponse.json({
    today: {
      revenueCents: revenue,
      count,
      averageCents: count ? Math.round(revenue / count) : 0,
      inProgress,
      storeCents: byChannel("STORE"),
      whatsappCents: byChannel("WHATSAPP"),
      counterCents: byChannel("COUNTER"),
      dishes: [...dishes.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
    },
    caixa: {
      approvedCents: orders.filter((order) => order.paymentStatus === "APPROVED").reduce((sum, order) => sum + order.totalCents, 0),
      pendingDeliveryCents: orders.filter((order) => order.paymentStatus === "PAY_ON_DELIVERY").reduce((sum, order) => sum + order.totalCents, 0),
      refundedCents: orders.filter((order) => order.paymentStatus === "REFUNDED").reduce((sum, order) => sum + order.totalCents, 0),
      rows: orders
        .filter((order) => ["APPROVED", "PAY_ON_DELIVERY", "REFUNDED"].includes(order.paymentStatus))
        .slice(0, 40)
        .map((order) => ({
          id: order.id,
          number: order.number,
          customerName: order.customerName,
          paymentStatus: order.paymentStatus,
          totalCents: order.totalCents,
          createdAt: order.createdAt,
        })),
    },
    customers: [...customers.values()]
      .map((customer) => ({
        ...customer,
        averageCents: Math.round(customer.cents / customer.orders),
        idle: new Date(customer.lastAt).getTime() < idleBefore,
      }))
      .sort((a, b) => b.cents - a.cents),
  });
}
