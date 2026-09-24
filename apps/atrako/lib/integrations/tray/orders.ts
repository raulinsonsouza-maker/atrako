/**
 * Pedidos Tray — listagem + dados completo.
 */

import { trayFetch } from "./client";

export type TrayCustomer = {
  id?: string | number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cellphone?: string | null;
};

export type TrayProductSold = {
  id?: string | number;
  product_id?: string | number;
  variant_id?: string | number | null;
  name?: string | null;
  original_name?: string | null;
  quantity?: string | number;
  price?: string | number;
  reference?: string | null;
};

export type TrayOrder = {
  id?: string | number;
  status?: string | null;
  date?: string | null;
  hour?: string | null;
  customer_id?: string | number | null;
  total?: string | number | null;
  partial_total?: string | number | null;
  payment_date?: string | null;
  has_payment?: string | number | null;
  payment_method?: string | null;
  modified?: string | null;
  OrderStatus?: {
    id?: string | number;
    type?: string | null;
    status?: string | null;
  } | null;
  Customer?: TrayCustomer | null;
  ProductsSold?: Array<{ ProductsSold?: TrayProductSold } | TrayProductSold>;
};

export type TrayOrderEnvelope = {
  Order?: TrayOrder;
  Orders?: Array<{ Order?: TrayOrder } | TrayOrder>;
  paging?: {
    total?: number;
    page?: number;
    offset?: number;
    limit?: number;
  };
};

export type NormalizedTrayLineItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
};

export type TrayBuyer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  customerId: string | null;
};

function moneyToCents(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function unwrapOrder(raw: unknown): TrayOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.Order && typeof o.Order === "object") return o.Order as TrayOrder;
  if (o.id != null || o.ProductsSold || o.Customer) return o as TrayOrder;
  return null;
}

export function trayOrderExternalId(order: TrayOrder): string {
  if (order.id == null) throw new Error("tray_order_missing_id");
  return String(order.id);
}

export function trayOrderTotalCents(order: TrayOrder): number {
  return moneyToCents(order.total ?? order.partial_total);
}

export function trayOrderStatus(order: TrayOrder): string | null {
  return (
    order.OrderStatus?.status ||
    order.OrderStatus?.type ||
    order.status ||
    null
  );
}

export function isTrayPaidStatus(order: TrayOrder): boolean {
  if (order.has_payment === "1" || order.has_payment === 1) return true;
  const pd = order.payment_date;
  if (pd && !pd.startsWith("0000")) return true;
  const type = (order.OrderStatus?.type || "").toLowerCase();
  if (type === "closed" || type === "paid") return true;
  const status = (order.status || "").toLowerCase();
  return /pago|paid|enviado|entregue|faturado/.test(status);
}

export function trayOrderOccurredAt(order: TrayOrder): Date {
  if (order.date) {
    const time = order.hour && !order.hour.startsWith("00:00:00") ? order.hour : "00:00:00";
    const d = new Date(`${order.date.trim()}T${time.trim()}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (order.modified) {
    const d = new Date(order.modified.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function extractTrayBuyer(order: TrayOrder): TrayBuyer {
  const c = order.Customer;
  const phone = c?.cellphone || c?.phone || null;
  const email = c?.email || null;
  const name = c?.name?.trim() || null;
  return {
    name: name || email || phone || null,
    email,
    phone,
    customerId: c?.id != null ? String(c.id) : order.customer_id != null ? String(order.customer_id) : null,
  };
}

export function extractTrayLineItems(order: TrayOrder): NormalizedTrayLineItem[] {
  const raw = order.ProductsSold ?? [];
  const items: NormalizedTrayLineItem[] = [];
  for (const row of raw) {
    const p =
      row && typeof row === "object" && "ProductsSold" in row
        ? (row as { ProductsSold?: TrayProductSold }).ProductsSold
        : (row as TrayProductSold);
    if (!p) continue;
    const qty =
      typeof p.quantity === "number"
        ? p.quantity
        : Number(p.quantity ?? 1) || 1;
    const unit = moneyToCents(p.price);
    items.push({
      externalItemId: p.id != null ? String(p.id) : p.product_id != null ? String(p.product_id) : null,
      title: (p.original_name || p.name || "Item").trim(),
      quantity: qty,
      unitPriceCents: unit,
      lineTotalCents: unit * qty,
      sku: p.reference || null,
    });
  }
  return items;
}

export async function getTrayOrderComplete(
  workspaceId: string,
  orderId: string | number,
): Promise<TrayOrder> {
  const json = await trayFetch<TrayOrderEnvelope | TrayOrder>(
    workspaceId,
    `/orders/${orderId}/complete`,
  );
  const order = unwrapOrder(json) ?? unwrapOrder((json as TrayOrderEnvelope).Order);
  if (!order?.id) throw new Error(`tray_order_not_found:${orderId}`);
  return order;
}

export async function listTrayOrders(
  workspaceId: string,
  options?: { page?: number; limit?: number; date?: string },
): Promise<{ orders: TrayOrder[]; paging: TrayOrderEnvelope["paging"] }> {
  const json = await trayFetch<TrayOrderEnvelope>(workspaceId, "/orders", {
    query: {
      page: options?.page ?? 1,
      limit: options?.limit ?? 50,
      date: options?.date,
    },
  });
  const list = json.Orders ?? [];
  const orders: TrayOrder[] = [];
  for (const row of list) {
    const o = unwrapOrder(row);
    if (o) orders.push(o);
  }
  return { orders, paging: json.paging };
}

export async function getTrayProduct(
  workspaceId: string,
  productId: string | number,
): Promise<Record<string, unknown> | null> {
  try {
    const json = await trayFetch<{ Product?: Record<string, unknown> }>(
      workspaceId,
      `/products/${productId}`,
    );
    return json.Product ?? (json as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}
